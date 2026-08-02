import { getDb } from "./db.ts";
import { firebaseConfigured, firestore } from "./firebase-admin.ts";

/**
 * Acesso aos planos.
 *
 * Primeiro dominio a sair do SQLite. Enquanto a migracao decorre, os dois
 * backends coexistem: se houver Firebase configurado le-se de la, senao do
 * SQLite. Isto e andaime, nao arquitectura - assim que todos os dominios
 * estiverem migrados, o ramo do SQLite sai daqui.
 *
 * A forma de PublicPlan e IGUAL a que o SQLite devolvia, incluindo os
 * badge_active/discount_active como 0 e 1. O Firestore guarda-os como
 * booleanos, que e o correcto, e a conversao acontece aqui na fronteira.
 * Assim os componentes que fazem `badge_active === 1` continuam a
 * funcionar e a migracao nao arrasta a interface atras de si. Quando
 * estiver tudo migrado vale a pena passar isto a booleano de ponta a
 * ponta - fica anotado para nao se perder.
 */

export type PublicPlan = {
  id: number;
  code: string;
  name: string;
  description: string | null;
  price_cents: number;
  currency: string;
  days: number;
  support_days: number | null;
  cover_url: string | null;
  badge_text: string | null;
  badge_active: number;
  compare_at_cents: number | null;
  discount_active: number;
  promo_text: string | null;
  features: string[];
  cta_text: string;
};

const flag = (v: unknown): number => (v === true || v === 1 ? 1 : 0);

function features(value: unknown): string[] {
  const list = typeof value === "string" ? safeParse(value) : value;
  return Array.isArray(list)
    ? list.filter((i): i is string => typeof i === "string" && Boolean(i.trim()))
    : [];
}

function safeParse(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return [];
  }
}

function toPublic(row: Record<string, unknown>): PublicPlan {
  const name = String(row.name ?? "");
  return {
    id: Number(row.id),
    code: String(row.code ?? ""),
    name,
    description: (row.description as string | null) ?? null,
    price_cents: Number(row.price_cents ?? 0),
    currency: String(row.currency ?? "EUR"),
    days: Number(row.days ?? 0),
    support_days: row.support_days === null || row.support_days === undefined
      ? null
      : Number(row.support_days),
    cover_url: (row.cover_url as string | null) ?? null,
    badge_text: (row.badge_text as string | null) ?? null,
    badge_active: flag(row.badge_active),
    compare_at_cents: row.compare_at_cents === null || row.compare_at_cents === undefined
      ? null
      : Number(row.compare_at_cents),
    discount_active: flag(row.discount_active),
    promo_text: (row.promo_text as string | null) ?? null,
    features: features(row.features ?? row.features_json),
    cta_text: String(row.cta_text || `Get ${name}`),
  };
}

async function fromFirestore(): Promise<PublicPlan[]> {
  // Le TODOS e filtra em memoria, em vez de where("active","==",true).
  //
  // O campo `active` existe nos documentos ora como numero 1 ora como
  // booleano true, conforme quem o escreveu: a migracao gravou booleano,
  // o repositorio grava numero. Uma query por igualdade so apanha uma das
  // formas - e a pagina de precos aparecia VAZIA porque procurava `true`
  // onde estava `1`.
  //
  // Filtrar em memoria e imune as duas formas, dispensa o indice composto,
  // e nao custa nada: sao meia duzia de planos.
  const snap = await firestore().collection("plans").get();

  // Filtrar e ordenar sobre os dados crus: o toPublic() nao devolve
  // `active` nem `sort_order` - sao campos internos que a pagina publica
  // nao precisa de conhecer.
  return snap.docs
    .map((d) => ({ ...d.data(), id: d.data().id ?? Number(d.id) }) as Record<string, unknown>)
    .filter((row) => flag(row.active) === 1)
    .sort(
      (a, b) =>
        Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0) ||
        Number(a.id) - Number(b.id),
    )
    .map(toPublic);
}

function fromSqlite(): PublicPlan[] {
  const rows = getDb()
    .prepare(
      `SELECT id, code, name, description, price_cents, currency, days, support_days, cover_url,
              badge_text, badge_active, compare_at_cents, discount_active, promo_text,
              features_json, cta_text
         FROM plans WHERE active = 1 ORDER BY sort_order`,
    )
    .all() as Array<Record<string, unknown>>;

  return rows.map(toPublic);
}

export async function activePlans(): Promise<PublicPlan[]> {
  if (!firebaseConfigured()) return fromSqlite();

  try {
    return await fromFirestore();
  } catch (error) {
    console.warn(
      "[plans] Firestore indisponivel; a usar fallback SQLite para planos publicos.",
      error,
    );
    return fromSqlite();
  }
}
