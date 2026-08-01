/**
 * Administracao de contas - so por linha de comandos.
 *
 * Substitui server/admin/orion-admin.php. Continua a nao haver painel de
 * administracao acessivel por HTTP: um endpoint que cria contas seria a maior
 * superficie de ataque do projeto.
 *
 *   node scripts/admin.ts create <user> [--days=30] [--pass=xxx] [--role=client]
 *   node scripts/admin.ts list
 *   node scripts/admin.ts suspend <user>
 *   node scripts/admin.ts activate <user>
 *   node scripts/admin.ts reset-hwid <user>
 *   node scripts/admin.ts passwd <user> [--pass=xxx]
 *   node scripts/admin.ts delete <user>
 *   node scripts/admin.ts audit [--limit=20]
 */

import crypto from "node:crypto";
import { loadEnvLocal, maskSecret } from "../lib/env.ts";

// Tem de vir ANTES de db.ts: e la que ORION_DB_PATH e lido, e se o .env.local
// so fosse carregado depois o CLI abria outra base de dados que o site.
loadEnvLocal();

const { getDb, audit, nowSeconds, DB_FILE } = await import("../lib/db.ts");
const { hashPassword, revokeAllTokens } = await import("../lib/auth.ts");
type User = import("../lib/db.ts").User;

const argv = process.argv.slice(2);
const flags = new Map<string, string>();
const positional: string[] = [];

for (const a of argv) {
  const m = /^--([a-z-]+)(?:=(.*))?$/i.exec(a);
  if (m) flags.set(m[1], m[2] ?? "true");
  else positional.push(a);
}

const command = positional[0] ?? "help";
const target = positional[1];

const db = getDb();
const out = (s = "") => console.log(s);

function needUser(): string {
  if (!target) {
    out("Falta o nome de utilizador.");
    process.exit(1);
  }
  return target;
}

function findOrExit(username: string): User {
  const u = db.prepare("SELECT * FROM users WHERE username = ?").get(username) as
    | User
    | undefined;
  if (!u) {
    out(`Utilizador '${username}' nao existe.`);
    process.exit(1);
  }
  return u;
}

/** Legivel mas com entropia suficiente (~74 bits). Sem l/I/0/O. */
function genPassword(len = 14): string {
  const alphabet = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < len; i++) {
    s += alphabet[crypto.randomInt(alphabet.length)];
  }
  return s;
}

switch (command) {
  case "create": {
    const username = needUser();

    if (db.prepare("SELECT id FROM users WHERE username = ?").get(username)) {
      out(`Utilizador '${username}' ja existe.`);
      process.exit(1);
    }

    const password = flags.get("pass") ?? genPassword();
    const days = Number(flags.get("days") ?? 0);
    const role = flags.get("role") ?? "client";
    const expires = days > 0 ? nowSeconds() + days * 86400 : null;

    if (!["member", "client", "staff", "developer", "owner"].includes(role)) {
      out(`Papel invalido: ${role}. Usa client, developer ou owner.`);
      process.exit(1);
    }

    db.prepare(
      `INSERT INTO users (username, password_hash, client_password, role, status, hwid, expires_at, created_at)
       VALUES (?, ?, ?, ?, 'active', NULL, ?, ?)`,
    ).run(username, hashPassword(password), password, role, expires, nowSeconds());

    const id = db.prepare("SELECT id FROM users WHERE username = ?").get(username) as {
      id: number;
    };
    audit(id.id, "admin_create", username);

    out("");
    out("  Conta criada");
    out("  ------------------------------------");
    out(`  Utilizador : ${username}`);
    out(`  Password   : ${password}`);
    out(`  Papel      : ${role}`);
    out(`  Validade   : ${expires ? new Date(expires * 1000).toLocaleString() : "sem limite"}`);
    out("  Maquina    : sera ligada no primeiro login");
    out("");
    out("  A password fica visivel para o owner no painel.");
    out("");
    break;
  }

  case "list": {
    const rows = db
      .prepare("SELECT * FROM users ORDER BY created_at DESC")
      .all() as User[];

    if (!rows.length) {
      out("Sem contas.");
      break;
    }

    out("");
    out(
      "  " +
        "UTILIZADOR".padEnd(20) +
        "PAPEL".padEnd(11) +
        "ESTADO".padEnd(11) +
        "VALIDADE".padEnd(20) +
        "MAQUINA",
    );
    out("  " + "-".repeat(72));

    for (const r of rows) {
      let exp = r.expires_at ? new Date(r.expires_at * 1000).toISOString().slice(0, 10) : "sem limite";
      if (r.expires_at && r.expires_at < nowSeconds()) exp += " (expirada)";

      out(
        "  " +
          r.username.padEnd(20) +
          r.role.padEnd(11) +
          r.status.padEnd(11) +
          exp.padEnd(20) +
          (r.hwid ? r.hwid.slice(0, 8) : "-"),
      );
    }
    out("");
    break;
  }

  case "suspend":
  case "activate": {
    const username = needUser();
    const user = findOrExit(username);
    const status = command === "suspend" ? "suspended" : "active";

    db.prepare("UPDATE users SET status = ? WHERE id = ?").run(status, user.id);

    // Suspender tem de matar as sessoes abertas, senao o token continua a
    // servir catalogo ate expirar sozinho.
    if (status === "suspended") revokeAllTokens(user.id);

    audit(user.id, `admin_${command}`, username);
    out(`'${username}' -> ${status}${status === "suspended" ? " (sessoes terminadas)" : ""}`);
    break;
  }

  case "reset-hwid": {
    const username = needUser();
    const user = findOrExit(username);
    db.prepare("UPDATE users SET hwid = NULL WHERE id = ?").run(user.id);
    audit(user.id, "admin_reset_hwid", username);
    out(`Maquina desligada de '${username}'. O proximo login liga uma nova.`);
    break;
  }

  case "passwd": {
    const username = needUser();
    const user = findOrExit(username);
    const password = flags.get("pass") ?? genPassword();

    db.prepare("UPDATE users SET password_hash = ?, client_password = ? WHERE id = ?").run(
      hashPassword(password),
      password,
      user.id,
    );
    revokeAllTokens(user.id);

    audit(user.id, "admin_passwd", username);
    out(`Nova password de '${username}': ${password}`);
    break;
  }

  case "delete": {
    const username = needUser();
    const user = findOrExit(username);
    db.prepare("DELETE FROM tokens WHERE user_id = ?").run(user.id);
    db.prepare("DELETE FROM users WHERE id = ?").run(user.id);

    // As tentativas falhadas sao indexadas por nome+IP, nao por id, logo
    // sobreviviam a conta. Sem isto, recriar uma conta com o mesmo nome
    // herdava o bloqueio de forca bruta da anterior.
    db.prepare("DELETE FROM login_attempts WHERE username = ?").run(username);

    audit(null, "admin_delete", username);
    out(`'${username}' apagado.`);
    break;
  }

  case "check-discord": {
    const need = [
      ["DISCORD_CLIENT_ID", false],
      ["DISCORD_CLIENT_SECRET", true],
      ["DISCORD_GUILD_ID", false],
    ] as const;

    out("");
    out("  Configuracao");
    out("  ------------------------------------------------");
    for (const [key, secret] of need) {
      const v = process.env[key];
      const shown = v ? (secret ? maskSecret(v) : v) : "EM FALTA";
      out(`  ${key.padEnd(24)} ${shown}`);
    }

    const roles = [
      "DISCORD_ROLE_OWNER",
      "DISCORD_ROLE_DEVELOPER",
      "DISCORD_ROLE_STAFF",
      "DISCORD_ROLE_MEMBER",
      "DISCORD_TIER_ULTIMATE",
      "DISCORD_TIER_PRO",
      "DISCORD_TIER_BASIC",
    ];
    out("");
    out("  Cargos");
    out("  ------------------------------------------------");
    for (const key of roles) {
      out(`  ${key.padEnd(24)} ${process.env[key] || "(vazio)"}`);
    }

    const missing = need.filter(([k]) => !process.env[k]).map(([k]) => k);
    if (missing.length) {
      out("");
      out(`  Falta preencher: ${missing.join(", ")}`);
      out("  O botao do Discord fica desativado ate estarem os tres.");
      out("");
      break;
    }

    // --- validar contra o Discord a serio -------------------------------
    out("");
    out("  A validar contra o Discord...");

    const guildId = process.env.DISCORD_GUILD_ID!;

    // client_credentials confirma que ID e Secret batem certo, sem precisar
    // de nenhum utilizador a autorizar.
    const basic = Buffer.from(
      `${process.env.DISCORD_CLIENT_ID}:${process.env.DISCORD_CLIENT_SECRET}`,
    ).toString("base64");

    let appOk = false;
    try {
      const res = await fetch("https://discord.com/api/v10/oauth2/token", {
        method: "POST",
        headers: {
          Authorization: `Basic ${basic}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ grant_type: "client_credentials", scope: "identify" }),
      });
      appOk = res.ok;
      if (!res.ok) {
        out(`  [X] Client ID/Secret recusados pelo Discord (HTTP ${res.status}).`);
        out("      Confirma que copiaste do separador OAuth2 da aplicacao certa.");
      } else {
        out("  [OK] Client ID e Secret validos.");
      }
    } catch (e) {
      out(`  [X] Nao foi possivel contactar o Discord: ${(e as Error).message}`);
    }

    try {
      const res = await fetch(`https://discord.com/api/v10/guilds/${guildId}/preview`, {
        headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN ?? ""}` },
      });
      // Sem bot no servidor isto da 401, o que e normal e nao e problema:
      // o login usa o token do utilizador, nao um bot.
      if (res.ok) {
        const g = (await res.json()) as { name?: string };
        out(`  [OK] Servidor encontrado: ${g.name}`);
      } else {
        out(`  [--] Servidor nao verificavel sem bot (HTTP ${res.status}) - normal.`);
      }
    } catch { /* ignorar */ }

    out("");
    out(`  Redirect URI a registar no portal do Discord:`);
    out(`    ${(process.env.APP_URL ?? "http://localhost:3400").replace(/\/$/, "")}/api/auth/discord/callback`);
    out("");
    if (appOk) {
      out("  Tudo pronto. Recarrega /panel/login e o botao fica ativo.");
    }
    out("");
    break;
  }

  case "db": {
    out("");
    out(`  Ficheiro : ${DB_FILE}`);
    out("");
    out("  E um SQLite normal. Para o abrir numa interface grafica:");
    out("    DB Browser for SQLite  ->  sqlitebrowser.org  (gratuito)");
    out("");
    out("  Ou daqui mesmo:");
    out('    node scripts/admin.ts sql "SELECT * FROM users"');
    out("");
    break;
  }

  case "sql": {
    const query = positional[1];
    if (!query) {
      out('Falta a consulta. Exemplo: node scripts/admin.ts sql "SELECT * FROM users"');
      process.exit(1);
    }

    // Escritas exigem --write. Um SELECT mal escrito nao estraga nada; um
    // DELETE sem WHERE apaga a base de dados toda sem aviso.
    const isRead = /^\s*(SELECT|PRAGMA|EXPLAIN|WITH)\b/i.test(query);
    if (!isRead && !flags.has("write")) {
      out("");
      out("  Esta consulta escreve na base de dados.");
      out("  Repete com --write se e mesmo isso que queres:");
      out(`    node scripts/admin.ts sql "${query}" --write`);
      out("");
      process.exit(1);
    }

    try {
      if (isRead) {
        const rows = db.prepare(query).all() as Record<string, unknown>[];
        if (!rows.length) {
          out("(sem resultados)");
          break;
        }
        out("");
        const cols = Object.keys(rows[0]);
        const width = (c: string) =>
          Math.min(38, Math.max(c.length, ...rows.map((r) => String(r[c] ?? "").length)));
        const widths = Object.fromEntries(cols.map((c) => [c, width(c)]));

        out("  " + cols.map((c) => c.padEnd(widths[c])).join("  "));
        out("  " + cols.map((c) => "-".repeat(widths[c])).join("  "));
        for (const r of rows) {
          out(
            "  " +
              cols
                .map((c) => String(r[c] ?? "").slice(0, 38).padEnd(widths[c]))
                .join("  "),
          );
        }
        out("");
        out(`  ${rows.length} linhas`);
        out("");
      } else {
        const res = db.prepare(query).run();
        out(`${res.changes} linhas afetadas.`);
        audit(null, "admin_sql_write", query.slice(0, 120));
      }
    } catch (e) {
      out(`Erro: ${(e as Error).message}`);
      process.exit(1);
    }
    break;
  }

  case "set-role": {
    const username = needUser();
    const role = positional[2];

    if (!role || !["member", "client", "staff", "developer", "owner"].includes(role)) {
      out("Papel invalido. Usa: member, client, staff, developer ou owner.");
      process.exit(1);
    }

    const user = findOrExit(username);

    // role_source='manual' impede que o proximo login por Discord reescreva
    // isto. Sem esta marca, perder um cargo no servidor tirava-te o painel.
    db.prepare("UPDATE users SET role = ?, role_source = 'manual' WHERE id = ?").run(role, user.id);
    audit(user.id, "admin_set_role", `${username} -> ${role}`);

    out(`'${username}' e agora ${role} (fixado a mao, o Discord nao lhe toca).`);
    break;
  }

  case "set-password": {
    const username = needUser();
    const user = findOrExit(username);
    const password = flags.get("pass") ?? genPassword();

    db.prepare("UPDATE users SET password_hash = ?, client_password = ? WHERE id = ?").run(
      hashPassword(password),
      password,
      user.id,
    );
    audit(user.id, "admin_set_password", username);

    out(`Password de '${username}' para o cliente Windows: ${password}`);
    break;
  }

  case "link-discord": {
    const username = needUser();
    const discordId = positional[2];

    if (!discordId || !/^\d{15,25}$/.test(discordId)) {
      out("Falta o ID de Discord (so digitos). Botao direito no teu perfil -> Copiar ID.");
      process.exit(1);
    }

    const user = findOrExit(username);
    try {
      db.prepare("UPDATE users SET discord_id = ? WHERE id = ?").run(discordId, user.id);
    } catch {
      out("Esse ID de Discord ja esta ligado a outra conta.");
      process.exit(1);
    }

    audit(user.id, "admin_link_discord", `${username} -> ${discordId}`);
    out(`'${username}' ligado ao Discord ${discordId}. O proximo login por Discord entra nesta conta.`);
    break;
  }

  case "review": {
    const sub = positional[1];

    if (sub === "add") {
      const author = flags.get("author");
      const bodyText = flags.get("body");

      if (!author || !bodyText) {
        out('Uso: review add --author="Nome" --body="texto" [--rig="RTX 3060"] [--gain="60 -> 120 FPS"] [--handle="@x"] [--rating=5]');
        process.exit(1);
      }

      db.prepare(
        `INSERT INTO reviews (author_name, handle, rig, gain, rating, body, approved, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 0, ?)`,
      ).run(
        author,
        flags.get("handle") ?? null,
        flags.get("rig") ?? null,
        flags.get("gain") ?? null,
        Number(flags.get("rating") ?? 5),
        bodyText,
        nowSeconds(),
      );

      out("Avaliacao guardada por aprovar. Publica-a com: review approve <id>");
    } else if (sub === "approve" || sub === "hide") {
      const id = Number(positional[2]);
      if (!id) {
        out("Falta o id da avaliacao.");
        process.exit(1);
      }
      db.prepare("UPDATE reviews SET approved = ? WHERE id = ?").run(sub === "approve" ? 1 : 0, id);
      out(`Avaliacao #${id} ${sub === "approve" ? "publicada" : "escondida"}.`);
    } else if (sub === "delete") {
      const id = Number(positional[2]);
      db.prepare("DELETE FROM reviews WHERE id = ?").run(id);
      out(`Avaliacao #${id} apagada.`);
    } else {
      const rows = db
        .prepare("SELECT id, author_name, rating, approved, gain FROM reviews ORDER BY created_at DESC")
        .all() as Array<{ id: number; author_name: string; rating: number; approved: number; gain: string | null }>;

      if (!rows.length) {
        out("Ainda nao ha avaliacoes.");
        break;
      }
      out("");
      for (const r of rows) {
        out(
          `  #${String(r.id).padEnd(4)} ${r.author_name.padEnd(20)} ${"★".repeat(r.rating).padEnd(6)} ` +
            `${(r.gain ?? "").padEnd(20)} ${r.approved ? "publicada" : "por aprovar"}`,
        );
      }
      out("");
    }
    break;
  }

  case "audit": {
    const limit = Math.max(1, Number(flags.get("limit") ?? 20));
    const rows = db
      .prepare(
        `SELECT a.*, u.username FROM audit_log a
         LEFT JOIN users u ON u.id = a.user_id
         ORDER BY a.id DESC LIMIT ?`,
      )
      .all(limit) as Array<{
      created_at: number;
      action: string;
      username: string | null;
      detail: string | null;
    }>;

    out("");
    for (const r of rows.reverse()) {
      out(
        "  " +
          new Date(r.created_at * 1000).toISOString().replace("T", " ").slice(0, 19) +
          "  " +
          r.action.padEnd(22) +
          (r.username ?? "-").padEnd(14) +
          (r.detail ?? ""),
      );
    }
    out("");
    break;
  }

  default:
    out("");
    out("  Orion Optimizer - administracao de contas");
    out("");
    out("    create <user> [--days=30] [--pass=xxx] [--role=client]");
    out("    list");
    out("    suspend <user>");
    out("    activate <user>");
    out("    reset-hwid <user>");
    out("    passwd <user> [--pass=xxx]");
    out("    delete <user>");
    out("    audit [--limit=20]");
    out("");
    out("  Papeis e Discord");
    out("    set-role <user> <client|developer|owner>   fixa o papel a mao");
    out("    link-discord <user> <discord_id>          liga uma conta existente");
    out("    set-password <user> [--pass=xxx]          password para o cliente Windows");
    out("");
    out("  Avaliacoes");
    out("    review                                    listar");
    out('    review add --author="X" --body="..."       criar (fica por aprovar)');
    out("    review approve <id> | hide <id> | delete <id>");
    out("");
    out("  Discord");
    out("    check-discord                             validar a configuracao");
    out("");
    out("  Base de dados");
    out("    db                                        onde esta o ficheiro");
    out('    sql "SELECT * FROM users"                 consultar (--write para escrever)');
    out("");
}
