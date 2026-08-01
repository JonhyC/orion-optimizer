import { getDb, nowSeconds } from "./db.ts";

/**
 * Agregacoes do painel.
 *
 * As series diarias sao agrupadas em JS e nao em SQL: as datas sao timestamps
 * unix, e assim os intervalos vazios aparecem como zero em vez de faltarem -
 * um grafico com dias em falta mente sobre a forma da curva.
 */

const DAY = 86400;

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

export function summary(): Summary {
  const db = getDb();
  const now = nowSeconds();
  const since30 = now - 30 * DAY;
  const prev30 = now - 60 * DAY;

  const paid = db
    .prepare("SELECT amount_cents, paid_at FROM orders WHERE status = 'paid'")
    .all() as Array<{ amount_cents: number; paid_at: number }>;

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
  const activeLicenses = (
    db
      .prepare(
        `SELECT COUNT(*) AS n FROM users
         WHERE status = 'active'
           AND (tier IS NOT NULL OR expires_at IS NOT NULL)
           AND (expires_at IS NULL OR expires_at > ?)`,
      )
      .get(now) as { n: number }
  ).n;

  const clientsTotal = (
    db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'client'").get() as { n: number }
  ).n;

  const clientsNew30 = (
    db
      .prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'client' AND created_at >= ?")
      .get(since30) as { n: number }
  ).n;

  const refundedTotal = (
    db
      .prepare("SELECT COALESCE(SUM(amount_cents), 0) AS s FROM orders WHERE status = 'refunded'")
      .get() as { s: number }
  ).s;

  const ordersByStatus: Record<string, number> = {};
  for (const r of db
    .prepare("SELECT status, COUNT(*) AS n FROM orders GROUP BY status")
    .all() as Array<{ status: string; n: number }>) {
    ordersByStatus[r.status] = r.n;
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
    clientsTotal,
    clientsNew30,
    ordersByStatus,
  };
}

export function dailySeries(what: "revenue" | "signups" | "orders", days = 30): Point[] {
  const db = getDb();
  const buckets = new Map<string, number>();

  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(midnight.getTime() - i * DAY * 1000);
    buckets.set(isoDate(d), 0);
  }

  const from = Math.floor((midnight.getTime() - (days - 1) * DAY * 1000) / 1000);

  const rows =
    what === "revenue"
      ? (db
          .prepare("SELECT paid_at AS t, amount_cents AS v FROM orders WHERE status = 'paid' AND paid_at >= ?")
          .all(from) as Array<{ t: number; v: number }>)
      : what === "signups"
        ? (db
            .prepare("SELECT created_at AS t, 1 AS v FROM users WHERE role = 'client' AND created_at >= ?")
            .all(from) as Array<{ t: number; v: number }>)
        : (db
            .prepare("SELECT created_at AS t, 1 AS v FROM orders WHERE created_at >= ?")
            .all(from) as Array<{ t: number; v: number }>);

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

export function revenueByPlan(): PlanRow[] {
  return getDb()
    .prepare(
      `SELECT p.name AS name, COUNT(o.id) AS orders, COALESCE(SUM(o.amount_cents), 0) AS revenue
       FROM plans p
       LEFT JOIN orders o ON o.plan_id = p.id AND o.status = 'paid'
       GROUP BY p.id, p.name
       ORDER BY revenue DESC`,
    )
    .all() as PlanRow[];
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

export function recentOrders(limit = 10): OrderRow[] {
  return getDb()
    .prepare(
      `SELECT o.id, u.username, p.name AS plan_name, o.amount_cents, o.currency,
              o.status, o.provider, o.created_at, o.paid_at
       FROM orders o
       JOIN users u ON u.id = o.user_id
       JOIN plans p ON p.id = o.plan_id
       ORDER BY o.created_at DESC LIMIT ?`,
    )
    .all(Math.max(1, Math.min(200, limit))) as OrderRow[];
}

export function ordersForUser(userId: number): OrderRow[] {
  return getDb()
    .prepare(
      `SELECT o.id, u.username, p.name AS plan_name, o.amount_cents, o.currency,
              o.status, o.provider, o.created_at, o.paid_at
       FROM orders o
       JOIN users u ON u.id = o.user_id
       JOIN plans p ON p.id = o.plan_id
       WHERE o.user_id = ?
       ORDER BY o.created_at DESC`,
    )
    .all(userId) as OrderRow[];
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
