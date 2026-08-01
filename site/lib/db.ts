import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import fs from "node:fs";

/**
 * Base de dados: um ficheiro SQLite, sem servidor.
 *
 * Usa o modulo node:sqlite embutido no Node 22+ - sem dependencias nativas,
 * sem compilacao, sem node-gyp. Substitui o PDO/PHP que existia antes.
 */

const DB_PATH =
  process.env.ORION_DB_PATH ??
  path.join(process.cwd(), "..", "data", "orion.sqlite");

/** Caminho absoluto do ficheiro, para o comando `admin.ts db` o mostrar. */
export const DB_FILE = path.resolve(DB_PATH);

let db: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  if (db) return db;

  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

  db = new DatabaseSync(DB_PATH);
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA foreign_keys = ON");
  migrate(db);
  seedPlans(db);

  return db;
}

function migrate(d: DatabaseSync): void {
  d.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      username      TEXT NOT NULL UNIQUE,
      email         TEXT,
      password_hash TEXT NOT NULL,
      role          TEXT NOT NULL DEFAULT 'client',
      status        TEXT NOT NULL DEFAULT 'active',
      hwid          TEXT,
      expires_at    INTEGER,
      created_at    INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tokens (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS login_attempts (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      username   TEXT NOT NULL,
      ip         TEXT NOT NULL,
      success    INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    INTEGER,
      action     TEXT NOT NULL,
      detail     TEXT,
      ip         TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS plans (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      code        TEXT NOT NULL UNIQUE,
      name        TEXT NOT NULL,
      description TEXT,
      price_cents INTEGER NOT NULL,
      currency    TEXT NOT NULL DEFAULT 'EUR',
      days        INTEGER NOT NULL,
      active      INTEGER NOT NULL DEFAULT 1,
      sort_order  INTEGER NOT NULL DEFAULT 0,
      discord_role_id TEXT
    );

    CREATE TABLE IF NOT EXISTS orders (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id      INTEGER NOT NULL REFERENCES users(id),
      plan_id      INTEGER NOT NULL REFERENCES plans(id),
      amount_cents INTEGER NOT NULL,
      currency     TEXT NOT NULL DEFAULT 'EUR',
      status       TEXT NOT NULL DEFAULT 'pending',
      provider     TEXT NOT NULL DEFAULT 'simulated',
      provider_ref TEXT,
      created_at   INTEGER NOT NULL,
      paid_at      INTEGER,
      refunded_at  INTEGER
    );

    CREATE TABLE IF NOT EXISTS reviews (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
      author_name TEXT NOT NULL,
      handle      TEXT,
      rig         TEXT,
      gain        TEXT,
      rating      INTEGER NOT NULL DEFAULT 5,
      body        TEXT NOT NULL,
      approved    INTEGER NOT NULL DEFAULT 0,
      created_at  INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_tokens_hash    ON tokens (token_hash);
    CREATE INDEX IF NOT EXISTS idx_reviews_ok     ON reviews (approved, created_at);
    CREATE INDEX IF NOT EXISTS idx_attempts_user  ON login_attempts (username, created_at);
    CREATE INDEX IF NOT EXISTS idx_orders_user    ON orders (user_id);
    CREATE INDEX IF NOT EXISTS idx_orders_status  ON orders (status, created_at);
  `);

  // Distingue o token do cliente PowerShell ('api') da sessao de browser
  // ('web'). Sao coisas diferentes: validades diferentes e revogacao
  // independente - terminar sessao no painel nao pode deslogar o optimizador.
  addColumn(d, "tokens", "kind", "TEXT NOT NULL DEFAULT 'api'");

  // Identidade Discord.
  addColumn(d, "users", "discord_id", "TEXT");
  addColumn(d, "users", "discord_username", "TEXT");
  addColumn(d, "users", "discord_avatar", "TEXT");

  // 'discord' = o papel vem dos cargos do servidor e e reescrito a cada login.
  // 'manual'  = foi fixado a mao e o Discord nao lhe toca.
  addColumn(d, "users", "role_source", "TEXT NOT NULL DEFAULT 'manual'");

  // Plano comprado. Eixo SEPARADO das permissoes: o dono pode ter 'basic'
  // e um cliente pode ter 'ultimate'. Achatar os dois num so campo
  // obrigaria a escolher entre "manda no site" e "comprou o pacote X".
  addColumn(d, "users", "tier", "TEXT");
  const addedTierSource = addColumn(
    d,
    "users",
    "tier_source",
    "TEXT NOT NULL DEFAULT 'manual'",
  );
  if (addedTierSource) {
    d.exec(`UPDATE users SET tier_source = 'discord'
            WHERE discord_id IS NOT NULL AND tier IN ('basic', 'pro', 'ultimate')`);
  }
  addColumn(d, "users", "client_password", "TEXT");
  addColumn(d, "plans", "cover_url", "TEXT");
  const addedBadgeText = addColumn(d, "plans", "badge_text", "TEXT");
  addColumn(d, "plans", "badge_active", "INTEGER NOT NULL DEFAULT 0");
  addColumn(d, "plans", "compare_at_cents", "INTEGER");
  addColumn(d, "plans", "discount_active", "INTEGER NOT NULL DEFAULT 0");
  addColumn(d, "plans", "promo_text", "TEXT");
  if (addedBadgeText) {
    d.prepare("UPDATE plans SET badge_text = ?, badge_active = 1 WHERE code = ?")
      .run("Most Popular", "pro");
    d.prepare("UPDATE plans SET badge_text = ?, badge_active = 1 WHERE code = ?")
      .run("Maximum Performance", "ultimate");
  }
  // NULL = sem suporte, 0 = life-time, > 0 = numero de dias.
  addColumn(d, "plans", "support_days", "INTEGER");
  const addedPlanDiscordRole = addColumn(d, "plans", "discord_role_id", "TEXT");
  if (addedPlanDiscordRole) {
    const legacyRoles: Array<[string, string | undefined]> = [
      ["basic", process.env.DISCORD_TIER_BASIC],
      ["pro", process.env.DISCORD_TIER_PRO],
      ["ultimate", process.env.DISCORD_TIER_ULTIMATE],
    ];
    for (const [code, roleId] of legacyRoles) {
      if (roleId) d.prepare("UPDATE plans SET discord_role_id = ? WHERE code = ?").run(roleId, code);
    }
  }
  addColumn(d, "users", "support_started_at", "INTEGER");
  addColumn(d, "users", "support_expires_at", "INTEGER");
  addColumn(d, "users", "support_lifetime", "INTEGER NOT NULL DEFAULT 0");

  d.exec(`
    CREATE TABLE IF NOT EXISTS discord_role_sync (
      user_id     INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      tier        TEXT,
      reason      TEXT NOT NULL,
      attempts    INTEGER NOT NULL DEFAULT 0,
      last_error  TEXT,
      remove_role_id TEXT,
      updated_at  INTEGER NOT NULL
    );
  `);
  addColumn(d, "discord_role_sync", "remove_role_id", "TEXT");

  d.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_discord ON users (discord_id)");
  d.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_plans_discord_role
          ON plans (discord_role_id) WHERE discord_role_id IS NOT NULL`);
}

/** ALTER TABLE idempotente: o SQLite nao tem ADD COLUMN IF NOT EXISTS. */
function addColumn(d: DatabaseSync, table: string, column: string, definition: string): boolean {
  const cols = d.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (cols.some((c) => c.name === column)) return false;
  d.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  return true;
}

function seedPlans(d: DatabaseSync): void {
  // Os codigos batem certo com os cargos do Discord (basic/pro/ultimate),
  // para que comprar um plano e receber o cargo sejam a mesma coisa.
  //
  // days = 0 significa PERMANENTE (expires_at fica a NULL). Nao e "zero dias":
  // e a ausencia de prazo. Planos privados ou especiais sao criados pelo owner
  // no painel e nao sao inseridos automaticamente aqui.
  const rows: Array<[string, string, string, number, number, number | null, number, number, string | null]> = [
    ["basic", "Basic", "The essentials, done properly.", 1499, 30, null, 1, 1, process.env.DISCORD_TIER_BASIC ?? null],
    ["pro", "Pro", "Where most players land.", 2999, 365, 30, 1, 2, process.env.DISCORD_TIER_PRO ?? null],
    ["ultimate", "Ultimate", "Every millisecond, hunted down.", 4999, 36500, 0, 1, 3, process.env.DISCORD_TIER_ULTIMATE ?? null],
  ];

  const exists = d.prepare("SELECT id FROM plans WHERE code = ?");
  const insert = d.prepare(
    `INSERT INTO plans (code, name, description, price_cents, currency, days, support_days, active, sort_order, discord_role_id)
     VALUES (?, ?, ?, ?, 'EUR', ?, ?, ?, ?, ?)`,
  );

  for (const [code, name, description, price, days, supportDays, active, sort, discordRoleId] of rows) {
    if (!exists.get(code)) {
      insert.run(code, name, description, price, days, supportDays, active, sort, discordRoleId);
    }
  }
}

export function audit(
  userId: number | null,
  action: string,
  detail?: string | null,
  ip?: string | null,
): void {
  getDb()
    .prepare(
      "INSERT INTO audit_log (user_id, action, detail, ip, created_at) VALUES (?, ?, ?, ?, ?)",
    )
    .run(userId, action, detail ?? null, ip ?? null, Math.floor(Date.now() / 1000));
}

export type User = {
  id: number;
  username: string;
  email: string | null;
  /** '!discord' para contas sem password: nao parseia como scrypt$, logo
   *  verifyPassword rejeita-as sempre ate lhes ser definida uma a serio. */
  password_hash: string;
  role: "member" | "client" | "staff" | "developer" | "owner";
  tier: string | null;
  tier_source: "discord" | "manual";
  status: string;
  hwid: string | null;
  expires_at: number | null;
  created_at: number;
  discord_id: string | null;
  discord_username: string | null;
  discord_avatar: string | null;
  role_source: "discord" | "manual";
  client_password: string | null;
  support_started_at: number | null;
  support_expires_at: number | null;
  support_lifetime: number;
};

/** Marcador para contas criadas por Discord, que ainda nao tem password. */
export const NO_PASSWORD = "!discord";

export function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}
