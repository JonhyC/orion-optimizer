"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/session";
import { audit } from "@/lib/db";
import { isTweakEnabled } from "@/lib/optimizer-access";
import {
  readCatalog,
  validateTweak,
  writeCatalog,
  TWEAK_TIERS,
  type Action,
  type GpuType,
  type GpuVendor,
  type Tweak,
  type TweakTier,
} from "@/lib/catalog";

/**
 * Edicao do catalogo de optimizacoes.
 *
 * As barreiras de lib/catalog.ts correm aqui, no servidor, a cada gravacao.
 * A interface esconde os caminhos proibidos, mas isso e cortesia - a
 * verificacao que conta e esta, porque um POST pode ser forjado a mao.
 */

/** As accoes chegam em campos paralelos: hive[], key[], name[], kind[], value[]. */
function parseActions(formData: FormData): Action[] {
  const hives = formData.getAll("hive").map(String);
  const keys = formData.getAll("key").map(String);
  const names = formData.getAll("valueName").map(String);
  const kinds = formData.getAll("kind").map(String);
  const values = formData.getAll("value").map(String);

  const out: Action[] = [];
  for (let i = 0; i < hives.length; i++) {
    if (!keys[i]?.trim()) continue; // linha em branco: o utilizador nao a preencheu

    const kind = kinds[i] as Action["kind"];
    const raw = values[i] ?? "";
    const numeric = kind === "DWord" || kind === "QWord";

    out.push({
      hive: hives[i] as Action["hive"],
      key: keys[i].trim().replace(/^\\+|\\+$/g, ""),
      name: names[i].trim(),
      kind,
      value: numeric ? Number(raw) : raw,
    });
  }
  return out;
}

function parseTier(raw: FormDataEntryValue | null): TweakTier {
  const value = String(raw ?? "");
  return (TWEAK_TIERS as readonly string[]).includes(value)
    ? (value as TweakTier)
    : "basic";
}

export async function saveTweakAction(_prev: unknown, formData: FormData) {
  const actor = await requireRole("developer");

  const originalId = String(formData.get("originalId") ?? "").trim();
  const tweak: Tweak = {
    id: String(formData.get("id") ?? "").trim(),
    name: String(formData.get("name") ?? "").trim(),
    description: String(formData.get("description") ?? "").trim(),
    layer: Number(formData.get("layer")) === 1 ? 1 : 0,
    // Sem tier explicito o tweak cairia na regra herdada, que manda para
    // ultimate tudo o que nao reconhece. Por defeito fica basic: um tweak
    // visivel a mais corrige-se, um invisivel sem ninguem saber porque nao.
    tier: parseTier(formData.get("tier")),
    // getAll, nao get: o formulario manda um hidden "0" antes da checkbox,
    // e get() devolveria sempre esse primeiro valor.
    enabled: formData.getAll("enabled").includes("1"),
    impact: String(formData.get("impact") ?? "medio"),
    risk: String(formData.get("risk") ?? "baixo"),
    requiresReboot: formData.get("requiresReboot") === "1",
    actions: parseActions(formData),
  };

  const chassis = formData.getAll("chassis").map(String);
  const gpu = formData.getAll("gpuVendor").map(String) as GpuVendor[];
  const gpuTypes = formData.getAll("gpuType").map(String) as GpuType[];
  if (chassis.length || gpu.length || gpuTypes.length) {
    tweak.conditions = {};
    if (chassis.length) tweak.conditions.chassis = chassis;
    if (gpu.length) tweak.conditions.gpuVendor = gpu;
    if (gpuTypes.length) tweak.conditions.gpuType = gpuTypes;
  }

  const { tweaks } = readCatalog();
  const otherIds = tweaks.filter((t) => t.id !== originalId).map((t) => t.id);

  const check = validateTweak(tweak, otherIds);
  if (!check.ok) return { error: check.error };

  const next = originalId
    ? tweaks.map((t) => (t.id === originalId ? tweak : t))
    : [...tweaks, tweak];

  try {
    writeCatalog(next);
  } catch (e) {
    return { error: `Nao foi possivel gravar: ${(e as Error).message}` };
  }

  audit(actor.id, originalId ? "catalog_tweak_updated" : "catalog_tweak_created", tweak.id);
  revalidatePath("/panel/admin/catalog");

  return { ok: true, id: tweak.id };
}

/**
 * Suspende ou repoe um tweak. Alternativa a apagar: o cliente deixa de o
 * receber, mas a definicao fica no catalogo para se voltar atras.
 */
export async function toggleTweakAction(formData: FormData) {
  const actor = await requireRole("developer");
  const id = String(formData.get("id") ?? "");

  const { tweaks } = readCatalog();
  const target = tweaks.find((t) => t.id === id);
  if (!target) return;

  const next = tweaks.map((t) =>
    t.id === id ? { ...t, enabled: !isTweakEnabled(t) } : t,
  );

  writeCatalog(next);
  audit(actor.id, isTweakEnabled(target) ? "catalog_tweak_suspended" : "catalog_tweak_resumed", id);
  revalidatePath("/panel/admin/catalog");
}

/**
 * Duplica um tweak com id livre e ja suspenso. Suspenso de proposito: uma
 * copia ainda por rever nao deve chegar a maquinas de clientes so porque
 * alguem carregou em clonar e se distraiu.
 */
export async function cloneTweakAction(formData: FormData) {
  const actor = await requireRole("developer");
  const id = String(formData.get("id") ?? "");

  const { tweaks } = readCatalog();
  const source = tweaks.find((t) => t.id === id);
  if (!source) return;

  const taken = new Set(tweaks.map((t) => t.id));
  let copyId = `${source.id}-copia`;
  for (let n = 2; taken.has(copyId); n++) copyId = `${source.id}-copia-${n}`;

  const copy: Tweak = {
    ...structuredClone(source),
    id: copyId,
    name: `${source.name} (copia)`,
    enabled: false,
  };

  // A copia so difere no id e no nome, portanto herda a validade do
  // original. Se falhar aqui, e sinal de que o catalogo em disco ja tinha
  // um tweak invalido - nao o multiplicamos.
  const check = validateTweak(copy, [...taken]);
  if (!check.ok) {
    console.error(`[orion] clone recusado (${id} -> ${copyId}): ${check.error}`);
    return;
  }

  writeCatalog([...tweaks, copy]);
  audit(actor.id, "catalog_tweak_cloned", `${id} -> ${copyId}`);
  revalidatePath("/panel/admin/catalog");
}

export async function deleteTweakAction(formData: FormData) {
  const actor = await requireRole("developer");
  const id = String(formData.get("id") ?? "");

  const { tweaks } = readCatalog();
  const next = tweaks.filter((t) => t.id !== id);
  if (next.length === tweaks.length) return;

  writeCatalog(next);
  audit(actor.id, "catalog_tweak_deleted", id);
  revalidatePath("/panel/admin/catalog");
}
