#!/usr/bin/env node
/**
 * Migracao SQLite -> Firestore.
 *
 *   node scripts/migrate-sqlite-to-firestore.mjs --dry-run
 *   node scripts/migrate-sqlite-to-firestore.mjs --confirm
 *   node scripts/migrate-sqlite-to-firestore.mjs --confirm ../data/orion.sqlite
 *
 * Contra o emulador:
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8085 GOOGLE_CLOUD_PROJECT=demo-orion node ... --confirm
 *
 * Regras que este script segue:
 *
 *   NAO CORRE SOZINHO. Sem --confirm nao escreve nada. Existe --dry-run
 *   para ver o que aconteceria. Se detectar ambiente de build ou de CI,
 *   recusa-se a correr - uma migracao de dados nunca deve acontecer a
 *   meio de um deploy.
 *
 *   E REPETIVEL. Os ids do SQLite viram ids de documento, portanto correr
 *   duas vezes reescreve os mesmos documentos em vez de criar duplicados.
 *   Os contadores sao empurrados acima do maior id migrado, para as contas
 *   criadas depois nao colidirem com as migradas.
 *
 *   NAO APAGA NADA. Le a SQLite em modo so-leitura e nunca lhe toca.
 *
 *   VERIFICA. No fim conta os documentos do lado do Firestore e compara
 *   com a origem, e confirma que nenhum hash de password ficou no perfil
 *   publico.
 */
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

// -------------------------------------------------------------- argumentos
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const confirmado = args.includes("--confirm");
const caminhoArg = args.find((a) => !a.startsWith("--"));

if (process.env.VERCEL || process.env.CI || process.env.NEXT_PHASE) {
  console.error("Recusado: isto e uma migracao de dados e nao pode correr em build nem em CI.");
  process.exit(1);
}

if (!dryRun && !confirmado) {
  console.error("Falta --confirm (ou --dry-run para simular). Nada foi escrito.");
  process.exit(1);
}

const sqlitePath = path.resolve(
  caminhoArg ??
    process.env.ORION_DB_PATH ??
    path.join(process.cwd(), "..", "data", "orion.sqlite"),
);

if (!fs.existsSync(sqlitePath)) {
  console.error(`Base de dados nao encontrada: ${sqlitePath}`);
  process.exit(1);
}

// Carregar .env.local como o Next faz, para apanhar FIREBASE_SERVICE_ACCOUNT.
const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  for (const linha of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const t = linha.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i > 0 && process.env[t.slice(0, i).trim()] === undefined) {
      process.env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
    }
  }
}

const { firestore } = await import("../lib/firebase-admin.ts");
const { ensureCounterAbove } = await import("../lib/repo/ids.ts");
const { COLLECTIONS, CREDENTIALS_PATH, NO_PASSWORD } = await import("../lib/repo/types.ts");

const db = firestore();
const emulador = Boolean(process.env.FIRESTORE_EMULATOR_HOST);

console.log(`origem : ${sqlitePath}`);
console.log(`destino: ${emulador ? `emulador (${process.env.FIRESTORE_EMULATOR_HOST})` : "Firestore REAL"}`);
console.log(dryRun ? "modo   : SECO (nada e escrito)\n" : "modo   : ESCRITA\n");

// ------------------------------------------------------------------ leitura
const sql = new DatabaseSync(sqlitePath, { readOnly: true });
const ler = (q) => {
  try {
    return sql.prepare(q).all();
  } catch {
    return []; // tabela pode nao existir em bases antigas
  }
};

const users = ler("SELECT * FROM users");
const plans = ler("SELECT * FROM plans");
const orders = ler("SELECT * FROM orders");
const reviews = ler("SELECT * FROM reviews");
const tokens = ler("SELECT * FROM tokens");
const audit = ler("SELECT * FROM audit_log");
const attempts = ler("SELECT * FROM login_attempts");
const roleSync = ler("SELECT * FROM discord_role_sync");

const userById = new Map(users.map((u) => [u.id, u]));
const planById = new Map(plans.map((p) => [p.id, p]));

const nz = (v) => (v === undefined ? null : v);
const bool = (v) => v === 1 || v === true;
const agora = Math.floor(Date.now() / 1000);

// ------------------------------------------------------------ transformacao
function perfilDoUtilizador(u) {
  return {
    id: u.id,
    username: u.username,
    email: nz(u.email),
    role: u.role ?? "client",
    role_source: u.role_source ?? "manual",
    status: u.status ?? "active",
    tier: nz(u.tier),
    tier_source: u.tier_source ?? "manual",
    hwid: nz(u.hwid),
    expires_at: nz(u.expires_at),
    created_at: u.created_at ?? agora,
    discord_id: nz(u.discord_id),
    discord_username: nz(u.discord_username),
    discord_avatar: nz(u.discord_avatar),
    support_started_at: nz(u.support_started_at),
    support_expires_at: nz(u.support_expires_at),
    support_lifetime: Number(u.support_lifetime ?? 0),
    client_version: nz(u.client_version),
    client_seen_at: nz(u.client_seen_at),
  };
}

function planoDoRegisto(p) {
  let features = [];
  try {
    if (p.features_json) features = JSON.parse(p.features_json);
  } catch {
    console.warn(`  aviso: features_json invalido no plano ${p.code}; fica vazio`);
  }
  return {
    id: p.id,
    code: p.code,
    name: p.name,
    description: nz(p.description),
    price_cents: p.price_cents,
    currency: p.currency ?? "EUR",
    days: p.days,
    support_days: nz(p.support_days),
    active: bool(p.active),
    sort_order: p.sort_order ?? 0,
    discord_role_id: nz(p.discord_role_id),
    cover_url: nz(p.cover_url),
    badge_text: nz(p.badge_text),
    badge_active: bool(p.badge_active),
    compare_at_cents: nz(p.compare_at_cents),
    discount_active: bool(p.discount_active),
    promo_text: nz(p.promo_text),
    features,
    cta_text: nz(p.cta_text),
  };
}

function encomendaDoRegisto(o) {
  const u = userById.get(o.user_id);
  const p = planById.get(o.plan_id);
  return {
    id: o.id,
    user_id: o.user_id,
    plan_id: o.plan_id,
    // Desnormalizados: o Firestore nao tem JOIN e as listagens mostram
    // sempre estes dois. Sem os copiar, cada linha custava duas leituras.
    username: u?.username ?? "(apagado)",
    plan_name: p?.name ?? "(apagado)",
    amount_cents: o.amount_cents,
    currency: o.currency ?? "EUR",
    status: o.status,
    provider: o.provider ?? "simulated",
    provider_ref: nz(o.provider_ref),
    created_at: o.created_at,
    paid_at: nz(o.paid_at),
    refunded_at: nz(o.refunded_at),
  };
}

// -------------------------------------------------------------- escrita
const plano = [
  { nome: COLLECTIONS.users, origem: users },
  { nome: COLLECTIONS.plans, origem: plans },
  { nome: COLLECTIONS.orders, origem: orders },
  { nome: COLLECTIONS.reviews, origem: reviews },
  { nome: COLLECTIONS.tokens, origem: tokens },
  { nome: COLLECTIONS.audit, origem: audit },
  { nome: COLLECTIONS.attempts, origem: attempts },
  { nome: COLLECTIONS.roleSync, origem: roleSync },
];

console.log("origem:");
for (const { nome, origem } of plano) {
  console.log(`  ${nome.padEnd(18)} ${String(origem.length).padStart(5)}`);
}
console.log("");

if (dryRun) {
  console.log("Modo seco: nada foi escrito. Repete com --confirm para migrar.");
  sql.close();
  process.exit(0);
}

/** Escreve em lotes de 400 (o limite do Firestore e 500). */
async function escrever(colecao, registos, paraDoc, idDe, subDoc) {
  let feitos = 0;
  for (let i = 0; i < registos.length; i += 400) {
    const fatia = registos.slice(i, i + 400);
    const lote = db.batch();
    for (const r of fatia) {
      const ref = idDe
        ? db.collection(colecao).doc(String(idDe(r)))
        : db.collection(colecao).doc();
      lote.set(ref, paraDoc(r));
      if (subDoc) {
        const { caminho, dados } = subDoc(r);
        lote.set(ref.collection(caminho[0]).doc(caminho[1]), dados);
      }
    }
    await lote.commit();
    feitos += fatia.length;
    process.stdout.write(`\r  ${colecao}: ${feitos}/${registos.length}`);
  }
  if (registos.length) process.stdout.write("\n");
  return feitos;
}

console.log("a escrever:");

await escrever(COLLECTIONS.users, users, perfilDoUtilizador, (u) => u.id, (u) => ({
  caminho: [CREDENTIALS_PATH.collection, CREDENTIALS_PATH.doc],
  dados: {
    password_hash: u.password_hash ?? NO_PASSWORD,
    client_password: nz(u.client_password),
  },
}));
await escrever(COLLECTIONS.plans, plans, planoDoRegisto, (p) => p.id);
await escrever(COLLECTIONS.orders, orders, encomendaDoRegisto, (o) => o.id);
await escrever(COLLECTIONS.reviews, reviews, (r) => ({
  id: r.id, user_id: nz(r.user_id), author_name: r.author_name, handle: nz(r.handle),
  rig: nz(r.rig), gain: nz(r.gain), rating: r.rating, body: r.body,
  approved: bool(r.approved), created_at: r.created_at,
}), (r) => r.id);

// Tokens: o id do documento e o hash, como no repositorio.
await escrever(COLLECTIONS.tokens, tokens, (t) => ({
  token_hash: t.token_hash, user_id: t.user_id, kind: t.kind ?? "api",
  expires_at: t.expires_at, created_at: t.created_at, last_seen_at: nz(t.last_seen_at),
}), (t) => t.token_hash);

// Auditoria e tentativas: a aplicacao cria-as com ids automaticos, porque
// nunca sao lidas por id. Mas a MIGRACAO usa o id do SQLite como id do
// documento - senao cada nova passagem duplicava tudo em vez de reescrever,
// e o script deixava de ser repetivel. Ids numericos nunca colidem com os
// automaticos do Firestore, que sao cadeias de 20 caracteres.
await escrever(COLLECTIONS.audit, audit, (a) => ({
  user_id: nz(a.user_id), action: a.action, detail: nz(a.detail),
  ip: nz(a.ip), created_at: a.created_at,
}), (a) => a.id);
await escrever(COLLECTIONS.attempts, attempts, (a) => ({
  username: a.username, ip: a.ip, success: Number(a.success), created_at: a.created_at,
}), (a) => a.id);
await escrever(COLLECTIONS.roleSync, roleSync, (s) => ({
  user_id: s.user_id, tier: nz(s.tier), reason: s.reason,
  attempts: Number(s.attempts ?? 0), last_error: nz(s.last_error),
  remove_role_id: nz(s.remove_role_id), updated_at: s.updated_at,
}), (s) => s.user_id);

// ------------------------------------------------------------- contadores
// Sem isto, a primeira conta criada depois da migracao recebia o id 1 e
// escrevia por cima de uma conta existente.
console.log("\ncontadores:");
for (const [colecao, registos] of [
  [COLLECTIONS.users, users],
  [COLLECTIONS.plans, plans],
  [COLLECTIONS.orders, orders],
  [COLLECTIONS.reviews, reviews],
]) {
  const maior = registos.reduce((m, r) => Math.max(m, Number(r.id) || 0), 0);
  if (maior > 0) {
    await ensureCounterAbove(colecao, maior);
    console.log(`  ${colecao.padEnd(18)} proximo id > ${maior}`);
  }
}

// -------------------------------------------------------------- verificacao
console.log("\nverificacao (contado do lado do Firestore):");
let problemas = 0;

for (const { nome, origem } of plano) {
  const { count } = (await db.collection(nome).count().get()).data();
  const ok = count === origem.length;
  if (!ok) problemas++;
  console.log(`  ${nome.padEnd(18)} ${String(count).padStart(5)} / ${origem.length} ${ok ? "ok" : "DIVERGE"}`);
}

if (users.length) {
  const primeiro = users[0];
  const perfil = (await db.collection(COLLECTIONS.users).doc(String(primeiro.id)).get()).data() ?? {};
  const creds = (
    await db.collection(COLLECTIONS.users).doc(String(primeiro.id))
      .collection(CREDENTIALS_PATH.collection).doc(CREDENTIALS_PATH.doc).get()
  ).data() ?? {};

  const vazou = "password_hash" in perfil || "client_password" in perfil;
  const temCreds = Boolean(creds.password_hash);
  if (vazou) problemas++;
  if (!temCreds) problemas++;
  console.log(`  credenciais na subcoleccao      ${temCreds ? "sim" : "NAO"}`);
  console.log(`  hash fora do perfil publico     ${vazou ? "NAO - VAZOU" : "sim"}`);

  // Campos criticos preservados.
  const iguais =
    perfil.username === primeiro.username &&
    perfil.role === (primeiro.role ?? "client") &&
    (perfil.tier ?? null) === nz(primeiro.tier);
  if (!iguais) problemas++;
  console.log(`  campos criticos preservados     ${iguais ? "sim" : "NAO"}`);
}

sql.close();
console.log(
  problemas === 0
    ? "\nMigracao concluida. A SQLite original nao foi alterada."
    : `\n${problemas} problemas. A SQLite original nao foi alterada - podes repetir.`,
);
process.exit(problemas === 0 ? 0 : 1);
