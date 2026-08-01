import crypto from "node:crypto";
// Extensao .ts explicita: o Node em ESM exige-a, e o bundler do Next resolve
// na mesma. Sem isto, scripts/admin.ts nao consegue reutilizar este modulo.
import { getDb, audit, nowSeconds, type User } from "./db.ts";

/**
 * Autenticacao do cliente Windows: passwords, tokens, limite de tentativas
 * e ligacao da licenca a uma maquina.
 *
 * Substitui server/lib/auth.php. Mesmo comportamento, mesmos codigos de erro -
 * os testes PowerShell que existiam continuam a servir para validar isto.
 */

export const TOKEN_TTL = 12 * 60 * 60; // 12 horas
export const MAX_ATTEMPTS = 5;
export const LOCKOUT_SECONDS = 15 * 60;
export const BIND_HWID = true;

// ------------------------------------------------------------- passwords

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

export function isLockedOut(username: string, ip: string): boolean {
  const since = nowSeconds() - LOCKOUT_SECONDS;
  const row = getDb()
    .prepare(
      `SELECT COUNT(*) AS n FROM login_attempts
       WHERE username = ? AND ip = ? AND success = 0 AND created_at > ?`,
    )
    .get(username, ip, since) as { n: number };

  return row.n >= MAX_ATTEMPTS;
}

export function recordAttempt(username: string, ip: string, success: boolean): void {
  const db = getDb();
  db.prepare(
    "INSERT INTO login_attempts (username, ip, success, created_at) VALUES (?, ?, ?, ?)",
  ).run(username, ip, success ? 1 : 0, nowSeconds());

  if (success) {
    db.prepare(
      "DELETE FROM login_attempts WHERE username = ? AND ip = ? AND success = 0",
    ).run(username, ip);
  }
}

// ----------------------------------------------------------- credenciais

export function findUser(username: string): User | null {
  return (getDb().prepare("SELECT * FROM users WHERE username = ?").get(username) as
    | User
    | undefined) ?? null;
}

export function verifyCredentials(username: string, password: string): User | null {
  const user = findUser(username);
  const hash = user?.password_hash ?? DUMMY_HASH;
  const ok = verifyPassword(password, hash);
  return ok && user ? user : null;
}

export function checkAccount(user: User): { ok: boolean; reason?: string } {
  if (user.status !== "active") {
    return { ok: false, reason: "Conta suspensa. Contacta o administrador." };
  }
  return { ok: true };
}

/** A conta do site pode existir sem uma licenca ativa; o cliente Windows nao. */
export function checkOptimizerAccess(user: User): { ok: boolean; reason?: string } {
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

/** Primeiro login liga a licenca a maquina; depois disso so essa entra. */
export function checkHwid(user: User, hwid: string | null): { ok: boolean; reason?: string } {
  if (!BIND_HWID) return { ok: true };
  if (!hwid) return { ok: false, reason: "Identificador de maquina em falta." };

  if (!user.hwid) {
    getDb().prepare("UPDATE users SET hwid = ? WHERE id = ?").run(hwid, user.id);
    audit(user.id, "hwid_bound", hwid.slice(0, 16));
    return { ok: true };
  }

  const a = Buffer.from(user.hwid);
  const b = Buffer.from(hwid);
  const same = a.length === b.length && crypto.timingSafeEqual(a, b);

  return same
    ? { ok: true }
    : { ok: false, reason: "Esta licenca esta ligada a outro computador." };
}

// --------------------------------------------------------------- tokens

export type TokenKind = "api" | "web";

export const WEB_SESSION_TTL = 7 * 24 * 60 * 60; // 7 dias

/** Guardamos apenas o SHA-256 do token; o valor original nunca fica em disco. */
export function issueToken(
  userId: number,
  kind: TokenKind = "api",
  ttl: number = TOKEN_TTL,
): { token: string; expiresAt: number } {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = nowSeconds() + ttl;
  const db = getDb();

  db.prepare(
    "INSERT INTO tokens (user_id, token_hash, kind, expires_at, created_at) VALUES (?, ?, ?, ?, ?)",
  ).run(userId, sha256(token), kind, expiresAt, nowSeconds());

  db.prepare("DELETE FROM tokens WHERE expires_at < ?").run(nowSeconds());

  return { token, expiresAt };
}

export function userFromToken(token: string | null, kind: TokenKind = "api"): User | null {
  if (!token) return null;

  const user = getDb()
    .prepare(
      `SELECT u.* FROM tokens t
       JOIN users u ON u.id = t.user_id
       WHERE t.token_hash = ? AND t.kind = ? AND t.expires_at > ?`,
    )
    .get(sha256(token), kind, nowSeconds()) as User | undefined;

  if (!user) return null;
  const access = kind === "api" ? checkOptimizerAccess(user) : checkAccount(user);
  return access.ok ? user : null;
}

export function revokeToken(token: string): void {
  getDb().prepare("DELETE FROM tokens WHERE token_hash = ?").run(sha256(token));
}

/** Revoga tudo do utilizador: usado ao suspender a conta ou mudar a password. */
export function revokeAllTokens(userId: number): void {
  getDb().prepare("DELETE FROM tokens WHERE user_id = ?").run(userId);
}

/** Corta apenas o cliente Windows; a sessao do site continua disponivel. */
export function revokeClientTokens(userId: number): void {
  getDb().prepare("DELETE FROM tokens WHERE user_id = ? AND kind = 'api'").run(userId);
}

function sha256(v: string): string {
  return crypto.createHash("sha256").update(v).digest("hex");
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
