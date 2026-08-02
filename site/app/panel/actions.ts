"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  checkAccount,
  isLockedOut,
  recordAttempt,
  revokeAllTokens,
  revokeClientTokens,
  verifyCredentials,
  LOCKOUT_SECONDS,
} from "@/lib/auth";
import { audit, getDb, nowSeconds } from "@/lib/db";
import {
  endSession,
  requireRole,
  requireUser,
  startSession,
  ROLES,
  type Role,
} from "@/lib/session";
import { hashPassword } from "@/lib/auth";
import crypto from "node:crypto";
import { promises as fs } from "fs";
import path from "path";
import {
  flushDiscordRoleSync,
  processExpiredPlans,
  queueDiscordRoleSync,
} from "@/lib/plan-expiry";
import { fetchDiscordGuildRoles } from "@/lib/discord";
import {
  PLAN_COVER_URL_PREFIX,
  ensurePlanCoversDirectory,
  planCoversDir,
} from "@/lib/storage-paths";

/**
 * Acoes do painel.
 *
 * Cada acao que muda estado revalida a permissao do seu lado. Esconder um
 * botao na interface nao e seguranca - o pedido pode ser forjado a mao.
 */

export async function loginAction(_prev: unknown, formData: FormData) {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const ip = "127.0.0.1"; // atras de proxy, ler x-forwarded-for

  if (!username || !password) {
    return { error: "Preenche utilizador e password." };
  }

  if (await isLockedOut(username, ip)) {
    return { error: `Demasiadas tentativas. Tenta daqui a ${LOCKOUT_SECONDS / 60} minutos.` };
  }

  const user = await verifyCredentials(username, password);
  if (!user) {
    recordAttempt(username, ip, false);
    audit(null, "panel_login_failed", username, ip);
    return { error: "Credenciais invalidas." };
  }

  const account = checkAccount(user);
  if (!account.ok) {
    recordAttempt(username, ip, false);
    return { error: account.reason! };
  }

  recordAttempt(username, ip, true);
  await startSession(user.id);
  audit(user.id, "panel_login_ok", null, ip);

  redirect("/panel");
}

export async function logoutAction() {
  await endSession();
  redirect("/panel/login");
}

/**
 * Gera a password que o cliente PowerShell usa.
 *
 * Quem entrou por Discord nao tem password nenhuma - o cliente Windows nao
 * consegue fazer OAuth num terminal, por isso precisa destas credenciais.
 * A password so e mostrada uma vez: guardamos apenas o hash.
 */
export async function generateClientPasswordAction() {
  const user = await requireUser();

  const alphabet = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let password = "";
  for (let i = 0; i < 16; i++) {
    password += alphabet[crypto.randomInt(alphabet.length)];
  }

  getDb()
    .prepare("UPDATE users SET password_hash = ?, client_password = ? WHERE id = ?")
    .run(hashPassword(password), password, user.id);

  audit(user.id, "client_password_generated", null);
  revalidatePath("/panel");

  return { username: user.username, password };
}

const SELF_HWID_RESET_COOLDOWN = 24 * 60 * 60;

export async function resetOwnHwidAction(): Promise<{
  ok: boolean;
  message: string;
}> {
  const user = await requireUser();
  const db = getDb();
  const now = nowSeconds();
  const previous = db
    .prepare(
      `SELECT created_at FROM audit_log
       WHERE user_id = ? AND action = 'self_hwid_reset'
       ORDER BY created_at DESC LIMIT 1`,
    )
    .get(user.id) as { created_at: number } | undefined;

  if (previous && previous.created_at + SELF_HWID_RESET_COOLDOWN > now) {
    const availableAt = new Date(
      (previous.created_at + SELF_HWID_RESET_COOLDOWN) * 1000,
    ).toLocaleString("pt-PT", { dateStyle: "short", timeStyle: "short" });
    return {
      ok: false,
      message: `Por seguranca, podes voltar a trocar de computador em ${availableAt}.`,
    };
  }

  const changed = db
    .prepare("UPDATE users SET hwid = NULL WHERE id = ? AND hwid IS NOT NULL")
    .run(user.id).changes;

  revokeClientTokens(user.id);
  if (changed > 0) audit(user.id, "self_hwid_reset", "device_unbound");
  revalidatePath("/panel");
  revalidatePath("/panel/dashboard");

  return {
    ok: true,
    message: changed > 0
      ? "Computador removido. Inicia sessao no novo PC para o associar."
      : "A licenca ja esta pronta para ser associada a um computador.",
  };
}

export async function setUserStatusAction(formData: FormData) {
  const actor = await requireRole("developer");
  const userId = Number(formData.get("userId"));
  const status = String(formData.get("status"));

  if (!["active", "suspended"].includes(status)) return;

  // Um developer nao pode suspender um owner - so alguem de nivel igual
  // ou superior mexe numa conta.
  const target = getDb().prepare("SELECT role FROM users WHERE id = ?").get(userId) as
    | { role: string }
    | undefined;
  if (!target) return;
  if (target.role === "owner" && actor.role !== "owner") return;
  if (userId === actor.id) return; // nao te suspendes a ti proprio

  getDb().prepare("UPDATE users SET status = ? WHERE id = ?").run(status, userId);
  if (status === "suspended") revokeAllTokens(userId);

  audit(actor.id, `panel_${status}`, `user #${userId}`);
  revalidatePath("/panel/admin/users");
}

/** Staff tambem faz isto: e a tarefa de suporte mais comum e nao destroi nada. */
export async function resetHwidAction(formData: FormData) {
  const actor = await requireRole("staff");
  const userId = Number(formData.get("userId"));

  getDb().prepare("UPDATE users SET hwid = NULL WHERE id = ?").run(userId);
  revokeClientTokens(userId);
  audit(actor.id, "panel_reset_hwid", `user #${userId}`);
  revalidatePath("/panel/admin/users");
}

// ====================================================== GESTAO DE CONTAS ==
// Tudo aqui e exclusivo do owner. Duas travas existem em todas as operacoes
// e nao sao negociaveis: nao te podes apagar nem despromover a ti proprio.
// Sem elas, um clique distraido deixa o painel sem ninguem que lhe aceda.

function assertNotSelfLockout(actorId: number, targetId: number, nextRole?: string): string | null {
  if (actorId !== targetId) return null;
  if (nextRole && nextRole !== "owner") return "Nao te podes retirar o papel de owner.";
  return null;
}

function supportWindow(supportDays: number | null, startedAt = nowSeconds()) {
  if (supportDays === null) {
    return { supportStartedAt: null, supportExpiresAt: null, supportLifetime: 0 };
  }
  return {
    supportStartedAt: startedAt,
    supportExpiresAt: supportDays === 0 ? null : startedAt + supportDays * 86400,
    supportLifetime: supportDays === 0 ? 1 : 0,
  };
}

export async function createUserAction(_prev: unknown, formData: FormData) {
  await requireRole("owner");

  const username = String(formData.get("username") ?? "").trim();
  const role = String(formData.get("role") ?? "member");
  const tier = String(formData.get("tier") ?? "");
  const days = Number(formData.get("days") ?? 0);
  const password = String(formData.get("password") ?? "").trim();

  if (!/^[a-zA-Z0-9._-]{3,32}$/.test(username)) {
    return { error: "Nome invalido: 3 a 32 caracteres, letras, numeros, . _ -" };
  }
  if (!ROLES.includes(role as Role)) {
    return { error: "Papel invalido." };
  }

  const db = getDb();
  if (db.prepare("SELECT id FROM users WHERE username = ?").get(username)) {
    return { error: `Ja existe uma conta chamada '${username}'.` };
  }

  const generated = password || randomPassword();
  const createdAt = nowSeconds();
  const expiresAt = days > 0 ? createdAt + days * 86400 : null;
  const plan = tier
    ? (db.prepare("SELECT support_days FROM plans WHERE code = ?").get(tier) as
        | { support_days: number | null }
        | undefined)
    : undefined;
  if (tier && !plan) return { error: "Plano invalido." };
  const support = supportWindow(plan?.support_days ?? null, createdAt);

  db.prepare(
    `INSERT INTO users
       (username, password_hash, client_password, role, role_source, tier, status, expires_at,
        support_started_at, support_expires_at, support_lifetime, created_at)
     VALUES (?, ?, ?, ?, 'manual', ?, 'active', ?, ?, ?, ?, ?)`,
  ).run(
    username,
    hashPassword(generated),
    generated,
    role,
    tier || null,
    expiresAt,
    support.supportStartedAt,
    support.supportExpiresAt,
    support.supportLifetime,
    createdAt,
  );

  const actor = await requireRole("owner");
  audit(actor.id, "panel_user_created", `${username} (${role})`);
  revalidatePath("/panel/admin/users");

  return { ok: true, username, password: generated };
}

export async function updateUserAction(formData: FormData) {
  const actor = await requireRole("owner");
  const userId = Number(formData.get("userId"));
  const role = String(formData.get("role"));
  const tier = String(formData.get("tier") ?? "");
  const status = String(formData.get("status"));

  if (!ROLES.includes(role as Role)) return;
  if (!["active", "suspended"].includes(status)) return;

  const lock = assertNotSelfLockout(actor.id, userId, role);
  if (lock) return;
  if (actor.id === userId && status !== "active") return;

  const db = getDb();
  const current = db.prepare("SELECT tier FROM users WHERE id = ?").get(userId) as
    | { tier: string | null }
    | undefined;
  if (!current) return;

  if ((tier || null) !== current.tier) {
    if (!tier) {
      db.prepare(
        `UPDATE users SET tier = NULL, tier_source = 'manual', expires_at = NULL,
         support_started_at = NULL,
         support_expires_at = NULL, support_lifetime = 0 WHERE id = ?`,
      ).run(userId);
      revokeClientTokens(userId);
      queueDiscordRoleSync(userId, null, "plan_cleared");
    } else {
      const plan = db.prepare("SELECT days, support_days FROM plans WHERE code = ?").get(tier) as
        | { days: number; support_days: number | null }
        | undefined;
      if (!plan) return;
      const assignedAt = nowSeconds();
      const support = supportWindow(plan.support_days, assignedAt);
      db.prepare(
        `UPDATE users SET tier = ?, tier_source = 'manual', expires_at = ?, support_started_at = ?,
         support_expires_at = ?, support_lifetime = ? WHERE id = ?`,
      ).run(
        tier,
        plan.days === 0 ? null : assignedAt + plan.days * 86400,
        support.supportStartedAt,
        support.supportExpiresAt,
        support.supportLifetime,
        userId,
      );
      queueDiscordRoleSync(userId, tier, "plan_assigned");
    }
  }

  // role_source='manual' impede o proximo login por Discord de reescrever
  // uma decisao tomada aqui a mao.
  const effectiveRole = role === "client" && !tier ? "member" : role === "member" && tier ? "client" : role;
  db.prepare("UPDATE users SET role = ?, status = ?, role_source = 'manual' WHERE id = ?")
    .run(effectiveRole, status, userId);

  if (status === "suspended") revokeAllTokens(userId);

  audit(actor.id, "panel_user_updated", `#${userId} -> ${role}/${tier || "sem plano"}/${status}`);
  await flushDiscordRoleSync();
  revalidatePath("/panel/admin/users");
  revalidatePath(`/panel/admin/users/${userId}`);
}

export async function assignPlanAction(formData: FormData) {
  const actor = await requireRole("owner");
  const userId = Number(formData.get("userId"));
  const planId = Number(formData.get("planId"));
  const mode = String(formData.get("mode"));

  const db = getDb();
  const target = db.prepare("SELECT id FROM users WHERE id = ?").get(userId) as
    | { id: number }
    | undefined;
  if (!target) return;

  if (mode === "clear") {
    db.prepare(
      `UPDATE users SET tier = NULL, tier_source = 'manual', expires_at = NULL,
       support_started_at = NULL, support_expires_at = NULL, support_lifetime = 0,
       role = CASE WHEN role = 'client' THEN 'member' ELSE role END WHERE id = ?`,
    ).run(userId);
    revokeClientTokens(userId);
    queueDiscordRoleSync(userId, null, "plan_cleared");
    audit(actor.id, "panel_plan_cleared", `user #${userId}`);
  } else {
    const plan = db
      .prepare("SELECT code, days, support_days FROM plans WHERE id = ?")
      .get(planId) as { code: string; days: number; support_days: number | null } | undefined;
    if (!plan) return;

    const assignedAt = nowSeconds();
    const expiresAt = plan.days === 0 ? null : assignedAt + plan.days * 86400;
    const support = supportWindow(plan.support_days, assignedAt);
    db.prepare(
      `UPDATE users SET tier = ?, tier_source = 'manual', expires_at = ?, support_started_at = ?,
       support_expires_at = ?, support_lifetime = ?, status = 'active',
       role = CASE WHEN role = 'member' THEN 'client' ELSE role END WHERE id = ?`,
    ).run(
      plan.code,
      expiresAt,
      support.supportStartedAt,
      support.supportExpiresAt,
      support.supportLifetime,
      userId,
    );
    queueDiscordRoleSync(userId, plan.code, "plan_assigned");
    audit(actor.id, "panel_plan_assigned", `user #${userId} -> ${plan.code}`);
  }

  await flushDiscordRoleSync();

  revalidatePath("/panel/admin/users");
  revalidatePath(`/panel/admin/users/${userId}`);
  revalidatePath("/panel");
}

/** Atribui ou retira licenca. days=0 remove; days<0 e rejeitado. */
export async function setLicenseAction(formData: FormData) {
  const actor = await requireRole("owner");
  const userId = Number(formData.get("userId"));
  const mode = String(formData.get("mode")); // add | set | clear
  const days = Number(formData.get("days") ?? 0);

  const db = getDb();
  const user = db.prepare("SELECT expires_at FROM users WHERE id = ?").get(userId) as
    | { expires_at: number | null }
    | undefined;
  if (!user) return;

  let next: number | null;
  if (mode === "clear") {
    next = null;
  } else if (mode === "add") {
    if (!Number.isFinite(days) || days <= 0) return;
    // Somar ao que resta, nao a partir de agora: senao estender uma licenca
    // ainda valida encurtava-a.
    const base = user.expires_at && user.expires_at > nowSeconds() ? user.expires_at : nowSeconds();
    next = base + days * 86400;
  } else {
    if (!Number.isFinite(days) || days <= 0) return;
    next = nowSeconds() + days * 86400;
  }

  db.prepare("UPDATE users SET expires_at = ? WHERE id = ?").run(next, userId);
  audit(actor.id, "panel_license_changed", `#${userId} ${mode} ${days}d`);

  revalidatePath("/panel/admin/users");
  revalidatePath(`/panel/admin/users/${userId}`);
}

export async function deleteUserAction(formData: FormData) {
  const actor = await requireRole("owner");
  const userId = Number(formData.get("userId"));

  if (actor.id === userId) return; // nunca a propria conta

  const db = getDb();
  db.prepare("DELETE FROM tokens WHERE user_id = ?").run(userId);
  db.prepare("DELETE FROM orders WHERE user_id = ?").run(userId);

  const u = db.prepare("SELECT username FROM users WHERE id = ?").get(userId) as
    | { username: string }
    | undefined;

  db.prepare("DELETE FROM users WHERE id = ?").run(userId);

  // As tentativas falhadas sao por nome, nao por id: sobreviviam a conta e
  // um nome reutilizado nascia bloqueado.
  if (u) db.prepare("DELETE FROM login_attempts WHERE username = ?").run(u.username);

  audit(actor.id, "panel_user_deleted", u?.username ?? `#${userId}`);
  redirect("/panel/admin/users");
}

export async function resetUserPasswordAction(_prev: unknown, formData: FormData) {
  const actor = await requireRole("owner");
  const userId = Number(formData.get("userId"));

  const password = randomPassword();
  getDb().prepare("UPDATE users SET password_hash = ?, client_password = ? WHERE id = ?").run(
    hashPassword(password),
    password,
    userId,
  );
  revokeAllTokens(userId);

  audit(actor.id, "panel_password_reset", `#${userId}`);
  return { password };
}

function randomPassword(len = 16): string {
  const alphabet = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < len; i++) s += alphabet[crypto.randomInt(alphabet.length)];
  return s;
}

/** Moderacao de avaliacoes: tarefa de staff. */
export async function setReviewApprovedAction(formData: FormData) {
  const actor = await requireRole("staff");
  const reviewId = Number(formData.get("reviewId"));
  const approved = formData.get("approved") === "1" ? 1 : 0;

  getDb().prepare("UPDATE reviews SET approved = ? WHERE id = ?").run(approved, reviewId);
  audit(actor.id, approved ? "review_approved" : "review_hidden", `#${reviewId}`);

  revalidatePath("/panel/admin/reviews");
  revalidatePath("/"); // a home mostra as avaliacoes publicadas
}

/** Precos, duracoes e visibilidade dos planos: territorio do owner. */
function planDays(formData: FormData): number {
  if (formData.get("durationType") === "lifetime") return 0;
  const days = Number(formData.get("days"));
  return days > 0 ? days : Number.NaN;
}

function planSupportDays(formData: FormData): number | null {
  const type = formData.get("supportType");
  if (type === "none") return null;
  if (type === "lifetime") return 0;
  const days = Number(formData.get("supportDays"));
  return days > 0 ? days : Number.NaN;
}

function planDiscordRoleId(formData: FormData): string | null | undefined {
  const roleId = String(formData.get("discordRoleId") ?? "").trim();
  if (!roleId) return null;
  return /^\d{15,25}$/.test(roleId) ? roleId : undefined;
}

function planMarketing(formData: FormData, priceCents: number) {
  const badgeText = String(formData.get("badgeText") ?? "").trim().slice(0, 40);
  const badgeActive = formData.get("badgeActive") === "1" && badgeText ? 1 : 0;
  const promoText = String(formData.get("promoText") ?? "").trim().slice(0, 80);
  const discountRequested = formData.get("discountActive") === "1";
  const compareRaw = String(formData.get("compareAtPrice") ?? "").trim().replace(",", ".");
  const compareEuros = compareRaw ? Number(compareRaw) : Number.NaN;
  const compareAtCents = Number.isFinite(compareEuros) && compareEuros >= 0
    ? Math.round(compareEuros * 100)
    : null;
  const valid = !discountRequested || (
    compareAtCents !== null &&
    compareAtCents > priceCents
  );

  return {
    valid,
    badgeText: badgeText || null,
    badgeActive,
    compareAtCents,
    discountActive: discountRequested ? 1 : 0,
    promoText: promoText || null,
  };
}

function planPublicContent(formData: FormData) {
  const features = String(formData.get("features") ?? "")
    .split(/\r?\n/)
    .map((feature) => feature.trim())
    .filter(Boolean)
    .slice(0, 12)
    .map((feature) => feature.slice(0, 100));
  const ctaText = String(formData.get("ctaText") ?? "").trim().slice(0, 32);

  return {
    valid: features.length > 0 && Boolean(ctaText),
    featuresJson: JSON.stringify(features),
    ctaText,
  };
}

async function isAssignableDiscordRole(roleId: string): Promise<boolean> {
  try {
    return (await fetchDiscordGuildRoles()).some(
      (role) => role.id === roleId && role.assignable,
    );
  } catch {
    return false;
  }
}

const PLAN_COVER_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
};

async function savePlanCover(formData: FormData): Promise<string | undefined> {
  const cover = formData.get("cover");
  if (!(cover instanceof File) || cover.size === 0) return undefined;

  const extension = PLAN_COVER_TYPES[cover.type];
  if (!extension || cover.size > 5 * 1024 * 1024) return undefined;

  const bytes = Buffer.from(await cover.arrayBuffer());
  const valid =
    (cover.type === "image/jpeg" && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) ||
    (cover.type === "image/png" && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) ||
    (cover.type === "image/webp" && bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP") ||
    (cover.type === "image/avif" && bytes.subarray(4, 12).toString("ascii").startsWith("ftypavi"));
  if (!valid) return undefined;

  ensurePlanCoversDirectory();

  const filename = `${Date.now()}-${crypto.randomUUID()}.${extension}`;
  await fs.writeFile(path.join(planCoversDir, filename), bytes);
  return `${PLAN_COVER_URL_PREFIX}/${filename}`;
}

async function removePlanCoverFile(coverUrl: string | null): Promise<void> {
  if (!coverUrl || !/^\/uploads\/plans\/[a-zA-Z0-9._-]+$/.test(coverUrl)) return;
  const filename = path.basename(coverUrl);
  try {
    await fs.unlink(path.join(planCoversDir, filename));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}

export async function updatePlanAction(formData: FormData) {
  const actor = await requireRole("owner");
  const planId = Number(formData.get("planId"));

  const code = String(formData.get("code") ?? "").trim().toLowerCase();
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const priceEuros = Number(String(formData.get("price")).replace(",", "."));
  const priceCents = Math.round(priceEuros * 100);
  const marketing = planMarketing(formData, priceCents);
  const publicContent = planPublicContent(formData);
  const days = planDays(formData);
  const supportDays = planSupportDays(formData);
  const discordRoleId = planDiscordRoleId(formData);
  const active = formData.get("active") === "1" ? 1 : 0;
  const sortOrder = Number(formData.get("sortOrder") ?? 0);

  if (
    !/^[a-z0-9._-]{2,32}$/.test(code) ||
    !name ||
    !Number.isFinite(priceEuros) ||
    priceEuros < 0 ||
    !marketing.valid ||
    !publicContent.valid ||
    !Number.isFinite(days) ||
    days < 0 ||
    (supportDays !== null && (!Number.isFinite(supportDays) || supportDays < 0)) ||
    discordRoleId === undefined ||
    !Number.isFinite(sortOrder)
  ) {
    return;
  }

  const db = getDb();
  const current = db
    .prepare("SELECT code, cover_url, discord_role_id FROM plans WHERE id = ?")
    .get(planId) as {
      code: string;
      cover_url: string | null;
      discord_role_id: string | null;
    } | undefined;
  if (!current) return;

  if (discordRoleId) {
    const duplicate = db
      .prepare("SELECT id FROM plans WHERE discord_role_id = ? AND id <> ?")
      .get(discordRoleId, planId);
    if (duplicate) return;
    if (discordRoleId !== current.discord_role_id) {
      if (!(await isAssignableDiscordRole(discordRoleId))) return;
    }
  }

  const uploadedCover = await savePlanCover(formData);
  const coverUrl = uploadedCover ?? (formData.get("removeCover") === "1" ? null : current.cover_url);

  db
    .prepare(
      `UPDATE plans
       SET code = ?, name = ?, description = ?, price_cents = ?, days = ?, support_days = ?, active = ?, sort_order = ?, cover_url = ?, discord_role_id = ?,
           badge_text = ?, badge_active = ?, compare_at_cents = ?, discount_active = ?, promo_text = ?, features_json = ?, cta_text = ?
       WHERE id = ?`,
    )
    .run(
      code,
      name,
      description || null,
      priceCents,
      Math.round(days),
      supportDays === null ? null : Math.round(supportDays),
      active,
      Math.round(sortOrder),
      coverUrl,
      discordRoleId,
      marketing.badgeText,
      marketing.badgeActive,
      marketing.compareAtCents,
      marketing.discountActive,
      marketing.promoText,
      publicContent.featuresJson,
      publicContent.ctaText,
      planId,
    );

  if (current.code !== code) {
    db.prepare("UPDATE users SET tier = ? WHERE tier = ?").run(code, current.code);
    db.prepare("UPDATE discord_role_sync SET tier = ? WHERE tier = ?").run(code, current.code);
  }

  if (current.discord_role_id !== discordRoleId || current.code !== code) {
    const users = db
      .prepare("SELECT id FROM users WHERE tier = ? AND discord_id IS NOT NULL")
      .all(code) as Array<{ id: number }>;
    for (const user of users) {
      queueDiscordRoleSync(
        user.id,
        code,
        "plan_discord_role_updated",
        current.discord_role_id,
      );
    }
    await flushDiscordRoleSync();
  }

  if (current.cover_url !== coverUrl) await removePlanCoverFile(current.cover_url);

  audit(
    actor.id,
    "plan_updated",
    `#${planId} -> ${priceEuros} EUR / ${days === 0 ? "life-time" : `${days} dias`}`,
  );

  revalidatePath("/panel/admin/plans");
  revalidatePath("/");
}

export async function createPlanAction(formData: FormData) {
  const actor = await requireRole("owner");
  const code = String(formData.get("code") ?? "").trim().toLowerCase();
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const priceEuros = Number(String(formData.get("price")).replace(",", "."));
  const priceCents = Math.round(priceEuros * 100);
  const marketing = planMarketing(formData, priceCents);
  const publicContent = planPublicContent(formData);
  const days = planDays(formData);
  const supportDays = planSupportDays(formData);
  const discordRoleId = planDiscordRoleId(formData);
  const active = formData.get("active") === "1" ? 1 : 0;
  const sortOrder = Number(formData.get("sortOrder") ?? 0);

  if (
    !/^[a-z0-9._-]{2,32}$/.test(code) ||
    !name ||
    !Number.isFinite(priceEuros) ||
    priceEuros < 0 ||
    !marketing.valid ||
    !publicContent.valid ||
    !Number.isFinite(days) ||
    days < 0 ||
    (supportDays !== null && (!Number.isFinite(supportDays) || supportDays < 0)) ||
    discordRoleId === undefined ||
    !Number.isFinite(sortOrder)
  ) {
    return;
  }

  if (discordRoleId && getDb().prepare("SELECT id FROM plans WHERE discord_role_id = ?").get(discordRoleId)) {
    return;
  }
  if (discordRoleId) {
    if (!(await isAssignableDiscordRole(discordRoleId))) return;
  }
  const coverUrl = (await savePlanCover(formData)) ?? null;

  getDb()
    .prepare(
      `INSERT INTO plans (code, name, description, price_cents, currency, days, support_days, active, sort_order, cover_url, discord_role_id,
                          badge_text, badge_active, compare_at_cents, discount_active, promo_text, features_json, cta_text)
       VALUES (?, ?, ?, ?, 'EUR', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      code,
      name,
      description || null,
      priceCents,
      Math.round(days),
      supportDays === null ? null : Math.round(supportDays),
      active,
      Math.round(sortOrder),
      coverUrl,
      discordRoleId,
      marketing.badgeText,
      marketing.badgeActive,
      marketing.compareAtCents,
      marketing.discountActive,
      marketing.promoText,
      publicContent.featuresJson,
      publicContent.ctaText,
    );

  audit(actor.id, "plan_created", code);
  revalidatePath("/panel/admin/plans");
  revalidatePath("/");
}

export async function deletePlanAction(formData: FormData) {
  const actor = await requireRole("owner");
  const planId = Number(formData.get("planId"));
  const db = getDb();
  const plan = db
    .prepare(
      `SELECT p.cover_url, COUNT(o.id) AS orders
       FROM plans p LEFT JOIN orders o ON o.plan_id = p.id
       WHERE p.id = ? GROUP BY p.id`,
    )
    .get(planId) as { cover_url: string | null; orders: number } | undefined;
  if (!plan) return;

  if (plan.orders > 0) {
    db.prepare("UPDATE plans SET active = 0 WHERE id = ?").run(planId);
    audit(actor.id, "plan_deactivated_instead_of_deleted", `#${planId}`);
  } else {
    db.prepare("DELETE FROM plans WHERE id = ?").run(planId);
    await removePlanCoverFile(plan.cover_url);
    audit(actor.id, "plan_deleted", `#${planId}`);
  }

  revalidatePath("/panel/admin/plans");
  revalidatePath("/");
}

export async function refundOrderAction(formData: FormData) {
  const actor = await requireRole("owner"); // so o dono reembolsa
  const orderId = Number(formData.get("orderId"));
  const db = getDb();

  const order = db
    .prepare(
      `SELECT o.*, p.days AS plan_days, p.support_days AS plan_support_days FROM orders o
       JOIN plans p ON p.id = o.plan_id WHERE o.id = ?`,
    )
    .get(orderId) as {
      id: number;
      user_id: number;
      status: string;
      plan_days: number;
      plan_support_days: number | null;
    } | undefined;

  if (!order || order.status !== "paid") return;

  db.prepare("UPDATE orders SET status = 'refunded', refunded_at = ? WHERE id = ?").run(
    nowSeconds(),
    orderId,
  );

  // Retirar o tempo que a encomenda tinha dado, sem nunca pos-datar para tras
  // de agora (senao um reembolso antigo expirava uma licenca ainda paga).
  const u = db.prepare("SELECT expires_at FROM users WHERE id = ?").get(order.user_id) as {
    expires_at: number | null;
  };
  if (u?.expires_at) {
    const reduced = u.expires_at - order.plan_days * 86400;
    db.prepare("UPDATE users SET expires_at = ? WHERE id = ?").run(
      Math.max(reduced, nowSeconds()),
      order.user_id,
    );
  }

  if (order.plan_support_days === 0) {
    db.prepare(
      `UPDATE users SET support_started_at = NULL, support_expires_at = NULL,
       support_lifetime = 0 WHERE id = ?`,
    ).run(order.user_id);
  } else if (order.plan_support_days !== null) {
    const support = db.prepare("SELECT support_expires_at FROM users WHERE id = ?").get(
      order.user_id,
    ) as { support_expires_at: number | null } | undefined;
    if (support?.support_expires_at) {
      db.prepare("UPDATE users SET support_expires_at = ? WHERE id = ?").run(
        Math.max(support.support_expires_at - order.plan_support_days * 86400, nowSeconds()),
        order.user_id,
      );
    }
  }

  audit(actor.id, "panel_refund", `encomenda #${orderId}`);
  await processExpiredPlans();
  revalidatePath("/panel/admin/orders");
  revalidatePath("/panel/admin");
}
