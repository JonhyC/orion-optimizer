"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/session";
import { audit } from "@/lib/db";
import {
  readCatalog,
  validateTweak,
  writeCatalog,
  type Action,
  type GpuType,
  type GpuVendor,
  type Tweak,
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

export async function saveTweakAction(_prev: unknown, formData: FormData) {
  const actor = await requireRole("developer");

  const originalId = String(formData.get("originalId") ?? "").trim();
  const tweak: Tweak = {
    id: String(formData.get("id") ?? "").trim(),
    name: String(formData.get("name") ?? "").trim(),
    description: String(formData.get("description") ?? "").trim(),
    layer: Number(formData.get("layer")) === 1 ? 1 : 0,
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
