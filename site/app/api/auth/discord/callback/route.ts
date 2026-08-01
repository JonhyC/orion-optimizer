import crypto from "node:crypto";
import { NextResponse } from "next/server";
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

export async function GET(req: Request) {
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

  const role = mapRole(cfg, roleIds ?? []);
  const tier = mapTier(cfg, roleIds ?? []);
  const user = upsertDiscordUser(identity, role, tier);

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
