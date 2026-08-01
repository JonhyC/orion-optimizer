import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { applicationUrl, authorizeUrl, discordConfig } from "@/lib/discord";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATE_COOKIE = "orion_oauth_state";

export async function GET() {
  const cfg = discordConfig();

  if (!cfg) {
    return NextResponse.redirect(
      new URL("/panel/login?error=discord_off", applicationUrl()),
    );
  }

  // state contra CSRF: guardamos numa cookie httpOnly e comparamos no
  // callback. Sem isto, alguem podia forcar-te a completar o login dele.
  const state = crypto.randomBytes(24).toString("hex");
  const jar = await cookies();

  jar.set(STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  });

  return NextResponse.redirect(authorizeUrl(cfg, state));
}
