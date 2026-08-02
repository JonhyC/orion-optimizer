import { firestore } from "../firebase-admin.ts";
import { getDb } from "../db.ts";
import { cached, invalidateCache } from "../cache.ts";
import { allocateId } from "./ids.ts";
import { COLLECTIONS, type Plan } from "./types.ts";

/**
 * Planos.
 *
 * Sao poucos (meia duzia) e mudam raramente, mas sao lidos em quase todo o
 * lado: pagina de precos, painel, mapeamento de cargos do Discord. Por isso
 * `allPlans()` traz a coleccao inteira de uma vez e quem precisa de filtrar
 * fa-lo em memoria - sai mais barato do que varias queries, e a lista cabe
 * folgadamente numa resposta.
 */

function col() {
  return firestore().collection(COLLECTIONS.plans);
}

function normalizar(dados: Partial<Plan>, id: number): Plan {
  return {
    id,
    code: dados.code ?? "",
    name: dados.name ?? "",
    description: dados.description ?? null,
    price_cents: Number(dados.price_cents ?? 0),
    currency: dados.currency ?? "EUR",
    days: Number(dados.days ?? 0),
    support_days: dados.support_days ?? null,
    active: Number(dados.active ?? 0),
    sort_order: Number(dados.sort_order ?? 0),
    discord_role_id: dados.discord_role_id ?? null,
    cover_url: dados.cover_url ?? null,
    badge_text: dados.badge_text ?? null,
    badge_active: Number(dados.badge_active ?? 0),
    compare_at_cents: dados.compare_at_cents ?? null,
    discount_active: Number(dados.discount_active ?? 0),
    promo_text: dados.promo_text ?? null,
    features_json: dados.features_json ?? null,
    cta_text: dados.cta_text ?? null,
    app_version: dados.app_version ?? null,
    app_min_supported: dados.app_min_supported ?? null,
  };
}

/**
 * Os booleanos do Firestore voltam a 0/1 aqui na fronteira.
 *
 * O SQLite guardava-os como inteiros e a interface faz comparacoes do tipo
 * `badge_active === 1`. Converter aqui mantem essa forma e evita arrastar
 * a interface atras da migracao.
 */
function flag(v: unknown): number {
  return v === true || v === 1 ? 1 : 0;
}

function doDocumento(dados: Record<string, unknown>, id: number): Plan {
  return normalizar(
    {
      ...(dados as Partial<Plan>),
      active: flag(dados.active),
      badge_active: flag(dados.badge_active),
      discount_active: flag(dados.discount_active),
      // A migracao grava `features` como array nativo; o SQLite tinha uma
      // string JSON. Quem le espera a string, portanto reconverte-se.
      features_json: Array.isArray(dados.features)
        ? JSON.stringify(dados.features)
        : ((dados.features_json as string | null) ?? null),
    },
    id,
  );
}

export async function allPlans(): Promise<Plan[]> {
  return cached("plans:all", 10_000, readAllPlans);
}

async function readAllPlans(): Promise<Plan[]> {
  const snap = await col().orderBy("sort_order").get();
  if (!snap.empty) return snap.docs.map((d) => doDocumento(d.data(), Number(d.id)));

  const sqlitePlans = getDb()
    .prepare("SELECT * FROM plans ORDER BY sort_order, id")
    .all() as Array<Record<string, unknown>>;
  if (!sqlitePlans.length) return [];

  const batch = firestore().batch();
  const plans = sqlitePlans.map((row) => doDocumento(row, Number(row.id)));
  for (const plan of plans) {
    batch.set(col().doc(String(plan.id)), plan);
  }
  await batch.commit();
  return plans;
}

export async function activePlans(): Promise<Plan[]> {
  return (await allPlans()).filter((p) => p.active === 1);
}

export async function findPlanById(id: number): Promise<Plan | null> {
  const snap = await col().doc(String(id)).get();
  return snap.exists ? doDocumento(snap.data() as Record<string, unknown>, id) : null;
}

export async function findPlanByCode(code: string): Promise<Plan | null> {
  const snap = await col().where("code", "==", code).limit(1).get();
  if (snap.empty) return null;
  const doc = snap.docs[0];
  return doDocumento(doc.data(), Number(doc.id));
}

/**
 * Plano ligado a um destes cargos do Discord, o de maior `sort_order`.
 *
 * Alguem pode ter varios cargos de plano ao mesmo tempo - comprou o Basic
 * e mais tarde o Ultimate. Ganha o mais alto, como no SQLite (ORDER BY
 * sort_order DESC, id DESC LIMIT 1).
 */
export async function planForRoleIds(roleIds: string[]): Promise<Plan | null> {
  if (!roleIds.length) return null;
  const candidatos = (await allPlans()).filter(
    (p) => p.discord_role_id && roleIds.includes(p.discord_role_id),
  );
  if (!candidatos.length) return null;

  candidatos.sort((a, b) => b.sort_order - a.sort_order || b.id - a.id);
  return candidatos[0];
}

/** Todos os cargos do Discord associados a planos. */
export async function planDiscordRoleIds(): Promise<string[]> {
  return (await allPlans())
    .map((p) => p.discord_role_id)
    .filter((v): v is string => Boolean(v));
}

export async function createPlan(dados: Omit<Partial<Plan>, "id">): Promise<Plan> {
  const id = await allocateId(COLLECTIONS.plans);
  const plano = normalizar(dados, id);
  await col().doc(String(id)).set(plano);
  invalidateCache("plans:");
  invalidateCache("stats:");
  return plano;
}

export async function updatePlan(id: number, patch: Partial<Plan>): Promise<void> {
  const { id: _ignorado, ...campos } = patch;
  await col().doc(String(id)).set(campos, { merge: true });
  invalidateCache("plans:");
  invalidateCache("stats:");
}

export async function deletePlan(id: number): Promise<void> {
  await col().doc(String(id)).delete();
  invalidateCache("plans:");
  invalidateCache("stats:");
}
