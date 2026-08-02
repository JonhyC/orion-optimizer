import { firestore } from "../firebase-admin.ts";
import { allocateId } from "./ids.ts";
import { COLLECTIONS, type Coupon } from "./types.ts";

const AGORA = () => Math.floor(Date.now() / 1000);

function col() {
  return firestore().collection(COLLECTIONS.coupons);
}

function normalizar(dados: Partial<Coupon>, id: number): Coupon {
  return {
    id,
    code: String(dados.code ?? "").toUpperCase(),
    description: dados.description ?? null,
    active: Number(dados.active ?? 1),
    percent_off: dados.percent_off ?? null,
    amount_off_cents: dados.amount_off_cents ?? null,
    currency: dados.currency ?? "EUR",
    max_redemptions: dados.max_redemptions ?? null,
    redeemed: Number(dados.redeemed ?? 0),
    expires_at: dados.expires_at ?? null,
    created_at: Number(dados.created_at ?? AGORA()),
  };
}

function fromDoc(doc: FirebaseFirestore.DocumentSnapshot): Coupon {
  return normalizar(doc.data() as Partial<Coupon>, Number(doc.id));
}

export async function listCoupons(): Promise<Coupon[]> {
  const snap = await col().orderBy("created_at", "desc").get();
  return snap.docs.map(fromDoc);
}

export async function findCouponByCode(code: string): Promise<Coupon | null> {
  const clean = normalizeCouponCode(code);
  if (!clean) return null;
  const snap = await col().where("code", "==", clean).limit(1).get();
  return snap.empty ? null : fromDoc(snap.docs[0]);
}

export async function createCoupon(dados: Omit<Partial<Coupon>, "id">): Promise<Coupon> {
  const id = await allocateId(COLLECTIONS.coupons);
  const coupon = normalizar(dados, id);
  await col().doc(String(id)).set(coupon);
  return coupon;
}

export async function updateCoupon(id: number, patch: Partial<Coupon>): Promise<void> {
  const { id: _ignorado, ...campos } = patch;
  await col().doc(String(id)).set(campos, { merge: true });
}

export async function redeemCoupon(id: number): Promise<void> {
  await firestore().runTransaction(async (tx) => {
    const ref = col().doc(String(id));
    const snap = await tx.get(ref);
    const current = Number(snap.data()?.redeemed ?? 0);
    tx.set(ref, { redeemed: current + 1 }, { merge: true });
  });
}

export function normalizeCouponCode(code: string): string {
  return code.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 32);
}

export function couponDiscount(coupon: Coupon | null, subtotal: number, currency = "EUR") {
  const now = AGORA();
  if (!coupon || coupon.active !== 1) return { ok: false, discount: 0, reason: "Cupao invalido." };
  if (coupon.currency !== currency) return { ok: false, discount: 0, reason: "Cupao invalido para esta moeda." };
  if (coupon.expires_at !== null && coupon.expires_at <= now) {
    return { ok: false, discount: 0, reason: "Cupao expirado." };
  }
  if (coupon.max_redemptions !== null && coupon.redeemed >= coupon.max_redemptions) {
    return { ok: false, discount: 0, reason: "Cupao esgotado." };
  }

  const percent = coupon.percent_off ? Math.round(subtotal * (coupon.percent_off / 100)) : 0;
  const fixed = coupon.amount_off_cents ?? 0;
  const discount = Math.min(subtotal, Math.max(percent, fixed));
  return { ok: true, discount, reason: null };
}
