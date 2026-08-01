import { audit, getDb, nowSeconds } from "./db.ts";
import { discordConfig, syncDiscordPlanRoles } from "./discord.ts";

export type ExpiryResult = {
  expired: number;
  discordSynced: number;
  discordPending: number;
};

type PendingSync = {
  user_id: number;
  discord_id: string;
  tier: string | null;
  attempts: number;
  remove_role_id: string | null;
  updated_at: number;
};

/** Regista o estado desejado; uma nova alteracao substitui uma tentativa antiga. */
export function queueDiscordRoleSync(
  userId: number,
  tier: string | null,
  reason: string,
  removeRoleId: string | null = null,
): void {
  const db = getDb();
  const linked = db.prepare("SELECT discord_id FROM users WHERE id = ?").get(userId) as
    | { discord_id: string | null }
    | undefined;
  if (!linked?.discord_id) return;

  db.prepare(
    `INSERT INTO discord_role_sync
       (user_id, tier, reason, attempts, last_error, remove_role_id, updated_at)
     VALUES (?, ?, ?, 0, NULL, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       tier = excluded.tier, reason = excluded.reason, attempts = 0,
       last_error = NULL,
       remove_role_id = COALESCE(excluded.remove_role_id, discord_role_sync.remove_role_id),
       updated_at = excluded.updated_at`,
  ).run(userId, tier, reason, removeRoleId, nowSeconds());
}

export async function flushDiscordRoleSync(limit = 25): Promise<{
  synced: number;
  pending: number;
}> {
  const db = getDb();
  const pendingCount = () =>
    Number(
      (db.prepare("SELECT COUNT(*) AS total FROM discord_role_sync").get() as { total: number })
        .total,
    );

  if (!discordConfig()?.botToken) return { synced: 0, pending: pendingCount() };

  const now = nowSeconds();
  const rows = db
    .prepare(
      `SELECT q.user_id, q.tier, q.attempts, q.remove_role_id, q.updated_at, u.discord_id
       FROM discord_role_sync q JOIN users u ON u.id = q.user_id
       WHERE u.discord_id IS NOT NULL ORDER BY q.updated_at ASC LIMIT ?`,
    )
    .all(limit) as PendingSync[];

  let synced = 0;
  for (const row of rows) {
    const retryDelay = Math.min(3600, 60 * 2 ** Math.min(row.attempts, 6));
    if (row.attempts > 0 && row.updated_at + retryDelay > now) continue;

    try {
      await syncDiscordPlanRoles(
        row.discord_id,
        row.tier,
        row.remove_role_id ? [row.remove_role_id] : [],
      );
      db.prepare("DELETE FROM discord_role_sync WHERE user_id = ?").run(row.user_id);
      audit(row.user_id, "discord_plan_roles_synced", row.tier ?? "member");
      synced++;
    } catch (error) {
      const message = (error as Error).message.slice(0, 500);
      db.prepare(
        `UPDATE discord_role_sync SET attempts = attempts + 1, last_error = ?, updated_at = ?
         WHERE user_id = ?`,
      ).run(message, nowSeconds(), row.user_id);
    }
  }

  return { synced, pending: pendingCount() };
}

/**
 * Expira primeiro na base de dados e so depois contacta o Discord. Assim uma
 * falha externa nunca prolonga o acesso ao optimizer.
 */
export async function processExpiredPlans(): Promise<ExpiryResult> {
  const db = getDb();
  const now = nowSeconds();
  const expired = db
    .prepare(
      `SELECT id, username, tier, discord_id FROM users
       WHERE tier IS NOT NULL AND expires_at IS NOT NULL AND expires_at <= ?`,
    )
    .all(now) as Array<{
    id: number;
    username: string;
    tier: string;
    discord_id: string | null;
  }>;

  if (expired.length > 0) {
    db.exec("BEGIN IMMEDIATE");
    try {
      for (const user of expired) {
        db.prepare(
          `UPDATE users SET tier = NULL, tier_source = 'manual',
           role = CASE WHEN role = 'client' THEN 'member' ELSE role END
           WHERE id = ? AND tier IS NOT NULL AND expires_at IS NOT NULL AND expires_at <= ?`,
        ).run(user.id, now);
        db.prepare("DELETE FROM tokens WHERE user_id = ? AND kind = 'api'").run(user.id);
        if (user.discord_id) {
          db.prepare(
            `INSERT INTO discord_role_sync
               (user_id, tier, reason, attempts, last_error, remove_role_id, updated_at)
             VALUES (?, NULL, 'plan_expired', 0, NULL, NULL, ?)
             ON CONFLICT(user_id) DO UPDATE SET tier = NULL, reason = 'plan_expired',
               attempts = 0, last_error = NULL, updated_at = excluded.updated_at`,
          ).run(user.id, now);
        }
        audit(user.id, "plan_expired", `${user.tier} / ${user.username}`);
      }
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }

  const discord = await flushDiscordRoleSync();
  return {
    expired: expired.length,
    discordSynced: discord.synced,
    discordPending: discord.pending,
  };
}
