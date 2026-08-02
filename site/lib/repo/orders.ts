import { firestore } from "../firebase-admin.ts";
import { allocateId } from "./ids.ts";
import { COLLECTIONS, type Order } from "./types.ts";

function col() {
  return firestore().collection(COLLECTIONS.orders);
}

function normalizar(dados: Partial<Order>, id: number): Order {
  return {
    id,
    user_id: Number(dados.user_id),
    plan_id: Number(dados.plan_id),
    amount_cents: Number(dados.amount_cents ?? 0),
    currency: dados.currency ?? "EUR",
    status: dados.status ?? "pending",
    provider: dados.provider ?? "manual",
    provider_ref: dados.provider_ref ?? null,
    created_at: Number(dados.created_at ?? Math.floor(Date.now() / 1000)),
    paid_at: dados.paid_at ?? null,
    refunded_at: dados.refunded_at ?? null,
    username: dados.username ?? "",
    plan_name: dados.plan_name ?? "",
    coupon_id: dados.coupon_id ?? null,
    coupon_code: dados.coupon_code ?? null,
    discount_cents: Number(dados.discount_cents ?? 0),
  };
}

function fromDoc(doc: FirebaseFirestore.DocumentSnapshot): Order {
  return normalizar(doc.data() as Partial<Order>, Number(doc.id));
}

export async function createOrder(dados: Omit<Partial<Order>, "id">): Promise<Order> {
  const id = await allocateId(COLLECTIONS.orders);
  const order = normalizar(dados, id);
  await col().doc(String(id)).set(order);
  return order;
}

export async function updateOrder(id: number, patch: Partial<Order>): Promise<void> {
  const { id: _ignorado, ...campos } = patch;
  await col().doc(String(id)).set(campos, { merge: true });
}

export async function findOrder(id: number): Promise<Order | null> {
  const doc = await col().doc(String(id)).get();
  return doc.exists ? fromDoc(doc) : null;
}

export async function listRecentOrders(limit = 100): Promise<Order[]> {
  const snap = await col()
    .orderBy("created_at", "desc")
    .limit(Math.max(1, Math.min(200, limit)))
    .get();
  return snap.docs.map(fromDoc);
}

export async function listOrdersForUser(userId: number): Promise<Order[]> {
  const snap = await col()
    .where("user_id", "==", userId)
    .orderBy("created_at", "desc")
    .get();
  return snap.docs.map(fromDoc);
}

export async function listAllOrders(limit = 1000): Promise<Order[]> {
  const snap = await col()
    .orderBy("created_at", "desc")
    .limit(Math.max(1, Math.min(2000, limit)))
    .get();
  return snap.docs.map(fromDoc);
}
