/**
 * Tipos do dominio, sem dependencia de motor de base de dados.
 *
 * Vivem aqui e nao em db.ts porque o db.ts importa node:sqlite: qualquer
 * ficheiro que so precise do TIPO User ficava preso ao SQLite por causa
 * disso. O db.ts reexporta daqui, para os imports existentes continuarem
 * validos enquanto a migracao decorre.
 */

export type Role = "member" | "client" | "staff" | "developer" | "owner";
export type Source = "discord" | "manual";
export type TokenKind = "api" | "web";

/** Marcador para contas criadas por Discord, que ainda nao tem password. */
export const NO_PASSWORD = "!discord";

/**
 * Perfil publico do utilizador.
 *
 * NAO leva password_hash nem client_password: essas vivem numa
 * subcoleccao privada (users/{id}/private/creds) e sao lidas so quando
 * fazem falta. Assim uma leitura de perfil - que acontece em cada pagina -
 * nunca traz credenciais consigo.
 */
export type UserProfile = {
  id: number;
  username: string;
  email: string | null;
  role: Role;
  tier: string | null;
  tier_source: Source;
  role_source: Source;
  status: string;
  hwid: string | null;
  expires_at: number | null;
  created_at: number;
  discord_id: string | null;
  discord_username: string | null;
  discord_avatar: string | null;
  support_started_at: number | null;
  support_expires_at: number | null;
  support_lifetime: number;
  client_version: string | null;
  client_seen_at: number | null;
};

export type UserCredentials = {
  password_hash: string;
  client_password: string | null;
};

/**
 * Utilizador completo, com credenciais.
 *
 * Mantem a forma exacta que o SQLite devolvia, para o resto da aplicacao
 * nao ter de mudar. Quem so precisa do perfil deve usar UserProfile e
 * poupar a leitura da subcoleccao.
 */
export type User = UserProfile & UserCredentials;

export type Token = {
  /** SHA-256 do token em claro. E tambem o id do documento. */
  token_hash: string;
  user_id: number;
  kind: TokenKind;
  expires_at: number;
  created_at: number;
  last_seen_at: number | null;
};

export type Plan = {
  id: number;
  code: string;
  name: string;
  description: string | null;
  price_cents: number;
  currency: string;
  days: number;
  support_days: number | null;
  active: number;
  sort_order: number;
  discord_role_id: string | null;
  cover_url: string | null;
  badge_text: string | null;
  badge_active: number;
  compare_at_cents: number | null;
  discount_active: number;
  promo_text: string | null;
  features_json: string | null;
  cta_text: string | null;
};

export type Order = {
  id: number;
  user_id: number;
  plan_id: number;
  amount_cents: number;
  currency: string;
  status: string;
  provider: string;
  provider_ref: string | null;
  created_at: number;
  paid_at: number | null;
  refunded_at: number | null;
  /**
   * Copiados do utilizador e do plano. O Firestore nao tem JOIN, e as
   * listagens de encomendas mostram sempre estes dois - sem os copiar,
   * cada linha custava duas leituras extra.
   */
  username: string;
  plan_name: string;
};

export type Review = {
  id: number;
  user_id: number | null;
  author_name: string;
  handle: string | null;
  rig: string | null;
  gain: string | null;
  rating: number;
  body: string;
  approved: number;
  created_at: number;
};

export type AuditEntry = {
  user_id: number | null;
  action: string;
  detail: string | null;
  ip: string | null;
  created_at: number;
};

export type LoginAttempt = {
  username: string;
  ip: string;
  success: number;
  created_at: number;
};

export type DiscordRoleSync = {
  user_id: number;
  tier: string | null;
  reason: string;
  attempts: number;
  last_error: string | null;
  remove_role_id: string | null;
  updated_at: number;
};

export const COLLECTIONS = {
  users: "users",
  tokens: "tokens",
  plans: "plans",
  orders: "orders",
  reviews: "reviews",
  audit: "audit_log",
  attempts: "login_attempts",
  roleSync: "discord_role_sync",
} as const;

/** Subcoleccao e documento onde ficam as credenciais de cada utilizador. */
export const CREDENTIALS_PATH = { collection: "private", doc: "creds" } as const;
