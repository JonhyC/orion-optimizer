import crypto from "node:crypto";
import { firestore } from "../firebase-admin.ts";
import { allocateId } from "./ids.ts";
import {
  COLLECTIONS,
  CREDENTIALS_PATH,
  NO_PASSWORD,
  type Role,
  type Source,
  type User,
  type UserCredentials,
  type UserProfile,
} from "./types.ts";

/**
 * Utilizadores.
 *
 * As credenciais (password_hash, client_password) vivem numa subcoleccao
 * privada e nao no documento do perfil. Duas razoes: uma leitura de perfil
 * acontece em cada pagina e nao tem de arrastar hashes consigo; e se um dia
 * ligarmos tempo real, nenhuma regra de leitura do proprio perfil pode
 * entregar um hash de password por descuido.
 *
 * Quem so precisa do perfil usa `findProfileById`. Quem vai verificar uma
 * password usa `findById`, que junta as duas leituras.
 */

const AGORA = () => Math.floor(Date.now() / 1000);

function col() {
  return firestore().collection(COLLECTIONS.users);
}

function credsRef(id: number) {
  return col().doc(String(id)).collection(CREDENTIALS_PATH.collection).doc(CREDENTIALS_PATH.doc);
}

/** Valores por omissao dos campos que o SQLite preenchia com DEFAULT. */
function normalizar(dados: Partial<UserProfile>, id: number): UserProfile {
  return {
    id,
    username: dados.username ?? "",
    email: dados.email ?? null,
    role: (dados.role ?? "client") as Role,
    tier: dados.tier ?? null,
    tier_source: (dados.tier_source ?? "manual") as Source,
    role_source: (dados.role_source ?? "manual") as Source,
    status: dados.status ?? "active",
    hwid: dados.hwid ?? null,
    expires_at: dados.expires_at ?? null,
    created_at: dados.created_at ?? 0,
    discord_id: dados.discord_id ?? null,
    discord_username: dados.discord_username ?? null,
    discord_avatar: dados.discord_avatar ?? null,
    support_started_at: dados.support_started_at ?? null,
    support_expires_at: dados.support_expires_at ?? null,
    support_lifetime: dados.support_lifetime ?? 0,
    client_version: dados.client_version ?? null,
    client_seen_at: dados.client_seen_at ?? null,
  };
}

// ------------------------------------------------------------------ leitura

export async function findProfileById(id: number): Promise<UserProfile | null> {
  const snap = await col().doc(String(id)).get();
  if (!snap.exists) return null;
  return normalizar(snap.data() as Partial<UserProfile>, id);
}

export async function findCredentials(id: number): Promise<UserCredentials> {
  const snap = await credsRef(id).get();
  const dados = snap.exists ? (snap.data() as Partial<UserCredentials>) : {};
  return {
    // Sem credenciais gravadas a conta e de Discord: o marcador nao parseia
    // como scrypt$, logo verifyPassword recusa-a sempre.
    password_hash: dados.password_hash ?? NO_PASSWORD,
    client_password: dados.client_password ?? null,
  };
}

/** Perfil e credenciais juntos, na forma que o SQLite devolvia. */
export async function findById(id: number): Promise<User | null> {
  // Em paralelo: sao dois documentos independentes e encadea-los somava
  // duas viagens a Belgica em vez de uma.
  const [perfil, creds] = await Promise.all([findProfileById(id), findCredentials(id)]);
  if (!perfil) return null;
  return { ...perfil, ...creds };
}

async function primeiroPorCampo(campo: string, valor: string): Promise<UserProfile | null> {
  const snap = await col().where(campo, "==", valor).limit(1).get();
  if (snap.empty) return null;
  const doc = snap.docs[0];
  return normalizar(doc.data() as Partial<UserProfile>, Number(doc.id));
}

export async function findProfileByUsername(username: string): Promise<UserProfile | null> {
  return primeiroPorCampo("username", username);
}

export async function findByUsername(username: string): Promise<User | null> {
  const perfil = await findProfileByUsername(username);
  if (!perfil) return null;
  return { ...perfil, ...(await findCredentials(perfil.id)) };
}

export async function findProfileByDiscordId(discordId: string): Promise<UserProfile | null> {
  return primeiroPorCampo("discord_id", discordId);
}

export async function listProfiles(limite = 500): Promise<UserProfile[]> {
  const snap = await col().orderBy("created_at", "desc").limit(limite).get();
  return snap.docs.map((d) => normalizar(d.data() as Partial<UserProfile>, Number(d.id)));
}

export async function countUsers(): Promise<number> {
  const snap = await col().count().get();
  return snap.data().count;
}

// ------------------------------------------------------------------ escrita

export async function updateProfile(id: number, patch: Partial<UserProfile>): Promise<void> {
  const { id: _ignorado, ...campos } = patch;
  await col().doc(String(id)).set(campos, { merge: true });
}

export async function setCredentials(id: number, patch: Partial<UserCredentials>): Promise<void> {
  await credsRef(id).set(patch, { merge: true });
}

export async function createUser(
  dados: Omit<Partial<UserProfile>, "id"> & { username: string },
  credenciais: UserCredentials,
): Promise<UserProfile> {
  const id = await allocateId(COLLECTIONS.users);
  const perfil = normalizar({ ...dados, created_at: dados.created_at ?? AGORA() }, id);

  const lote = firestore().batch();
  lote.set(col().doc(String(id)), perfil);
  lote.set(credsRef(id), credenciais);
  await lote.commit();

  return perfil;
}

export async function deleteUser(id: number): Promise<void> {
  // A subcoleccao nao desaparece com o documento pai: no Firestore os
  // filhos sobrevivem ao pai apagado e ficariam orfaos para sempre.
  const lote = firestore().batch();
  lote.delete(credsRef(id));
  lote.delete(col().doc(String(id)));
  await lote.commit();
}

// ------------------------------------------------------- operacoes atomicas

/**
 * Liga a licenca a uma maquina, se ainda nao estiver ligada.
 *
 * Transaccional porque duas maquinas a autenticar-se ao mesmo tempo
 * poderiam ambas ver `hwid` vazio e ambas gravar o seu - e a licenca
 * ficava ligada a ultima que escrevesse, sem ninguem dar por isso.
 *
 * Devolve o que aconteceu, para quem chama saber se deve registar a
 * associacao na auditoria.
 */
export async function bindHwid(
  userId: number,
  hwid: string,
): Promise<{ ok: boolean; bound: boolean; existing: string | null }> {
  const db = firestore();
  const ref = col().doc(String(userId));

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return { ok: false, bound: false, existing: null };

    const atual = (snap.data() as Partial<UserProfile>).hwid ?? null;
    if (!atual) {
      tx.update(ref, { hwid });
      return { ok: true, bound: true, existing: null };
    }

    // Comparacao de tempo constante: o hwid identifica a maquina e nao
    // deve ser possivel descobri-lo byte a byte pelo tempo de resposta.
    const a = Buffer.from(atual);
    const b = Buffer.from(hwid);
    const igual = a.length === b.length && crypto.timingSafeEqual(a, b);
    return { ok: igual, bound: false, existing: atual };
  });
}

/**
 * Cria ou actualiza o utilizador vindo do login Discord.
 *
 * Transaccional porque dois logins simultaneos da mesma conta Discord
 * encontrariam ambos "nao existe" e criariam duas contas para a mesma
 * pessoa - com dois ids diferentes, duas licencas e nenhuma forma limpa
 * de as juntar depois.
 *
 * As decisoes manuais do owner ganham sempre ao Discord: se o cargo ou o
 * plano foram fixados a mao (`role_source`/`tier_source` = 'manual'), o
 * Discord nao lhes toca.
 */
export async function upsertFromDiscord(params: {
  discordId: string;
  discordUsername: string;
  discordAvatar: string | null;
  usernameBase: string;
  role: Role;
  tier: string | null;
}): Promise<UserProfile> {
  const db = firestore();

  // O id e alocado antes da transaccao: allocateId corre a sua propria
  // transaccao e o Firestore nao permite aninha-las. Se a transaccao
  // abaixo nao chegar a criar nada, perde-se um numero - os ids sao
  // baratos e um buraco na sequencia nao tem consequencia.
  const idReservado = await allocateId(COLLECTIONS.users);
  const usernameLivre = await escolherUsername(params.usernameBase, idReservado);

  return db.runTransaction(async (tx) => {
    const existentes = await tx.get(
      col().where("discord_id", "==", params.discordId).limit(1),
    );

    if (!existentes.empty) {
      const doc = existentes.docs[0];
      const id = Number(doc.id);
      const actual = normalizar(doc.data() as Partial<UserProfile>, id);

      const proximoRole = actual.role_source === "manual" ? actual.role : params.role;
      const proximoTier = actual.tier_source === "manual" ? actual.tier : params.tier;
      // 'client' sem plano nenhum nao faz sentido - essa pessoa e 'member'.
      const roleNormalizado: Role =
        proximoRole === "client" && !proximoTier ? "member" : proximoRole;

      const patch = {
        discord_username: params.discordUsername,
        discord_avatar: params.discordAvatar,
        role: roleNormalizado,
        tier: proximoTier,
      };
      tx.update(doc.ref, patch);
      return { ...actual, ...patch };
    }

    const perfil = normalizar(
      {
        username: usernameLivre,
        role: params.role,
        tier: params.tier,
        role_source: "discord",
        tier_source: "discord",
        status: "active",
        discord_id: params.discordId,
        discord_username: params.discordUsername,
        discord_avatar: params.discordAvatar,
        created_at: AGORA(),
      },
      idReservado,
    );

    tx.set(col().doc(String(idReservado)), perfil);
    tx.set(credsRef(idReservado), { password_hash: NO_PASSWORD, client_password: null });
    return perfil;
  });
}

/**
 * Username livre a partir do nome do Discord.
 *
 * O original percorria "nome", "nome2", "nome3"... com uma query por
 * tentativa. Aqui tenta o nome limpo e, se estiver ocupado, cai logo para
 * um sufixo derivado do id - que e unico por construcao. Evita um ciclo
 * de queries de comprimento imprevisivel no caminho do login.
 */
async function escolherUsername(base: string, id: number): Promise<string> {
  const limpo = base.toLowerCase().replace(/[^a-z0-9._-]/g, "").slice(0, 24) || "user";
  const ocupado = await col().where("username", "==", limpo).limit(1).get();
  return ocupado.empty ? limpo : `${limpo}${id}`;
}
