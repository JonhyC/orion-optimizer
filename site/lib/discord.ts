import { getDb, nowSeconds, NO_PASSWORD, type User } from "./db.ts";

/**
 * Login por Discord e mapeamento de cargos.
 *
 * Os cargos do servidor Discord decidem o papel no site. A leitura e feita
 * SEMPRE do lado do servidor, contra a API do Discord, com o token acabado de
 * trocar - nunca a partir de nada que o browser envie.
 */

export type DiscordConfig = {
  clientId: string;
  clientSecret: string;
  botToken: string;
  guildId: string;
  /** Cargos de permissao, do mais alto para o mais baixo. */
  roleOwner: string;
  roleDeveloper: string;
  roleStaff: string;
  roleMember: string;
  /** Cargos de plano comprado. Eixo independente das permissoes. */
  tierUltimate: string;
  tierPro: string;
  tierBasic: string;
  appUrl: string;
  requireGuild: boolean;
};

/**
 * O que falta para o Discord funcionar.
 *
 * Serve para a pagina de login poder mostrar o botao mesmo antes de estar
 * configurado, dizendo qual e a variavel em falta - em vez de simplesmente
 * nao aparecer nada e deixar quem esta a configurar sem pista nenhuma.
 */
export function discordSetupStatus(): { ready: boolean; missing: string[] } {
  const required = ["DISCORD_CLIENT_ID", "DISCORD_CLIENT_SECRET", "DISCORD_GUILD_ID"];
  const missing = required.filter((k) => !process.env[k]);
  return { ready: missing.length === 0, missing };
}

/** Devolve null (em vez de rebentar) se o Discord nao estiver configurado. */
export function discordConfig(): DiscordConfig | null {
  const clientId = process.env.DISCORD_CLIENT_ID;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;
  const guildId = process.env.DISCORD_GUILD_ID;

  if (!clientId || !clientSecret || !guildId) return null;

  return {
    clientId,
    clientSecret,
    botToken: process.env.DISCORD_BOT_TOKEN ?? "",
    guildId,
    roleOwner: process.env.DISCORD_ROLE_OWNER ?? "",
    roleDeveloper: process.env.DISCORD_ROLE_DEVELOPER ?? "",
    roleStaff: process.env.DISCORD_ROLE_STAFF ?? "",
    roleMember: process.env.DISCORD_ROLE_MEMBER ?? "",
    tierUltimate: process.env.DISCORD_TIER_ULTIMATE ?? "",
    tierPro: process.env.DISCORD_TIER_PRO ?? "",
    tierBasic: process.env.DISCORD_TIER_BASIC ?? "",
    appUrl: (process.env.APP_URL ?? "http://localhost:3400").replace(/\/$/, ""),
    // Por defeito exige pertencer ao servidor: sem isso qualquer pessoa com
    // conta Discord entrava no painel.
    requireGuild: process.env.DISCORD_REQUIRE_GUILD !== "false",
  };
}

export type DiscordGuildRole = {
  id: string;
  name: string;
  color: number;
  position: number;
  assignable: boolean;
};

/** Cargos reais do servidor e se o bot os pode atribuir pela sua hierarquia. */
export async function fetchDiscordGuildRoles(): Promise<DiscordGuildRole[]> {
  const cfg = discordConfig();
  if (!cfg?.botToken) throw new Error("Bot Discord nao configurado.");

  const headers = { Authorization: `Bot ${cfg.botToken}` };
  const botResponse = await fetch("https://discord.com/api/v10/users/@me", {
    headers,
    cache: "no-store",
  });
  if (!botResponse.ok) throw new Error(`Bot Discord invalido (HTTP ${botResponse.status}).`);
  const bot = (await botResponse.json()) as { id: string };

  const [rolesResponse, memberResponse] = await Promise.all([
    fetch(`https://discord.com/api/v10/guilds/${cfg.guildId}/roles`, {
      headers,
      cache: "no-store",
    }),
    fetch(`https://discord.com/api/v10/guilds/${cfg.guildId}/members/${bot.id}`, {
      headers,
      cache: "no-store",
    }),
  ]);
  if (!rolesResponse.ok || !memberResponse.ok) {
    throw new Error(
      `Bot sem acesso aos cargos Discord (HTTP ${rolesResponse.status}/${memberResponse.status}).`,
    );
  }

  const roles = (await rolesResponse.json()) as Array<{
    id: string;
    name: string;
    color: number;
    position: number;
    managed?: boolean;
  }>;
  const member = (await memberResponse.json()) as { roles?: string[] };
  const botRoleIds = new Set(member.roles ?? []);
  const highestBotPosition = roles.reduce(
    (highest, role) => botRoleIds.has(role.id) ? Math.max(highest, role.position) : highest,
    0,
  );

  return roles
    .filter((role) => role.id !== cfg.guildId && !role.managed)
    .map((role) => ({
      id: role.id,
      name: role.name,
      color: role.color,
      position: role.position,
      assignable: role.position < highestBotPosition,
    }))
    .sort((a, b) => b.position - a.position || a.name.localeCompare(b.name));
}

export function redirectUri(cfg: DiscordConfig): string {
  return `${cfg.appUrl}/api/auth/discord/callback`;
}

export function authorizeUrl(cfg: DiscordConfig, state: string): string {
  const params = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: redirectUri(cfg),
    response_type: "code",
    // guilds.members.read da acesso aos cargos do utilizador NESTE servidor.
    scope: "identify guilds.members.read",
    state,
    prompt: "consent",
  });
  return `https://discord.com/api/oauth2/authorize?${params}`;
}

type TokenResponse = { access_token?: string; error?: string };

export async function exchangeCode(cfg: DiscordConfig, code: string): Promise<string | null> {
  const res = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri(cfg),
    }),
  });

  if (!res.ok) {
    console.error("[orion] troca de codigo falhou:", res.status, await res.text());
    return null;
  }

  const data = (await res.json()) as TokenResponse;
  return data.access_token ?? null;
}

export type DiscordIdentity = {
  id: string;
  username: string;
  globalName: string | null;
  avatar: string | null;
};

export async function fetchIdentity(accessToken: string): Promise<DiscordIdentity | null> {
  const res = await fetch("https://discord.com/api/users/@me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;

  const u = (await res.json()) as {
    id: string;
    username: string;
    global_name?: string | null;
    avatar?: string | null;
  };

  return {
    id: u.id,
    username: u.username,
    globalName: u.global_name ?? null,
    avatar: u.avatar ?? null,
  };
}

/** Cargos do utilizador no servidor, ou null se nao for membro. */
export async function fetchGuildRoles(
  cfg: DiscordConfig,
  accessToken: string,
): Promise<string[] | null> {
  const res = await fetch(
    `https://discord.com/api/users/@me/guilds/${cfg.guildId}/member`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );

  // 404 = nao pertence ao servidor. E uma resposta legitima, nao um erro.
  if (res.status === 404) return null;
  if (!res.ok) {
    console.error("[orion] leitura de cargos falhou:", res.status);
    return null;
  }

  const member = (await res.json()) as { roles?: string[] };
  return member.roles ?? [];
}

export type DiscordAccessCheck = {
  status: "verified" | "not_linked" | "not_member" | "unavailable";
  user: User;
  detail?: string;
};

function applyDiscordRoles(user: User, cfg: DiscordConfig, roleIds: string[]): User {
  const db = getDb();
  const discordRole = mapRole(cfg, roleIds);
  const discordTier = mapTier(cfg, roleIds);
  const nextTier = user.tier_source === "manual" ? user.tier : discordTier;
  const selectedRole = user.role_source === "manual" ? user.role : discordRole;
  const nextRole =
    selectedRole === "client" && !nextTier
      ? "member"
      : selectedRole === "member" && nextTier
        ? "client"
        : selectedRole;

  if (nextRole !== user.role || nextTier !== user.tier) {
    db.prepare("UPDATE users SET role = ?, tier = ? WHERE id = ?").run(
      nextRole,
      nextTier,
      user.id,
    );
  }

  return { ...user, role: nextRole, tier: nextTier };
}

/**
 * Revalida os cargos de uma conta do cliente Windows com o bot.
 * O token e os IDs dos cargos ficam exclusivamente no servidor.
 */
export async function refreshDiscordAccess(user: User): Promise<DiscordAccessCheck> {
  if (!user.discord_id) return { status: "not_linked", user };

  const cfg = discordConfig();
  if (!cfg?.botToken) {
    return { status: "unavailable", user, detail: "Bot Discord nao configurado." };
  }

  let response: Response;
  try {
    response = await fetch(
      `https://discord.com/api/v10/guilds/${cfg.guildId}/members/${user.discord_id}`,
      { headers: { Authorization: `Bot ${cfg.botToken}` }, cache: "no-store" },
    );
  } catch {
    return { status: "unavailable", user, detail: "Discord indisponivel." };
  }

  if (response.status === 404) {
    // Confirma que o 404 e do membro e nao do bot ter perdido acesso ao servidor.
    try {
      const guild = await fetch(`https://discord.com/api/v10/guilds/${cfg.guildId}`, {
        headers: { Authorization: `Bot ${cfg.botToken}` },
        cache: "no-store",
      });
      if (!guild.ok) {
        return {
          status: "unavailable",
          user,
          detail: `Bot sem acesso ao servidor Discord (HTTP ${guild.status}).`,
        };
      }
    } catch {
      return { status: "unavailable", user, detail: "Discord indisponivel." };
    }

    return { status: "not_member", user: applyDiscordRoles(user, cfg, []) };
  }

  if (!response.ok) {
    return {
      status: "unavailable",
      user,
      detail: `Falha ao consultar cargos Discord (HTTP ${response.status}).`,
    };
  }

  const member = (await response.json()) as { roles?: string[] };
  return {
    status: "verified",
    user: applyDiscordRoles(user, cfg, member.roles ?? []),
  };
}

/**
 * O cargo MAIS ALTO ganha, sempre.
 *
 * Uma pessoa costuma acumular cargos - owner e membro ao mesmo tempo, por
 * exemplo. A ordem dos testes aqui e a hierarquia: o primeiro que bater
 * devolve e os restantes nem sao consultados. Sem correspondencia nenhuma,
 * fica cliente.
 */
export function mapRole(cfg: DiscordConfig, roleIds: string[]): User["role"] {
  if (cfg.roleOwner && roleIds.includes(cfg.roleOwner)) return "owner";
  if (cfg.roleDeveloper && roleIds.includes(cfg.roleDeveloper)) return "developer";
  if (cfg.roleStaff && roleIds.includes(cfg.roleStaff)) return "staff";

  // Cliente e quem tem um cargo de PLANO. Ter so o cargo de membro nao chega:
  // essa pessoa ainda nao comprou nada e nao tem licenca para ver.
  if (mapTier(cfg, roleIds) !== null) return "client";

  return "member";
}

/**
 * Plano comprado, tambem do mais alto para o mais baixo.
 *
 * Eixo separado das permissoes de proposito: alguem pode ser owner e ter
 * 'basic', ou ser um cliente sem qualquer poder no site mas com 'ultimate'.
 * Devolve null se nao tiver nenhum cargo de plano.
 */
export function mapTier(cfg: DiscordConfig, roleIds: string[]): User["tier"] {
  if (roleIds.length > 0) {
    const placeholders = roleIds.map(() => "?").join(",");
    const linked = getDb()
      .prepare(
        `SELECT code FROM plans WHERE discord_role_id IN (${placeholders})
         ORDER BY sort_order DESC, id DESC LIMIT 1`,
      )
      .get(...roleIds) as { code: string } | undefined;
    if (linked) return linked.code;
  }

  // Compatibilidade durante a primeira migracao das variaveis antigas.
  if (cfg.tierUltimate && roleIds.includes(cfg.tierUltimate)) return "ultimate";
  if (cfg.tierPro && roleIds.includes(cfg.tierPro)) return "pro";
  if (cfg.tierBasic && roleIds.includes(cfg.tierBasic)) return "basic";
  return null;
}

function tierRole(cfg: DiscordConfig, tier: string | null): string {
  if (tier) {
    const linked = getDb()
      .prepare("SELECT discord_role_id FROM plans WHERE code = ?")
      .get(tier) as { discord_role_id: string | null } | undefined;
    if (linked?.discord_role_id) return linked.discord_role_id;
  }
  if (tier === "ultimate") return cfg.tierUltimate;
  if (tier === "pro") return cfg.tierPro;
  if (tier === "basic") return cfg.tierBasic;
  return "";
}

async function changeGuildRole(
  cfg: DiscordConfig,
  discordId: string,
  roleId: string,
  add: boolean,
): Promise<void> {
  if (!roleId) return;
  const res = await fetch(
    `https://discord.com/api/v10/guilds/${cfg.guildId}/members/${discordId}/roles/${roleId}`,
    {
      method: add ? "PUT" : "DELETE",
      headers: { Authorization: `Bot ${cfg.botToken}` },
    },
  );

  // O utilizador ja nao pertencer ao servidor nao e uma falha a repetir.
  if (res.status === 404) return;
  if (!res.ok) {
    const detail = (await res.text()).slice(0, 300);
    throw new Error(`Discord ${res.status}: ${detail}`);
  }
}

/**
 * Mantem apenas o cargo correspondente ao plano e garante o cargo member.
 * Um plano privado nao tem cargo publico, portanto fica apenas como member.
 */
export async function syncDiscordPlanRoles(
  discordId: string,
  tier: string | null,
  removeRoleIds: string[] = [],
): Promise<void> {
  const cfg = discordConfig();
  if (!cfg?.botToken) throw new Error("DISCORD_BOT_TOKEN nao configurado");

  const wanted = tierRole(cfg, tier);
  const databaseRoles = getDb()
    .prepare("SELECT discord_role_id FROM plans WHERE discord_role_id IS NOT NULL")
    .all() as Array<{ discord_role_id: string }>;
  const planRoles = Array.from(new Set([
    ...databaseRoles.map((row) => row.discord_role_id),
    cfg.tierBasic,
    cfg.tierPro,
    cfg.tierUltimate,
    ...removeRoleIds,
  ].filter(Boolean)));
  for (const roleId of planRoles) {
    if (roleId !== wanted) await changeGuildRole(cfg, discordId, roleId, false);
  }
  if (wanted) await changeGuildRole(cfg, discordId, wanted, true);
  if (cfg.roleMember) await changeGuildRole(cfg, discordId, cfg.roleMember, true);
}

export function avatarUrl(id: string, avatar: string | null): string | null {
  if (!avatar) return null;
  const ext = avatar.startsWith("a_") ? "gif" : "png";
  return `https://cdn.discordapp.com/avatars/${id}/${avatar}.${ext}?size=128`;
}

/**
 * Cria ou atualiza a conta a partir da identidade Discord.
 *
 * Se o papel foi fixado a mao (role_source='manual'), o Discord nao lhe toca -
 * caso contrario uma alteracao de cargos no servidor podia tirar-te o acesso
 * de dono ao teu proprio painel.
 */
export function upsertDiscordUser(
  identity: DiscordIdentity,
  role: User["role"],
  tier: User["tier"],
): User {
  const db = getDb();

  const existing = db
    .prepare("SELECT * FROM users WHERE discord_id = ?")
    .get(identity.id) as User | undefined;

  if (existing) {
    // Decisoes manuais do owner ganham ao Discord, incluindo planos privados.
    const nextRole = existing.role_source === "manual" ? existing.role : role;
    const nextTier = existing.tier_source === "manual" ? existing.tier : tier;
    const normalizedRole =
      nextRole === "client" && !nextTier
        ? "member"
        : nextRole === "member" && nextTier
          ? "client"
          : nextRole;

    db.prepare(
      `UPDATE users SET discord_username = ?, discord_avatar = ?, role = ?, tier = ? WHERE id = ?`,
    ).run(
      identity.globalName ?? identity.username,
      identity.avatar,
      normalizedRole,
      nextTier,
      existing.id,
    );

    return { ...existing, role: normalizedRole, tier: nextTier, discord_avatar: identity.avatar };
  }

  const username = uniqueUsername(identity.username);

  db.prepare(
    `INSERT INTO users
       (username, password_hash, role, tier, role_source, tier_source, status,
        discord_id, discord_username, discord_avatar, created_at)
     VALUES (?, ?, ?, ?, 'discord', 'discord', 'active', ?, ?, ?, ?)`,
  ).run(
    username,
    NO_PASSWORD,
    role,
    tier,
    identity.id,
    identity.globalName ?? identity.username,
    identity.avatar,
    nowSeconds(),
  );

  return db.prepare("SELECT * FROM users WHERE discord_id = ?").get(identity.id) as User;
}

function uniqueUsername(base: string): string {
  const db = getDb();
  const clean = base.toLowerCase().replace(/[^a-z0-9._-]/g, "").slice(0, 24) || "user";

  let candidate = clean;
  let n = 1;
  while (db.prepare("SELECT id FROM users WHERE username = ?").get(candidate)) {
    candidate = `${clean}${++n}`;
  }
  return candidate;
}
