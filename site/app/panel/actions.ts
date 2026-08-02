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
import { audit, lastAuditFor } from "@/lib/repo/audit";
import { setReviewApproved } from "@/lib/repo/reviews";
// Vem do repositorio de tokens e nao do db.ts: e a mesma funcao de sempre,
// so que sem arrastar o node:sqlite atras dela.
import { nowSeconds } from "@/lib/repo/tokens";
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
import { allPlans, createPlan, deletePlan, findPlanByCode, findPlanById, updatePlan } from "@/lib/repo/plans";
import { findOrder, listAllOrders, updateOrder } from "@/lib/repo/orders";
import { createCoupon, normalizeCouponCode, updateCoupon } from "@/lib/repo/coupons";
import { optimizerRelease } from "@/lib/optimizer-release";
import { SEMVER, compareVersions } from "@/lib/version";
import { updateAppVersionTarget } from "@/lib/repo/app-versions";
import {
  createUser as createRepoUser,
  deleteUser as deleteRepoUser,
  findById as findRepoUserById,
  findProfileByUsername,
  setCredentials,
  updateProfile,
} from "@/lib/repo/users";

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

  await setCredentials(user.id, {
    password_hash: hashPassword(password),
    client_password: password,
  });

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
  const now = Math.floor(Date.now() / 1000);
  const previous = await lastAuditFor(user.id, "self_hwid_reset");

  if (previous && previous.created_at + SELF_HWID_RESET_COOLDOWN > now) {
    const availableAt = new Date(
      (previous.created_at + SELF_HWID_RESET_COOLDOWN) * 1000,
    ).toLocaleString("pt-PT", { dateStyle: "short", timeStyle: "short" });
    return {
      ok: false,
      message: `Por seguranca, podes voltar a trocar de computador em ${availableAt}.`,
    };
  }

  const changed = user.hwid ? 1 : 0;
  await updateProfile(user.id, { hwid: null });

  await revokeClientTokens(user.id);
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
  const target = await findRepoUserById(userId);
  if (!target) return;
  if (target.role === "owner" && actor.role !== "owner") return;
  if (userId === actor.id) return; // nao te suspendes a ti proprio

  await updateProfile(userId, { status });
  if (status === "suspended") await revokeAllTokens(userId);

  audit(actor.id, `panel_${status}`, `user #${userId}`);
  revalidatePath("/panel/admin/users");
}

/** Staff tambem faz isto: e a tarefa de suporte mais comum e nao destroi nada. */
export async function resetHwidAction(formData: FormData) {
  const actor = await requireRole("staff");
  const userId = Number(formData.get("userId"));

  await updateProfile(userId, { hwid: null });
  await revokeClientTokens(userId);
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

  if (await findProfileByUsername(username)) {
    return { error: `Ja existe uma conta chamada '${username}'.` };
  }

  const generated = password || randomPassword();
  const createdAt = nowSeconds();
  const expiresAt = days > 0 ? createdAt + days * 86400 : null;
  const plan = tier ? await findPlanByCode(tier) : undefined;
  if (tier && !plan) return { error: "Plano invalido." };
  const support = supportWindow(plan?.support_days ?? null, createdAt);

  await createRepoUser(
    {
      username,
      role: role as Role,
      role_source: "manual",
      tier: tier || null,
      tier_source: "manual",
      status: "active",
      expires_at: expiresAt,
      support_started_at: support.supportStartedAt,
      support_expires_at: support.supportExpiresAt,
      support_lifetime: support.supportLifetime,
      created_at: createdAt,
    },
    { password_hash: hashPassword(generated), client_password: generated },
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

  const current = await findRepoUserById(userId);
  if (!current) return;

  let profilePatch: Parameters<typeof updateProfile>[1] = {};
  if ((tier || null) !== current.tier) {
    if (!tier) {
      profilePatch = {
        tier: null,
        tier_source: "manual",
        expires_at: null,
        support_started_at: null,
        support_expires_at: null,
        support_lifetime: 0,
      };
      await revokeClientTokens(userId);
      await queueDiscordRoleSync(userId, null, "plan_cleared");
    } else {
      const plan = await findPlanByCode(tier);
      if (!plan) return;
      const assignedAt = nowSeconds();
      const support = supportWindow(plan.support_days, assignedAt);
      profilePatch = {
        tier,
        tier_source: "manual",
        expires_at: plan.days === 0 ? null : assignedAt + plan.days * 86400,
        support_started_at: support.supportStartedAt,
        support_expires_at: support.supportExpiresAt,
        support_lifetime: support.supportLifetime,
      };
      await queueDiscordRoleSync(userId, tier, "plan_assigned");
    }
  }

  // role_source='manual' impede o proximo login por Discord de reescrever
  // uma decisao tomada aqui a mao.
  const effectiveRole = role === "client" && !tier ? "member" : role === "member" && tier ? "client" : role;
  await updateProfile(userId, {
    ...profilePatch,
    role: effectiveRole as Role,
    status,
    role_source: "manual",
  });

  if (status === "suspended") await revokeAllTokens(userId);

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

  const target = await findRepoUserById(userId);
  if (!target) return;

  if (mode === "clear") {
    await updateProfile(userId, {
      tier: null,
      tier_source: "manual",
      expires_at: null,
      support_started_at: null,
      support_expires_at: null,
      support_lifetime: 0,
      role: target.role === "client" ? "member" : target.role,
    });
    await revokeClientTokens(userId);
    await queueDiscordRoleSync(userId, null, "plan_cleared");
    audit(actor.id, "panel_plan_cleared", `user #${userId}`);
  } else {
    const plan = await findPlanById(planId);
    if (!plan) return;

    const assignedAt = nowSeconds();
    const expiresAt = plan.days === 0 ? null : assignedAt + plan.days * 86400;
    const support = supportWindow(plan.support_days, assignedAt);
    await updateProfile(userId, {
      tier: plan.code,
      tier_source: "manual",
      expires_at: expiresAt,
      support_started_at: support.supportStartedAt,
      support_expires_at: support.supportExpiresAt,
      support_lifetime: support.supportLifetime,
      status: "active",
      role: target.role === "member" ? "client" : target.role,
    });
    await queueDiscordRoleSync(userId, plan.code, "plan_assigned");
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

  const user = await findRepoUserById(userId);
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

  await updateProfile(userId, { expires_at: next });
  audit(actor.id, "panel_license_changed", `#${userId} ${mode} ${days}d`);

  revalidatePath("/panel/admin/users");
  revalidatePath(`/panel/admin/users/${userId}`);
}

export async function deleteUserAction(formData: FormData) {
  const actor = await requireRole("owner");
  const userId = Number(formData.get("userId"));

  if (actor.id === userId) return; // nunca a propria conta

  const u = await findRepoUserById(userId);
  await revokeAllTokens(userId);
  await deleteRepoUser(userId);

  audit(actor.id, "panel_user_deleted", u?.username ?? `#${userId}`);
  redirect("/panel/admin/users");
}

export async function resetUserPasswordAction(_prev: unknown, formData: FormData) {
  const actor = await requireRole("owner");
  const userId = Number(formData.get("userId"));

  const password = randomPassword();
  await setCredentials(userId, {
    password_hash: hashPassword(password),
    client_password: password,
  });
  await revokeAllTokens(userId);

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

  await setReviewApproved(reviewId, approved === 1);
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

  const current = await findPlanById(planId);
  if (!current) return;

  if (discordRoleId) {
    const duplicate = (await allPlans()).find(
      (plan) => plan.discord_role_id === discordRoleId && plan.id !== planId,
    );
    if (duplicate) return;
    if (discordRoleId !== current.discord_role_id) {
      if (!(await isAssignableDiscordRole(discordRoleId))) return;
    }
  }

  const uploadedCover = await savePlanCover(formData);
  const coverUrl = uploadedCover ?? (formData.get("removeCover") === "1" ? null : current.cover_url);

  await updatePlan(planId, {
      code,
      name,
      description: description || null,
      price_cents: priceCents,
      days: Math.round(days),
      support_days: supportDays === null ? null : Math.round(supportDays),
      active,
      sort_order: Math.round(sortOrder),
      cover_url: coverUrl,
      discord_role_id: discordRoleId,
      badge_text: marketing.badgeText,
      badge_active: marketing.badgeActive,
      compare_at_cents: marketing.compareAtCents,
      discount_active: marketing.discountActive,
      promo_text: marketing.promoText,
      features_json: publicContent.featuresJson,
      cta_text: publicContent.ctaText,
    });

  if (current.code !== code) {
    // Planos renomeados nao sao migrados em massa automaticamente: evita
    // tocar em todos os clientes por engano. Atribui de novo a quem precisar.
  }

  if (current.discord_role_id !== discordRoleId || current.code !== code) {
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

  if (discordRoleId && (await allPlans()).some((plan) => plan.discord_role_id === discordRoleId)) {
    return;
  }
  if (discordRoleId) {
    if (!(await isAssignableDiscordRole(discordRoleId))) return;
  }
  const coverUrl = (await savePlanCover(formData)) ?? null;

  await createPlan({
      code,
      name,
      description: description || null,
      price_cents: priceCents,
      currency: "EUR",
      days: Math.round(days),
      support_days: supportDays === null ? null : Math.round(supportDays),
      active,
      sort_order: Math.round(sortOrder),
      cover_url: coverUrl,
      discord_role_id: discordRoleId,
      badge_text: marketing.badgeText,
      badge_active: marketing.badgeActive,
      compare_at_cents: marketing.compareAtCents,
      discount_active: marketing.discountActive,
      promo_text: marketing.promoText,
      features_json: publicContent.featuresJson,
      cta_text: publicContent.ctaText,
    });

  audit(actor.id, "plan_created", code);
  revalidatePath("/panel/admin/plans");
  revalidatePath("/");
}

export async function deletePlanAction(formData: FormData) {
  const actor = await requireRole("owner");
  const planId = Number(formData.get("planId"));
  const plan = await findPlanById(planId);
  if (!plan) return;
  const orders = (await listAllOrders()).filter((order) => order.plan_id === planId).length;

  if (orders > 0) {
    await updatePlan(planId, { active: 0 });
    audit(actor.id, "plan_deactivated_instead_of_deleted", `#${planId}`);
  } else {
    await deletePlan(planId);
    await removePlanCoverFile(plan.cover_url);
    audit(actor.id, "plan_deleted", `#${planId}`);
  }

  revalidatePath("/panel/admin/plans");
  revalidatePath("/");
}

export async function reorderPlansAction(formData: FormData) {
  const actor = await requireRole("owner");
  const raw = String(formData.get("order") ?? "");
  const ids = raw
    .split(",")
    .map((id) => Number(id))
    .filter((id) => Number.isFinite(id) && id > 0);

  if (!ids.length) return;

  await Promise.all(
    ids.map((id, index) => updatePlan(id, { sort_order: index + 1 })),
  );

  audit(actor.id, "plans_reordered", ids.join(","));
  revalidatePath("/panel/admin/plans");
  revalidatePath("/");
}

export async function updatePlanVersionAction(formData: FormData) {
  const actor = await requireRole("owner");
  const planId = Number(formData.get("planId"));
  const appVersion = String(formData.get("appVersion") ?? "").trim();
  const minSupported = String(formData.get("appMinSupported") ?? "").trim();

  if (!Number.isFinite(planId)) return;
  if (appVersion && !SEMVER.test(appVersion)) return;
  if (minSupported && !SEMVER.test(minSupported)) return;
  if (appVersion && minSupported && compareVersions(minSupported, appVersion) > 0) {
    return;
  }

  const plan = await findPlanById(planId);
  if (!plan) return;

  await updatePlan(planId, {
    app_version: appVersion || null,
    app_min_supported: minSupported || null,
  });
  audit(actor.id, "plan_version_updated", `${plan.code} -> ${appVersion || "global"}`);
  revalidatePath("/panel/admin/versions");
  revalidatePath("/panel/dashboard");
}

export async function releaseCurrentVersionForAllPlansAction() {
  const actor = await requireRole("owner");
  const release = optimizerRelease();
  const plans = await allPlans();

  await Promise.all(plans.map((plan) => updatePlan(plan.id, {
    app_version: release.version,
    app_min_supported: release.minSupported ?? null,
  })));

  audit(actor.id, "app_version_released_all_plans", release.version);
  revalidatePath("/panel/admin/versions");
  revalidatePath("/panel/dashboard");
}

export async function updateRoleVersionAction(formData: FormData) {
  const actor = await requireRole("owner");
  const target = String(formData.get("target") ?? "");
  const appVersion = String(formData.get("appVersion") ?? "").trim();
  const minSupported = String(formData.get("appMinSupported") ?? "").trim();
  const allowed = new Map([
    ["role:staff", "Staff"],
    ["role:developer", "Developer"],
  ]);

  if (!allowed.has(target)) return;
  if (appVersion && !SEMVER.test(appVersion)) return;
  if (minSupported && !SEMVER.test(minSupported)) return;
  if (appVersion && minSupported && compareVersions(minSupported, appVersion) > 0) return;
  if (target === "role:developer") {
    if (formData.get("confirmDeveloper") !== "1" || formData.get("confirmDeveloperAgain") !== "1") return;
  }

  await updateAppVersionTarget(target, {
    label: allowed.get(target)!,
    app_version: appVersion || null,
    app_min_supported: minSupported || null,
  });
  audit(actor.id, "role_version_updated", `${target} -> ${appVersion || "global"}`);
  revalidatePath("/panel/admin/versions");
  revalidatePath("/panel/dashboard");
}

export async function refundOrderAction(formData: FormData) {
  const actor = await requireRole("owner"); // so o dono reembolsa
  const orderId = Number(formData.get("orderId"));

  const order = await findOrder(orderId);
  const plan = order ? await findPlanById(order.plan_id) : null;

  if (!order || !plan || order.status !== "paid") return;

  await updateOrder(orderId, { status: "refunded", refunded_at: nowSeconds() });

  // Retirar o tempo que a encomenda tinha dado, sem nunca pos-datar para tras
  // de agora (senao um reembolso antigo expirava uma licenca ainda paga).
  const u = await findRepoUserById(order.user_id);
  if (u?.expires_at) {
    const reduced = u.expires_at - plan.days * 86400;
    await updateProfile(order.user_id, {
      expires_at: Math.max(reduced, nowSeconds()),
    });
  }

  if (plan.support_days === 0) {
    await updateProfile(order.user_id, {
      support_started_at: null,
      support_expires_at: null,
      support_lifetime: 0,
    });
  } else if (plan.support_days !== null && u?.support_expires_at) {
      await updateProfile(order.user_id, {
        support_expires_at: Math.max(u.support_expires_at - plan.support_days * 86400, nowSeconds()),
      });
    }

  audit(actor.id, "panel_refund", `encomenda #${orderId}`);
  await processExpiredPlans();
  revalidatePath("/panel/admin/orders");
  revalidatePath("/panel/admin");
}

export async function createCouponAction(_prev: unknown, formData: FormData) {
  const actor = await requireRole("owner");
  const code = normalizeCouponCode(String(formData.get("code") ?? ""));
  const description = String(formData.get("description") ?? "").trim().slice(0, 120);
  const type = String(formData.get("type") ?? "percent");
  const value = Number(String(formData.get("value") ?? "").replace(",", "."));
  const maxRaw = Number(formData.get("maxRedemptions") ?? 0);
  const expiresRaw = String(formData.get("expiresAt") ?? "");

  if (!code || !Number.isFinite(value) || value <= 0) return { error: "Cupao invalido." };

  const percentOff = type === "percent" ? Math.min(100, Math.round(value)) : null;
  const amountOffCents = type === "amount" ? Math.round(value * 100) : null;
  await createCoupon({
    code,
    description: description || null,
    active: 1,
    percent_off: percentOff,
    amount_off_cents: amountOffCents,
    currency: "EUR",
    max_redemptions: Number.isFinite(maxRaw) && maxRaw > 0 ? Math.round(maxRaw) : null,
    redeemed: 0,
    expires_at: expiresRaw ? Math.floor(new Date(expiresRaw).getTime() / 1000) : null,
    created_at: nowSeconds(),
  });

  audit(actor.id, "coupon_created", code);
  revalidatePath("/panel/admin/coupons");
  return { ok: true };
}

export async function setCouponActiveAction(formData: FormData) {
  const actor = await requireRole("owner");
  const couponId = Number(formData.get("couponId"));
  const active = formData.get("active") === "1" ? 1 : 0;
  if (!Number.isFinite(couponId)) return;
  await updateCoupon(couponId, { active });
  audit(actor.id, active ? "coupon_activated" : "coupon_disabled", `#${couponId}`);
  revalidatePath("/panel/admin/coupons");
}
