import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  issueToken,
  revokeToken,
  userFromToken,
  WEB_SESSION_TTL,
} from "./auth.ts";
import type { User } from "./repo/types.ts";

/**
 * Sessao de browser para o painel.
 *
 * Separada do token do cliente PowerShell: terminar sessao no painel nao
 * pode deslogar o optimizador que esta a correr no PC de alguem.
 */

const COOKIE = "orion_session";

/**
 * Hierarquia de permissoes, do menor para o maior. A ordem e o que decide.
 *
 * 'member' esta ABAIXO de 'client': quem so tem o cargo de membro no Discord
 * ainda nao comprou nada, logo nao tem licenca nem cliente Windows para ver.
 * Cliente e quem tem um dos cargos de plano (basic/pro/ultimate).
 */
export const ROLES = ["member", "client", "staff", "developer", "owner"] as const;
export type Role = (typeof ROLES)[number];

export async function startSession(userId: number): Promise<void> {
  const { token, expiresAt } = await issueToken(userId, "web", WEB_SESSION_TTL);
  const jar = await cookies();

  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(expiresAt * 1000),
  });
}

export async function endSession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await revokeToken(token);
  jar.delete(COOKIE);
}

export async function currentUser(): Promise<User | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value ?? null;
  return userFromToken(token, "web");
}

export function roleAtLeast(user: User | null, role: Role): boolean {
  if (!user) return false;
  const have = ROLES.indexOf(user.role as Role);
  const need = ROLES.indexOf(role);
  return have >= 0 && need >= 0 && have >= need;
}

export async function requireUser(): Promise<User> {
  const user = await currentUser();
  if (!user) redirect("/panel/login");
  return user;
}

export async function requireRole(role: Role): Promise<User> {
  const user = await requireUser();
  if (!roleAtLeast(user, role)) redirect("/panel");
  return user;
}
