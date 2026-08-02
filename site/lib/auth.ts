import crypto from "node:crypto";
import { audit } from "./repo/audit.ts";
import { countRecentFailures, recordAttempt as gravarTentativa } from "./repo/audit.ts";
import * as repoTokens from "./repo/tokens.ts";
import * as repoUsers from "./repo/users.ts";
import type { TokenKind, User, UserProfile } from "./repo/types.ts";

/**
 * Autenticacao do cliente Windows: passwords, tokens, limite de tentativas
 * e ligacao da licenca a uma maquina.
 *
 * Passou de SQLite para Firestore. A diferenca que se ve no codigo e que
 * quase tudo aqui e agora assincrono: o Firestore so tem API por rede. A
 * diferenca que se ve em producao e que a sessao deixa de desaparecer -
 * o SQLite vivia em /tmp e cada funcao serverless da Vercel tinha o seu,
 * portanto o token escrito no login nao existia no pedido seguinte.
 *
 * O que NAO mudou: as regras, as mensagens de erro e os prazos. Os testes
 * PowerShell que existiam continuam a servir para validar isto.
 */

export const TOKEN_TTL = 12 * 60 * 60; // 12 horas
export const MAX_ATTEMPTS = 5;
export const LOCKOUT_SECONDS = 15 * 60;
export const BIND_HWID = true;
export const WEB_SESSION_TTL = 7 * 24 * 60 * 60; // 7 dias

export type { TokenKind };

export function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

// ------------------------------------------------------------- passwords
// Sem alteracoes: e criptografia pura, nao toca na base de dados.

const SCRYPT_N = 16384;
const SCRYPT_KEYLEN = 64;

/**
 * scrypt do proprio Node - sem dependencias externas.
 * Formato guardado: scrypt$<N>$<salt hex>$<hash hex>
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, SCRYPT_KEYLEN, { N: SCRYPT_N });
  return `scrypt$${SCRYPT_N}$${salt.toString("hex")}$${hash.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "scrypt") return false;

  const N = Number(parts[1]);
  const salt = Buffer.from(parts[2], "hex");
  const expected = Buffer.from(parts[3], "hex");

  let actual: Buffer;
  try {
    actual = crypto.scryptSync(password, salt, expected.length, { N });
  } catch {
    return false;
  }

  // timingSafeEqual rebenta se os comprimentos diferirem - verificar antes.
  if (actual.length !== expected.length) return false;
  return crypto.timingSafeEqual(actual, expected);
}

/**
 * Hash descartavel usado quando o utilizador nao existe.
 *
 * Sem isto, um login para uma conta inexistente responderia bem mais depressa
 * do que um com password errada, e isso permitia enumerar contas pelo tempo
 * de resposta.
 */
const DUMMY_HASH = hashPassword("orion-dummy-password-for-timing");

// --------------------------------------------------------- forca bruta

export async function isLockedOut(username: string, ip: string): Promise<boolean> {
  const desde = nowSeconds() - LOCKOUT_SECONDS;
  const falhas = await countRecentFailures(username, ip, desde);
  return falhas >= MAX_ATTEMPTS;
}

export async function recordAttempt(
  username: string,
  ip: string,
  success: boolean,
): Promise<void> {
  await gravarTentativa(username, ip, success);
}

// ----------------------------------------------------------- credenciais

export async function findUser(username: string): Promise<User | null> {
  return repoUsers.findByUsername(username);
}

export async function findUserById(id: number): Promise<User | null> {
  return repoUsers.findById(id);
}

export async function verifyCredentials(
  username: string,
  password: string,
): Promise<User | null> {
  const user = await findUser(username);
  const hash = user?.password_hash ?? DUMMY_HASH;
  const ok = verifyPassword(password, hash);
  return ok && user ? user : null;
}

export function checkAccount(user: Pick<UserProfile, "status">): { ok: boolean; reason?: string } {
  if (user.status !== "active") {
    return { ok: false, reason: "Conta suspensa. Contacta o administrador." };
  }
  return { ok: true };
}

/** A conta do site pode existir sem uma licenca ativa; o cliente Windows nao. */
export function checkOptimizerAccess(
  user: Pick<UserProfile, "status" | "role" | "expires_at" | "tier">,
): { ok: boolean; reason?: string } {
  const account = checkAccount(user);
  if (!account.ok) return account;
  if (["staff", "developer", "owner"].includes(user.role)) return { ok: true };
  if (user.expires_at !== null && user.expires_at < nowSeconds()) {
    return { ok: false, reason: "Licenca expirada." };
  }
  if (!user.tier) {
    return { ok: false, reason: "Sem plano ativo. Renova a licenca para usar o optimizer." };
  }
  return { ok: true };
}

/**
 * Primeiro login liga a licenca a maquina; depois disso so essa entra.
 *
 * A verificacao e a gravacao acontecem dentro de uma transaccao no
 * repositorio: duas maquinas a autenticar-se ao mesmo tempo veriam ambas
 * o campo vazio e ambas gravariam o seu identificador.
 */
export async function checkHwid(
  user: Pick<UserProfile, "id">,
  hwid: string | null,
): Promise<{ ok: boolean; reason?: string }> {
  if (!BIND_HWID) return { ok: true };
  if (!hwid) return { ok: false, reason: "Identificador de maquina em falta." };

  const resultado = await repoUsers.bindHwid(user.id, hwid);
  if (resultado.bound) {
    audit(user.id, "hwid_bound", hwid.slice(0, 16));
    return { ok: true };
  }
  if (resultado.ok) return { ok: true };
  return { ok: false, reason: "Esta licenca esta ligada a outro computador." };
}

// --------------------------------------------------------------- tokens

/** Guardamos apenas o SHA-256 do token; o valor original nunca fica em disco. */
export async function issueToken(
  userId: number,
  kind: TokenKind = "api",
  ttl: number = TOKEN_TTL,
): Promise<{ token: string; expiresAt: number }> {
  return repoTokens.createToken(userId, kind, ttl);
}

/**
 * Resolve o utilizador a partir do token.
 *
 * Duas leituras: o token pelo hash (id do documento) e depois o
 * utilizador. Nao dao para paralelizar - so se sabe que utilizador ler
 * depois de ler o token.
 */
export async function userFromToken(
  token: string | null,
  kind: TokenKind = "api",
): Promise<User | null> {
  if (!token) return null;

  const registo = await repoTokens.findToken(token, kind);
  if (!registo) return null;

  const user = await repoUsers.findById(registo.user_id);
  if (!user) return null;

  const acesso = kind === "api" ? checkOptimizerAccess(user) : checkAccount(user);
  if (!acesso.ok) return null;

  // Sem await: serve para saber quem esta online e falhar nisso nunca
  // pode impedir alguem de entrar.
  repoTokens.touchToken(registo.token_hash);
  return user;
}

export async function revokeToken(token: string): Promise<void> {
  await repoTokens.revokeToken(token);
}

/** Revoga tudo do utilizador: usado ao suspender a conta ou mudar a password. */
export async function revokeAllTokens(userId: number): Promise<void> {
  await repoTokens.revokeAllTokens(userId);
}

/** Corta apenas o cliente Windows; a sessao do site continua disponivel. */
export async function revokeClientTokens(userId: number): Promise<void> {
  await repoTokens.revokeClientTokens(userId);
}

// -------------------------------------------------------------- pedidos

export function bearerToken(req: Request): string | null {
  const header = req.headers.get("authorization") ?? "";
  const m = /^Bearer\s+(.+)$/i.exec(header.trim());
  return m ? m[1].trim() : null;
}

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "127.0.0.1";
}
