import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { motivoDeIndisponibilidade } from "@/lib/indisponivel";
import { cookies } from "next/headers";
import {
  applicationUrl,
  discordConfig,
  exchangeCode,
  fetchGuildRoles,
  fetchIdentity,
  mapRole,
  mapTier,
  upsertDiscordUser,
} from "@/lib/discord";
import { audit } from "@/lib/db";
import { startSession } from "@/lib/session";
import { processExpiredPlans } from "@/lib/plan-expiry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATE_COOKIE = "orion_oauth_state";

/**
 * Callback do Discord.
 *
 * O corpo real vive em processarCallback. Esta camada existe so para
 * apanhar excepcoes: a rota ja tinha um caminho de erro desenhado - o
 * back(), que volta ao login com a razao - mas nao o usava para
 * excepcoes. Bastava a base de dados falhar (quota esgotada, por
 * exemplo) para o utilizador levar com um 500 da Vercel a meio do login,
 * sem nada que lhe dissesse o que fazer nem como voltar.
 */
export async function GET(req: Request) {
  const base = discordConfig()?.appUrl ?? applicationUrl();
  try {
    return await processarCallback(req);
  } catch (erro) {
    console.error('[orion] callback do Discord falhou:', (erro as Error)?.message ?? erro);
    const motivo = motivoDeIndisponibilidade(erro) ? 'indisponivel' : 'falhou';
    return NextResponse.redirect(new URL(`/panel/login?error=${motivo}`, base));
  }
}

async function processarCallback(req: Request) {
  await processExpiredPlans();
  const cfg = discordConfig();
  const base = cfg?.appUrl ?? applicationUrl();
  const back = (reason: string) => NextResponse.redirect(new URL(`/panel/login?error=${reason}`, base));

  if (!cfg) return back("discord_off");

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  const jar = await cookies();
  const expected = jar.get(STATE_COOKIE)?.value;
  jar.delete(STATE_COOKIE);

  if (!code || !state || !expected) return back("bad_request");

  // Comparacao em tempo constante, e so depois de garantir o mesmo comprimento.
  const a = Buffer.from(state);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return back("bad_state");

  const accessToken = await exchangeCode(cfg, code);
  if (!accessToken) return back("exchange_failed");

  const identity = await fetchIdentity(accessToken);
  if (!identity) return back("identity_failed");

  const roleIds = await fetchGuildRoles(cfg, accessToken);

  if (roleIds === null && cfg.requireGuild) {
    audit(null, "discord_login_not_member", identity.username);
    return back("not_member");
  }

  // Em paralelo: ambas consultam os mesmos planos.
  const [role, tier] = await Promise.all([
    mapRole(cfg, roleIds ?? []),
    mapTier(cfg, roleIds ?? []),
  ]);
  const user = await upsertDiscordUser(identity, role, tier);

  if (user.status !== "active") {
    audit(user.id, "discord_login_suspended", identity.username);
    return back("suspended");
  }

  await startSession(user.id);
  audit(
    user.id,
    "discord_login_ok",
    `${identity.username} -> ${user.role}${tier ? ` / ${tier}` : ""}`,
  );

  return NextResponse.redirect(new URL("/panel", base));
}
