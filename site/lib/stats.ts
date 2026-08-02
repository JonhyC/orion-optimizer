import { nowSeconds } from "./db.ts";
import { cached } from "./cache.ts";
import { listAllOrders, listOrdersForUser, listRecentOrders } from "./repo/orders.ts";
import { allPlans } from "./repo/plans.ts";
import { countUsers, listProfiles } from "./repo/users.ts";
import type { Order, Plan, UserProfile } from "./repo/types.ts";

/**
 * Agregacoes do painel.
 *
 * As series diarias sao agrupadas em JS e nao em SQL: as datas sao timestamps
 * unix, e assim os intervalos vazios aparecem como zero em vez de faltarem -
 * um grafico com dias em falta mente sobre a forma da curva.
 */

const DAY = 86400;
const ADMIN_STATS_CACHE_MS = 8_000;

export type Point = { date: string; label: string; value: number };

export type Summary = {
  revenueTotal: number;
  revenue30: number;
  revenuePrev30: number;
  revenueDelta: number | null;
  refundedTotal: number;
  ordersPaid: number;
  avgOrder: number;
  activeLicenses: number;
  clientsTotal: number;
  clientsNew30: number;
  ordersByStatus: Record<string, number>;
};

function cachedOrders(): Promise<Order[]> {
  return cached("stats:orders:1000", ADMIN_STATS_CACHE_MS, () => listAllOrders());
}

function cachedProfiles(): Promise<UserProfile[]> {
  return cached("stats:profiles:1000", ADMIN_STATS_CACHE_MS, () => listProfiles(1000));
}

function cachedUserCount(): Promise<number> {
  return cached("stats:users:count", ADMIN_STATS_CACHE_MS, countUsers);
}

function cachedPlans(): Promise<Plan[]> {
  return cached("stats:plans", ADMIN_STATS_CACHE_MS, allPlans);
}

export async function summary(): Promise<Summary> {
  const now = nowSeconds();
  const since30 = now - 30 * DAY;
  const prev30 = now - 60 * DAY;
  const [orders, users, totalUsers] = await Promise.all([
    cachedOrders(),
    cachedProfiles(),
    cachedUserCount(),
  ]);
  const paid = orders.filter(
    (order): order is Order & { paid_at: number } =>
      order.status === "paid" && order.paid_at !== null,
  );

  let total = 0;
  let last30 = 0;
  let prior30 = 0;

  for (const o of paid) {
    total += o.amount_cents;
    if (o.paid_at >= since30) last30 += o.amount_cents;
    else if (o.paid_at >= prev30) prior30 += o.amount_cents;
  }

  // Licenca ativa = tem plano ou validade gravada, E essa validade nao passou.
  // A primeira condicao e o que impede um owner sem uma unica compra
  // (expires_at a NULL) de contar como licenca permanente.
  const activeLicenses = users.filter((user) =>
    user.status === "active" &&
    (user.tier !== null || user.expires_at !== null) &&
    (user.expires_at === null || user.expires_at > now)
  ).length;
  const clientsTotal = users.filter((user) => user.role === "client").length;
  const clientsNew30 = users.filter((user) => user.role === "client" && user.created_at >= since30).length;
  const refundedTotal = orders
    .filter((order) => order.status === "refunded")
    .reduce((sum, order) => sum + order.amount_cents, 0);

  const ordersByStatus: Record<string, number> = {};
  for (const order of orders) {
    ordersByStatus[order.status] = (ordersByStatus[order.status] ?? 0) + 1;
  }

  return {
    revenueTotal: total,
    revenue30: last30,
    revenuePrev30: prior30,
    revenueDelta: prior30 > 0 ? ((last30 - prior30) / prior30) * 100 : null,
    refundedTotal,
    ordersPaid: paid.length,
    avgOrder: paid.length ? Math.round(total / paid.length) : 0,
    activeLicenses,
    clientsTotal: Math.max(clientsTotal, totalUsers ? clientsTotal : 0),
    clientsNew30,
    ordersByStatus,
  };
}

export async function dailySeries(what: "revenue" | "signups" | "orders", days = 30): Promise<Point[]> {
  const buckets = new Map<string, number>();

  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(midnight.getTime() - i * DAY * 1000);
    buckets.set(isoDate(d), 0);
  }

  const from = Math.floor((midnight.getTime() - (days - 1) * DAY * 1000) / 1000);

  const rows = what === "signups"
    ? (await cachedProfiles())
      .filter((user) => user.role === "client" && user.created_at >= from)
      .map((user) => ({ t: user.created_at, v: 1 }))
    : (await cachedOrders())
      .filter((order) =>
        what === "revenue"
          ? order.status === "paid" && order.paid_at !== null && order.paid_at >= from
          : order.created_at >= from
      )
      .map((order) => ({
        t: what === "revenue" ? order.paid_at! : order.created_at,
        v: what === "revenue" ? order.amount_cents : 1,
      }));

  for (const r of rows) {
    const key = isoDate(new Date(r.t * 1000));
    if (buckets.has(key)) buckets.set(key, buckets.get(key)! + r.v);
  }

  return [...buckets.entries()].map(([date, value]) => ({
    date,
    label: shortLabel(date),
    value,
  }));
}

export type PlanRow = { name: string; orders: number; revenue: number };

export async function revenueByPlan(): Promise<PlanRow[]> {
  const [plans, orders] = await Promise.all([cachedPlans(), cachedOrders()]);
  const rows = plans.map((plan) => {
    const paid = orders.filter((order) => order.plan_id === plan.id && order.status === "paid");
    return {
      name: plan.name,
      orders: paid.length,
      revenue: paid.reduce((sum, order) => sum + order.amount_cents, 0),
    };
  });
  return rows.sort((a, b) => b.revenue - a.revenue);
}

export type OrderRow = {
  id: number;
  username: string;
  plan_name: string;
  amount_cents: number;
  currency: string;
  status: string;
  provider: string;
  created_at: number;
  paid_at: number | null;
};

function toOrderRow(order: Order): OrderRow {
  return {
    id: order.id,
    username: order.username,
    plan_name: order.plan_name,
    amount_cents: order.amount_cents,
    currency: order.currency,
    status: order.status,
    provider: order.provider,
    created_at: order.created_at,
    paid_at: order.paid_at,
  };
}

export async function recentOrders(limit = 10): Promise<OrderRow[]> {
  return (await cached(`stats:recent-orders:${limit}`, ADMIN_STATS_CACHE_MS, () => listRecentOrders(limit))).map(toOrderRow);
}

export async function ordersForUser(userId: number): Promise<OrderRow[]> {
  return (await listOrdersForUser(userId)).map(toOrderRow);
}

// ------------------------------------------------------------------ formato

export function money(cents: number, currency = "EUR"): string {
  return new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

export function isoDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function shortLabel(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${Number(d)} ${MONTHS[Number(m) - 1]}`;
}

export function dateTime(ts: number): string {
  return new Date(ts * 1000).toLocaleString("pt-PT", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
