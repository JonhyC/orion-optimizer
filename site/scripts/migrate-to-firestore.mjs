#!/usr/bin/env node
/**
 * Migracao SQLite -> Firestore.
 *
 *   node scripts/migrate-to-firestore.mjs [--dry] [caminho/para/orion.sqlite]
 *
 * Corre a partir de site/, como o admin.ts: precisa do firebase-admin, que
 * so existe em site/node_modules.
 *
 * Contra o emulador:  FIRESTORE_EMULATOR_HOST=127.0.0.1:8085 GOOGLE_CLOUD_PROJECT=demo-orion node ...
 * Contra o projecto real: GOOGLE_APPLICATION_CREDENTIALS=/caminho/service-account.json node ...
 *
 * Tres decisoes de desenho que nao sao obvias:
 *
 * 1. CREDENCIAIS FORA DO DOCUMENTO DO UTILIZADOR.
 *    O password_hash e o client_password vao para users/{id}/private/creds.
 *    O tempo real do Firestore poe o BROWSER a ler a base de dados
 *    directamente, com as Security Rules a decidir o que passa. Se estes
 *    campos ficassem em users/{id}, qualquer regra que deixasse alguem ler
 *    o proprio perfil entregava-lhe tambem o hash da password. Numa
 *    subcoleccao propria, as Rules negam-na a toda a gente e so o servidor
 *    (Admin SDK, que ignora Rules) lhe chega.
 *
 * 2. ENCOMENDAS DESNORMALIZADAS.
 *    Cada order leva username e plan_name copiados la para dentro. O
 *    Firestore nao tem JOIN: recentOrders() cruzava tres tabelas, e sem
 *    isto cada listagem de 8 encomendas custava 17 leituras em vez de 8.
 *    A troca e que renomear um plano exige actualizar as encomendas dele -
 *    fica registado aqui para nao ser uma surpresa daqui a seis meses.
 *
 * 3. IDs MANTIDOS.
 *    O id inteiro do SQLite vira id do documento (como string). Assim os
 *    user_id/plan_id ja gravados continuam a apontar para o sitio certo e
 *    a migracao nao tem de reescrever referencias.
 */
import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const dry = process.argv.includes("--dry");
const dbArg = process.argv.slice(2).find((a) => !a.startsWith("--"));
// Mesma convencao do resto do projecto: a base de dados fica em ../data
// relativamente a site/. Ver lib/storage-paths.ts.
const dbPath =
  dbArg ??
  process.env.ORION_DB_PATH ??
  path.join(process.cwd(), "..", "data", "orion.sqlite");

const emulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
initializeApp(
  emulator
    ? { projectId: process.env.GOOGLE_CLOUD_PROJECT ?? "demo-orion" }
    : { credential: applicationDefault() },
);
const fs = getFirestore();

const sql = new DatabaseSync(dbPath, { readOnly: true });
const all = (q) => sql.prepare(q).all();

const nz = (v) => (v === undefined ? null : v);
const bool = (v) => v === 1 || v === true;

// --- ler tudo do SQLite ---------------------------------------------------
const users = all("SELECT * FROM users");
const plans = all("SELECT * FROM plans");
const orders = all("SELECT * FROM orders");
const reviews = all("SELECT * FROM reviews");
const tokens = all("SELECT * FROM tokens");
const audit = all("SELECT * FROM audit_log");

const userById = new Map(users.map((u) => [u.id, u]));
const planById = new Map(plans.map((p) => [p.id, p]));

console.log(`origem: ${dbPath}`);
console.log(
  `  ${users.length} utilizadores · ${plans.length} planos · ${orders.length} encomendas · ` +
    `${reviews.length} reviews · ${tokens.length} tokens · ${audit.length} auditoria`,
);
console.log(`destino: ${emulator ? `emulador (${process.env.FIRESTORE_EMULATOR_HOST})` : "Firestore REAL"}`);
if (dry) console.log("MODO SECO: nada e escrito.\n");

// --- transformar ----------------------------------------------------------
function planDoc(p) {
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
    // O JSON em string vira array nativo: o Firestore tem arrays, e assim
    // deixa de ser preciso fazer parse a cada leitura.
    features,
    cta_text: nz(p.cta_text),
  };
}

function userDoc(u) {
  return {
    id: u.id,
    username: u.username,
    email: nz(u.email),
    role: u.role,
    role_source: u.role_source ?? "manual",
    status: u.status,
    tier: nz(u.tier),
    tier_source: u.tier_source ?? "manual",
    hwid: nz(u.hwid),
    expires_at: nz(u.expires_at),
    created_at: u.created_at,
    discord_id: nz(u.discord_id),
    discord_username: nz(u.discord_username),
    discord_avatar: nz(u.discord_avatar),
  };
}

function orderDoc(o) {
  const u = userById.get(o.user_id);
  const p = planById.get(o.plan_id);
  return {
    id: o.id,
    user_id: o.user_id,
    plan_id: o.plan_id,
    // Desnormalizado de proposito - ver nota 2 no topo.
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

// --- escrever -------------------------------------------------------------
const escrito = {};

async function write(collection, rows, toDoc, sub) {
  if (dry) {
    escrito[collection] = rows.length;
    return;
  }
  const writer = fs.bulkWriter();
  for (const row of rows) {
    writer.set(fs.collection(collection).doc(String(row.id)), toDoc(row));
    if (sub) {
      const { pathParts, data } = sub(row);
      writer.set(fs.collection(collection).doc(String(row.id)).collection(pathParts[0]).doc(pathParts[1]), data);
    }
  }
  await writer.close();
  escrito[collection] = rows.length;
}

await write("plans", plans, planDoc);
await write("users", users, userDoc, (u) => ({
  pathParts: ["private", "creds"],
  data: { password_hash: u.password_hash, client_password: nz(u.client_password) },
}));
await write("orders", orders, orderDoc);
await write("reviews", reviews, (r) => ({
  id: r.id,
  user_id: nz(r.user_id),
  author_name: r.author_name,
  handle: nz(r.handle),
  rig: nz(r.rig),
  gain: nz(r.gain),
  rating: r.rating,
  body: r.body,
  approved: bool(r.approved),
  created_at: r.created_at,
}));
await write("tokens", tokens, (t) => ({
  id: t.id,
  user_id: t.user_id,
  token_hash: t.token_hash,
  kind: t.kind ?? "api",
  expires_at: t.expires_at,
  created_at: t.created_at,
}));
await write("audit_log", audit, (a) => ({
  id: a.id,
  user_id: nz(a.user_id),
  action: a.action,
  detail: nz(a.detail),
  ip: nz(a.ip),
  created_at: a.created_at,
}));

// --- verificar ------------------------------------------------------------
// Contar do lado do Firestore, nao confiar no que julgamos ter escrito.
console.log("\nverificacao:");
let falhas = 0;
for (const [col, esperado] of Object.entries(escrito)) {
  if (dry) {
    console.log(`  ${col.padEnd(14)} ${String(esperado).padStart(5)} (seco)`);
    continue;
  }
  const { count } = (await fs.collection(col).count().get()).data();
  const ok = count === esperado;
  if (!ok) falhas++;
  console.log(`  ${col.padEnd(14)} ${String(count).padStart(5)} / ${esperado} ${ok ? "ok" : "DIVERGE"}`);
}

if (!dry && users.length) {
  const creds = await fs.collection("users").doc(String(users[0].id)).collection("private").doc("creds").get();
  const temHash = Boolean(creds.data()?.password_hash);
  const perfil = (await fs.collection("users").doc(String(users[0].id)).get()).data();
  const vazouHash = "password_hash" in (perfil ?? {}) || "client_password" in (perfil ?? {});
  console.log(`  credenciais na subcoleccao: ${temHash ? "sim" : "NAO"}`);
  console.log(`  hash fora do perfil publico: ${vazouHash ? "NAO - VAZOU" : "sim"}`);
  if (!temHash || vazouHash) falhas++;
}

sql.close();
console.log(falhas === 0 ? "\nmigracao ok" : `\n${falhas} problemas`);
process.exit(falhas === 0 ? 0 : 1);
