import { avatarUrl } from "@/lib/discord";
import { bearerToken, userFromToken } from "@/lib/auth";
import { getDb, nowSeconds } from "@/lib/db";
import { fail, ok } from "../../_lib/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const INTERNAL_ROLES = new Set(["staff", "developer", "owner"]);
const DAY = 86400;

type CountRow = { n: number };

export async function GET(req: Request) {
  const actor = await userFromToken(bearerToken(req));
  if (!actor) return fail("Sessao invalida ou expirada.", 401, "invalid_token");
  if (!INTERNAL_ROLES.has(actor.role)) {
    return fail("Sem permissao para consultar a operacao Orion.", 403, "forbidden");
  }

  const db = getDb();
  const now = nowSeconds();
  const onlineSince = now - 5 * 60;
  const since24h = now - DAY;
  const since30d = now - 30 * DAY;
  const count = (sql: string, ...params: Array<string | number>) =>
    (db.prepare(sql).get(...params) as CountRow).n;

  const metrics = {
    users: count("SELECT COUNT(*) AS n FROM users"),
    activeLicenses: count(
      `SELECT COUNT(*) AS n FROM users
       WHERE status = 'active' AND (tier IS NOT NULL OR expires_at IS NOT NULL)
         AND (expires_at IS NULL OR expires_at > ?)`,
      now,
    ),
    onlineSite: count(
      `SELECT COUNT(DISTINCT user_id) AS n FROM tokens
       WHERE kind = 'web' AND expires_at > ? AND last_seen_at >= ?`,
      now,
      onlineSince,
    ),
    onlineOptimizer: count(
      `SELECT COUNT(DISTINCT user_id) AS n FROM tokens
       WHERE kind = 'api' AND expires_at > ? AND last_seen_at >= ?`,
      now,
      onlineSince,
    ),
    failedLogins24h: count(
      "SELECT COUNT(*) AS n FROM login_attempts WHERE success = 0 AND created_at >= ?",
      since24h,
    ),
    optimizerActions24h: count(
      `SELECT COUNT(*) AS n FROM audit_log
       WHERE action IN ('optimizer_previewed', 'optimizer_applied', 'optimizer_rolled_back')
         AND created_at >= ?`,
      since24h,
    ),
    catalogRequests24h: count(
      "SELECT COUNT(*) AS n FROM audit_log WHERE action = 'catalog_served' AND created_at >= ?",
      since24h,
    ),
    revenue30Cents:
      actor.role === "owner"
        ? (db
            .prepare(
              "SELECT COALESCE(SUM(amount_cents), 0) AS n FROM orders WHERE status = 'paid' AND paid_at >= ?",
            )
            .get(since30d) as CountRow).n
        : null,
  };

  const people = db
    .prepare(
      `SELECT u.id, u.username, u.discord_username, u.discord_id, u.discord_avatar,
              u.role, u.tier, u.status, u.client_version, u.client_seen_at,
              (SELECT MAX(last_seen_at) FROM tokens
               WHERE user_id = u.id AND kind = 'web' AND expires_at > ?) AS site_seen_at,
              (SELECT MAX(last_seen_at) FROM tokens
               WHERE user_id = u.id AND kind = 'api' AND expires_at > ?) AS optimizer_seen_at,
              (SELECT MAX(created_at) FROM audit_log WHERE user_id = u.id) AS last_activity_at
       FROM users u
       ORDER BY MAX(COALESCE(site_seen_at, 0), COALESCE(optimizer_seen_at, 0),
                    COALESCE(last_activity_at, 0), u.created_at) DESC
       LIMIT 24`,
    )
    .all(now, now) as Array<{
      id: number;
      username: string;
      discord_username: string | null;
      discord_id: string | null;
      discord_avatar: string | null;
      role: string;
      tier: string | null;
      status: string;
      client_version: string | null;
      client_seen_at: number | null;
      site_seen_at: number | null;
      optimizer_seen_at: number | null;
      last_activity_at: number | null;
    }>;

  const financialActions = ["panel_refund", "order_paid", "order_created"];
  const activity = db
    .prepare(
      `SELECT a.id, a.action, a.detail, a.created_at, u.id AS user_id,
              u.username, u.discord_username
       FROM audit_log a
       LEFT JOIN users u ON u.id = a.user_id
       ${actor.role === "owner" ? "" : `WHERE a.action NOT IN (${financialActions.map(() => "?").join(",")})`}
       ORDER BY a.created_at DESC
       LIMIT 30`,
    )
    .all(...(actor.role === "owner" ? [] : financialActions)) as Array<{
      id: number;
      action: string;
      detail: string | null;
      created_at: number;
      user_id: number | null;
      username: string | null;
      discord_username: string | null;
    }>;

  const usage = db
    .prepare(
      `SELECT action, COUNT(*) AS count
       FROM audit_log
       WHERE created_at >= ? AND action IN
         ('catalog_served', 'optimizer_previewed', 'optimizer_applied',
          'optimizer_rolled_back', 'login_ok', 'panel_login_ok')
       GROUP BY action ORDER BY count DESC`,
    )
    .all(since24h) as Array<{ action: string; count: number }>;

  const versions = db
    .prepare(
      `SELECT COALESCE(client_version, 'Sem versao') AS version, COUNT(*) AS count
       FROM users WHERE client_seen_at IS NOT NULL
       GROUP BY client_version ORDER BY count DESC LIMIT 8`,
    )
    .all() as Array<{ version: string; count: number }>;

  return ok({
    generatedAt: now,
    onlineWindowSeconds: 300,
    metrics,
    people: people.map((person) => ({
      id: person.id,
      username: person.username,
      displayName: person.discord_username ?? person.username,
      avatarUrl: person.discord_id
        ? avatarUrl(person.discord_id, person.discord_avatar)
        : null,
      role: person.role,
      tier: person.tier,
      status: person.status,
      clientVersion: person.client_version,
      clientSeenAt: person.client_seen_at,
      siteSeenAt: person.site_seen_at,
      optimizerSeenAt: person.optimizer_seen_at,
      siteOnline: (person.site_seen_at ?? 0) >= onlineSince,
      optimizerOnline: (person.optimizer_seen_at ?? 0) >= onlineSince,
      lastActivityAt: person.last_activity_at,
    })),
    activity: activity.map((entry) => ({
      id: entry.id,
      action: entry.action,
      detail: entry.detail,
      createdAt: entry.created_at,
      userId: entry.user_id,
      username: entry.discord_username ?? entry.username ?? "Sistema",
    })),
    usage,
    versions,
  });
}
