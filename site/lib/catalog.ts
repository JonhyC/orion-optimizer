import fs from "node:fs";
import path from "node:path";

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

export type Tweak = {
  id: string;
  name: string;
  description: string;
  layer: 0 | 1;
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

/** Descreve as barreiras, para a interface as poder mostrar. */
export function forbiddenRules(): Array<{ pattern: string; reason: string }> {
  return FORBIDDEN.map((f) => ({ pattern: f.pattern.source, reason: f.reason }));
}
