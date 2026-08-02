import { avatarUrl } from "@/lib/discord";
import { bearerToken, nowSeconds, userFromToken } from "@/lib/auth";
import { firestore } from "@/lib/firebase-admin";
import { readCatalog } from "@/lib/catalog";
import { filterTweaksForUser, isTweakEnabled, minimumTierForTweak } from "@/lib/optimizer-access";
import { listActiveOptimizations } from "@/lib/repo/active-optimizations";
import { recentAudit } from "@/lib/repo/audit";
import { listAllOrders } from "@/lib/repo/orders";
import { activeUserIds } from "@/lib/repo/tokens";
import { COLLECTIONS, type AuditEntry, type LoginAttempt, type Token, type UserProfile } from "@/lib/repo/types";
import { countUsers, listProfiles } from "@/lib/repo/users";
import { fail, ok } from "../../_lib/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const INTERNAL_ROLES = new Set(["staff", "developer", "owner"]);
const DAY = 86400;

async function countFailedLogins(since: number): Promise<number> {
  const snap = await firestore()
    .collection(COLLECTIONS.attempts)
    .where("success", "==", 0)
    .get();
  return snap.docs.filter((doc) => (doc.data() as LoginAttempt).created_at >= since).length;
}

async function tokenSeen(kind: "api" | "web", now: number): Promise<Map<number, number>> {
  const snap = await firestore()
    .collection(COLLECTIONS.tokens)
    .where("kind", "==", kind)
    .get();
  const seen = new Map<number, number>();
  for (const doc of snap.docs) {
    const token = doc.data() as Token;
    if (token.expires_at <= now) continue;
    seen.set(token.user_id, Math.max(seen.get(token.user_id) ?? 0, token.last_seen_at ?? 0));
  }
  return seen;
}

function actionCounts(entries: AuditEntry[], since: number): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const entry of entries) {
    if (entry.created_at < since) continue;
    counts[entry.action] = (counts[entry.action] ?? 0) + 1;
  }
  return counts;
}

export async function GET(req: Request) {
  const actor = await userFromToken(bearerToken(req));
  if (!actor) return fail("Sessao invalida ou expirada.", 401, "invalid_token");
  if (!INTERNAL_ROLES.has(actor.role)) {
    return fail("Sem permissao para consultar a operacao Orion.", 403, "forbidden");
  }

  const now = nowSeconds();
  const onlineSince = now - 5 * 60;
  const since24h = now - DAY;
  const since30d = now - 30 * DAY;

  const [users, totalUsers, siteOnlineIds, optimizerOnlineIds, siteSeen, optimizerSeen, audit, orders] =
    await Promise.all([
      listProfiles(1000),
      countUsers(),
      activeUserIds("web", onlineSince),
      activeUserIds("api", onlineSince),
      tokenSeen("web", now),
      tokenSeen("api", now),
      recentAudit(300),
      listAllOrders(2000),
    ]);

  const counts = actionCounts(audit, since24h);
  const paidOrders30 = orders.filter((order) => order.status === "paid" && (order.paid_at ?? 0) >= since30d);
  const activeLicenses = users.filter((user) =>
    user.status === "active" &&
    (user.tier !== null || user.expires_at !== null) &&
    (user.expires_at === null || user.expires_at > now)
  ).length;

  const activeCatalog = readCatalog().tweaks.filter(isTweakEnabled);
  const usersById = new Map(users.map((user) => [user.id, user]));
  const lastActivity = new Map<number, number>();
  for (const entry of audit) {
    if (entry.user_id === null) continue;
    lastActivity.set(entry.user_id, Math.max(lastActivity.get(entry.user_id) ?? 0, entry.created_at));
  }

  const peopleBase = users
    .map((user) => ({
      user,
      siteSeenAt: siteSeen.get(user.id) ?? null,
      optimizerSeenAt: optimizerSeen.get(user.id) ?? user.client_seen_at ?? null,
      lastActivityAt: lastActivity.get(user.id) ?? null,
    }))
    .sort((a, b) =>
      Math.max(b.siteSeenAt ?? 0, b.optimizerSeenAt ?? 0, b.lastActivityAt ?? 0, b.user.created_at) -
      Math.max(a.siteSeenAt ?? 0, a.optimizerSeenAt ?? 0, a.lastActivityAt ?? 0, a.user.created_at)
    )
    .slice(0, 24);

  const people = await Promise.all(peopleBase.map(async ({ user, siteSeenAt, optimizerSeenAt, lastActivityAt }) => {
    const availableTweaks = filterTweaksForUser(user, activeCatalog).map((tweak) => ({
      id: tweak.id,
      name: tweak.name,
      category: tweak.id.split(".")[0] || "system",
      tier: minimumTierForTweak(tweak),
      requiresReboot: tweak.requiresReboot,
    }));
    const activeTweaks = (await listActiveOptimizations(user.id)).map((item) => ({
      id: item.id,
      tweakId: item.tweak_id,
      name: item.name,
      category: item.category,
      appliedAt: item.applied_at,
      machine: item.machine_chassis || item.machine_gpu
        ? [item.machine_chassis, item.machine_gpu].filter(Boolean).join(" · ")
        : item.machine_hwid,
      clientVersion: item.client_version,
    }));

    return {
      id: user.id,
      username: user.username,
      displayName: user.discord_username ?? user.username,
      avatarUrl: user.discord_id ? avatarUrl(user.discord_id, user.discord_avatar) : null,
      role: user.role,
      tier: user.tier,
      status: user.status,
      clientVersion: user.client_version,
      clientSeenAt: user.client_seen_at,
      siteSeenAt,
      optimizerSeenAt,
      siteOnline: siteOnlineIds.has(user.id),
      optimizerOnline: optimizerOnlineIds.has(user.id) || (user.client_seen_at ?? 0) >= onlineSince,
      lastActivityAt,
      availableOptimizations: availableTweaks,
      activeOptimizations: activeTweaks,
    };
  }));

  const usageKeys = new Set([
    "catalog_served",
    "optimizer_previewed",
    "optimizer_applied",
    "optimizer_rolled_back",
    "login_ok",
    "panel_login_ok",
  ]);
  const usage = Object.entries(counts)
    .filter(([action]) => usageKeys.has(action))
    .map(([action, count]) => ({ action, count }))
    .sort((a, b) => b.count - a.count);

  const versionCounts = new Map<string, number>();
  for (const user of users) {
    if (!user.client_seen_at) continue;
    const version = user.client_version ?? "Sem versao";
    versionCounts.set(version, (versionCounts.get(version) ?? 0) + 1);
  }

  return ok({
    generatedAt: now,
    onlineWindowSeconds: 300,
    metrics: {
      users: totalUsers,
      activeLicenses,
      onlineSite: siteOnlineIds.size,
      onlineOptimizer: optimizerOnlineIds.size,
      failedLogins24h: await countFailedLogins(since24h),
      optimizerActions24h:
        (counts.optimizer_previewed ?? 0) +
        (counts.optimizer_applied ?? 0) +
        (counts.optimizer_rolled_back ?? 0),
      catalogRequests24h: counts.catalog_served ?? 0,
      revenue30Cents: actor.role === "owner"
        ? paidOrders30.reduce((sum, order) => sum + order.amount_cents, 0)
        : null,
    },
    people,
    activity: audit.slice(0, 30).map((entry, index) => {
      const user = entry.user_id === null ? null : usersById.get(entry.user_id);
      return {
        id: index + 1,
        action: entry.action,
        detail: entry.detail,
        createdAt: entry.created_at,
        userId: entry.user_id,
        username: user?.discord_username ?? user?.username ?? "Sistema",
      };
    }),
    usage,
    versions: [...versionCounts.entries()]
      .map(([version, count]) => ({ version, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8),
  });
}
