import {
  checkOptimizerAccess,
  checkHwid,
  clientIp,
  findUser,
  isLockedOut,
  issueToken,
  recordAttempt,
  verifyCredentials,
  LOCKOUT_SECONDS,
} from "@/lib/auth";
import { audit } from "@/lib/db";
import { body, fail, ok, str } from "../_lib/respond";
import { processExpiredPlans } from "@/lib/plan-expiry";
import { avatarUrl, discordConfig, refreshDiscordAccess } from "@/lib/discord";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const data = await body(req);
  const username = str(data.username).trim();
  const password = str(data.password);
  const hwid = str(data.hwid).trim() || null;
  const ip = clientIp(req);

  if (!username || !password) {
    return fail("Utilizador e password sao obrigatorios.", 400, "missing_credentials");
  }

  if (isLockedOut(username, ip)) {
    audit(null, "login_lockout", username, ip);
    return fail(
      `Demasiadas tentativas falhadas. Tenta de novo daqui a ${LOCKOUT_SECONDS / 60} minutos.`,
      429,
      "locked_out",
    );
  }

  const user = verifyCredentials(username, password);

  if (!user) {
    recordAttempt(username, ip, false);
    audit(null, "login_failed", username, ip);
    // Mensagem generica: nao revelar se a conta existe.
    return fail("Credenciais invalidas.", 401, "invalid_credentials");
  }

  await processExpiredPlans();

  // O processador pode ter removido o plano desde a leitura das credenciais.
  let currentUser = findUser(username);
  if (!currentUser) {
    return fail("Credenciais invalidas.", 401, "invalid_credentials");
  }

  const discord = await refreshDiscordAccess(currentUser);
  currentUser = discord.user;

  if (discord.status === "not_linked") {
    recordAttempt(username, ip, false);
    audit(currentUser.id, "login_discord_not_linked", null, ip);
    return fail(
      "Conta Discord nao ligada. Liga a conta Discord no painel antes de entrar.",
      403,
      "discord_not_linked",
    );
  }

  if (discord.status === "unavailable") {
    audit(currentUser.id, "login_discord_unavailable", discord.detail, ip);
    return fail(
      "Nao foi possivel verificar os cargos do Discord. Tenta novamente dentro de instantes.",
      503,
      "discord_unavailable",
    );
  }

  if (discord.status === "not_member" && discordConfig()?.requireGuild) {
    recordAttempt(username, ip, false);
    audit(currentUser.id, "login_discord_not_member", null, ip);
    return fail(
      "A conta ligada ja nao pertence ao servidor Discord Orion.",
      403,
      "discord_not_member",
    );
  }

  audit(
    currentUser.id,
    "login_discord_verified",
    `${currentUser.role}/${currentUser.tier ?? "sem_plano"}`,
    ip,
  );

  const account = checkOptimizerAccess(currentUser);
  if (!account.ok) {
    recordAttempt(username, ip, false);
    audit(currentUser.id, "login_denied", account.reason, ip);
    return fail(account.reason!, 403, "account_inactive");
  }

  const machine = checkHwid(currentUser, hwid);
  if (!machine.ok) {
    recordAttempt(username, ip, false);
    audit(currentUser.id, "login_hwid_mismatch", machine.reason, ip);
    return fail(machine.reason!, 403, "hwid_mismatch");
  }

  recordAttempt(username, ip, true);
  const { token, expiresAt } = issueToken(currentUser.id);
  audit(currentUser.id, "login_ok", null, ip);

  return ok({
    token,
    expires_at: expiresAt,
    user: {
      username: currentUser.username,
      display_name: currentUser.discord_username ?? currentUser.username,
      discord_avatar_url: currentUser.discord_id
        ? avatarUrl(currentUser.discord_id, currentUser.discord_avatar)
        : null,
      role: currentUser.role,
      tier: currentUser.tier,
      discord_verified: discord.status === "verified",
      expires_at: currentUser.expires_at,
      support_expires_at: currentUser.support_expires_at,
      support_lifetime: currentUser.support_lifetime === 1,
    },
  });
}
