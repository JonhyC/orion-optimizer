import fs from "node:fs";
import path from "node:path";
import {
  groupTweaksByTier,
  isTweakEnabled,
  type OptimizerTier,
} from "./optimizer-access.ts";

/**
 * Leitura e escrita do catalogo de tweaks.
 *
 * O catalogo e editavel pelo painel, mas NAO e livre. As barreiras abaixo
 * correm no servidor a cada gravacao e nao tem interruptor: sao o que
 * impede o painel de se tornar uma forma de tijolar maquinas de clientes.
 */

export const CATALOG_PATH =
  process.env.ORION_CATALOG_PATH ??
  path.join(process.cwd(), "..", "catalog", "tweaks.json");

export type Action = {
  hive: "HKCU" | "HKLM";
  key: string;
  name: string;
  kind: "DWord" | "String" | "QWord" | "ExpandString";
  value: string | number;
};

export type GpuVendor = "NVIDIA" | "AMD" | "Intel";
export type GpuType = "dedicated" | "integrated";

export type TweakConditions = {
  chassis?: string[];
  gpuVendor?: GpuVendor[];
  gpuType?: GpuType[];
};

/**
 * Plano minimo que da direito ao tweak.
 *
 * Eixo separado da `layer`: a camada diz se e precisa elevacao no Windows,
 * o tier diz o que o cliente comprou. Um tweak pode correr sem admin e
 * mesmo assim ser exclusivo do Pro - o caso do desligar da aceleracao do
 * rato, que e HKCU mas so interessa a quem joga.
 */
export const TWEAK_TIERS = ["basic", "pro", "ultimate", "special"] as const;
export type TweakTier = (typeof TWEAK_TIERS)[number];

export type Tweak = {
  id: string;
  name: string;
  description: string;
  layer: 0 | 1;
  /**
   * Ausente = nivel herdado do prefixo do id (regra antiga, ver
   * optimizer-access.ts). Catalogos novos devem preencher sempre.
   */
  tier?: TweakTier;
  /**
   * Ausente ou true = servido aos clientes. False retira de circulacao sem
   * perder a definicao - o que apagar faria. Serve para suspender um tweak
   * suspeito de dar problemas sem ter de o reescrever depois.
   */
  enabled?: boolean;
  impact: string;
  risk: string;
  requiresReboot: boolean;
  conditions?: TweakConditions;
  actions: Action[];
};

const HIVES = ["HKCU", "HKLM"] as const;
const KINDS = ["DWord", "String", "QWord", "ExpandString"] as const;
const GPU_VENDORS = ["NVIDIA", "AMD", "Intel"] as const;
const GPU_TYPES = ["dedicated", "integrated"] as const;

/**
 * Caminhos proibidos. Cada um corresponde a uma forma conhecida de partir
 * um Windows ou de deixar alguem sem defesas - nao a uma preferencia.
 */
const FORBIDDEN: Array<{ pattern: RegExp; reason: string }> = [
  {
    pattern: /^SYSTEM\\CurrentControlSet\\Services/i,
    reason: "servicos do Windows: desativar o servico errado impede o arranque",
  },
  {
    pattern: /Windows\s*Defender|MpPreference|MsMpEng/i,
    reason: "Windows Defender: deixa a maquina sem antivirus",
  },
  {
    pattern: /WindowsUpdate|\\WU\\|AutoUpdate/i,
    reason: "Windows Update: deixa a maquina sem correcoes de seguranca",
  },
  {
    pattern: /^SYSTEM\\CurrentControlSet\\Control\\SafeBoot/i,
    reason: "arranque em modo de seguranca: e a rede de recuperacao",
  },
  {
    pattern: /\\Winlogon|\\Session Manager\\BootExecute/i,
    reason: "cadeia de arranque: um erro aqui impede o login",
  },
  {
    pattern: /Policies\\Microsoft\\Windows\\System\\DisableCMD|DisableTaskMgr|DisableRegistryTools/i,
    reason: "bloqueio de ferramentas: impede o utilizador de reverter a mao",
  },
];

export type ValidationResult = { ok: true } | { ok: false; error: string };

export function validateTweak(t: Partial<Tweak>, existingIds: string[]): ValidationResult {
  if (!t.id || !/^[a-z0-9]+(\.[a-z0-9-]+)+$/.test(t.id)) {
    return { ok: false, error: "O id tem de ser no formato 'categoria.nome-do-tweak'." };
  }
  if (!t.name?.trim()) return { ok: false, error: "Falta o nome." };
  if (!t.description?.trim()) return { ok: false, error: "Falta a descricao." };
  if (t.layer !== 0 && t.layer !== 1) return { ok: false, error: "A camada tem de ser 0 ou 1." };
  if (!t.actions?.length) return { ok: false, error: "Um tweak sem alteracoes nao faz nada." };

  if (t.tier !== undefined && !TWEAK_TIERS.includes(t.tier)) {
    return { ok: false, error: `Nivel invalido: ${t.tier}. So ${TWEAK_TIERS.join(", ")}.` };
  }

  if (t.conditions?.gpuVendor?.some((vendor) => !GPU_VENDORS.includes(vendor))) {
    return { ok: false, error: "O fabricante da GPU nao e valido." };
  }
  if (t.conditions?.gpuType?.some((type) => !GPU_TYPES.includes(type))) {
    return { ok: false, error: "O tipo de GPU nao e valido." };
  }

  if (existingIds.includes(t.id)) {
    return { ok: false, error: `Ja existe um tweak com o id '${t.id}'.` };
  }

  for (const a of t.actions) {
    if (!HIVES.includes(a.hive)) {
      return { ok: false, error: `Hive invalida: ${a.hive}. So HKCU ou HKLM.` };
    }
    if (!KINDS.includes(a.kind)) {
      return { ok: false, error: `Tipo invalido: ${a.kind}.` };
    }
    if (!a.key?.trim() || !a.name?.trim()) {
      return { ok: false, error: "Cada alteracao precisa de chave e nome de valor." };
    }

    // Camada 0 promete correr sem administrador. HKLM exige elevacao, logo
    // uma camada 0 a escrever em HKLM e uma promessa que rebenta na hora.
    if (t.layer === 0 && a.hive !== "HKCU") {
      return {
        ok: false,
        error: "Camada 0 corre sem administrador, portanto so pode escrever em HKCU.",
      };
    }

    for (const f of FORBIDDEN) {
      if (f.pattern.test(a.key)) {
        return {
          ok: false,
          error: `Caminho bloqueado (${a.key}) — ${f.reason}. Esta barreira nao tem excecao.`,
        };
      }
    }
  }

  return { ok: true };
}

export function readCatalog(): { schemaVersion: number; tweaks: Tweak[] } {
  const raw = JSON.parse(fs.readFileSync(CATALOG_PATH, "utf8"));
  return { schemaVersion: raw.schemaVersion ?? 1, tweaks: raw.tweaks ?? [] };
}

/**
 * Grava o catalogo. Faz copia do ficheiro anterior antes de escrever: o
 * cliente Windows depende deste ficheiro, e uma gravacao interrompida
 * deixaria toda a gente sem catalogo.
 */
export function writeCatalog(tweaks: Tweak[]): void {
  const dir = path.dirname(CATALOG_PATH);
  const backup = path.join(dir, "tweaks.backup.json");

  if (fs.existsSync(CATALOG_PATH)) {
    fs.copyFileSync(CATALOG_PATH, backup);
  }

  const payload = JSON.stringify({ schemaVersion: 2, tweaks }, null, 2);

  // Escrever para temporario e so depois substituir: rename e atomico, um
  // write direto pode ser lido a meio por um pedido em curso.
  const tmp = `${CATALOG_PATH}.tmp`;
  fs.writeFileSync(tmp, payload, "utf8");
  fs.renameSync(tmp, CATALOG_PATH);
}

export type CatalogStats = {
  total: number;
  suspended: number;
  byTier: Array<{ tier: OptimizerTier; count: number }>;
  distinctValues: number;
  /** Valores de registry escritos por mais do que um tweak activo. */
  conflicts: number;
};

/**
 * Resumo do catalogo para o painel de administracao. Corre no servidor a
 * cada carregamento: o catalogo tem dezenas de entradas, nao milhares, e
 * assim nunca mostra numeros em cache que ja nao correspondem ao ficheiro.
 */
export function catalogStats(): CatalogStats {
  const { tweaks } = readCatalog();
  const live = tweaks.filter(isTweakEnabled);

  const seen = new Map<string, Set<string>>();
  for (const t of live) {
    for (const a of t.actions) {
      const key = `${a.hive}\\${a.key}\\${a.name}`.toLocaleLowerCase("pt");
      seen.set(key, (seen.get(key) ?? new Set()).add(t.id));
    }
  }

  return {
    total: tweaks.length,
    suspended: tweaks.length - live.length,
    byTier: groupTweaksByTier(live).map((g) => ({ tier: g.tier, count: g.tweaks.length })),
    distinctValues: seen.size,
    conflicts: [...seen.values()].filter((ids) => ids.size > 1).length,
  };
}

/** Descreve as barreiras, para a interface as poder mostrar. */
export function forbiddenRules(): Array<{ pattern: string; reason: string }> {
  return FORBIDDEN.map((f) => ({ pattern: f.pattern.source, reason: f.reason }));
}
