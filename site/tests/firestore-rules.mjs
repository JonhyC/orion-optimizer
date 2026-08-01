/**
 * Banco de ensaio das Security Rules do Firestore.
 *
 *   node tests/firestore-rules.mjs      (com o emulador a correr no 8085)
 *
 * Estas regras sao a unica barreira entre o browser e a base de dados
 * quando o tempo real estiver ligado. Cada caso aqui corresponde a um
 * acesso que alguem pode tentar - incluindo os que TEM de falhar.
 *
 * O que se testa nao e "o codigo corre": e quem consegue ler o que.
 */
import fs from "node:fs";
import path from "node:path";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from "@firebase/rules-unit-testing";

const raiz = path.resolve(process.cwd(), "..");

const env = await initializeTestEnvironment({
  projectId: "demo-orion-rules",
  firestore: {
    host: "127.0.0.1",
    port: 8085,
    rules: fs.readFileSync(path.join(raiz, "firestore.rules"), "utf8"),
  },
});

let pass = 0;
let fail = 0;

async function caso(nome, promessa) {
  try {
    await promessa;
    pass++;
    console.log(`  [OK]   ${nome}`);
  } catch (e) {
    fail++;
    console.log(`  [FALHA] ${nome}`);
    console.log(`          ${String(e.message).split("\n")[0]}`);
  }
}

// --- dados de ensaio ------------------------------------------------------
// withSecurityRulesDisabled: semear tem de ignorar as regras, senao nao
// havia forma de criar o estado inicial (o browser nunca escreve).
await env.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  await db.doc("plans/1").set({ code: "basic", name: "Basic", active: true, sort_order: 1 });
  await db.doc("plans/9").set({ code: "rascunho", name: "Rascunho", active: false, sort_order: 9 });
  await db.doc("users/81").set({ id: 81, username: "dono", role: "owner", tier: "special" });
  await db.doc("users/100").set({ id: 100, username: "cliente", role: "client", tier: "pro" });
  await db.doc("users/81/private/creds").set({ password_hash: "$2b$...", client_password: "segredo" });
  await db.doc("users/100/private/creds").set({ password_hash: "$2b$...", client_password: "segredo" });
  await db.doc("orders/1").set({ id: 1, user_id: 100, status: "paid", amount_cents: 2999 });
  await db.doc("orders/2").set({ id: 2, user_id: 81, status: "paid", amount_cents: 4999 });
  await db.doc("reviews/1").set({ id: 1, approved: true, body: "publicada" });
  await db.doc("reviews/2").set({ id: 2, approved: false, body: "por moderar" });
  await db.doc("tokens/1").set({ id: 1, user_id: 100, token_hash: "abc" });
  await db.doc("audit_log/1").set({ id: 1, action: "login" });
  await db.doc("login_attempts/1").set({ id: 1, username: "cliente", ip: "1.2.3.4" });
});

// Tres identidades: anonimo, o cliente 100, e o owner 81.
const anon = env.unauthenticatedContext().firestore();
const cliente = env.authenticatedContext("100", { role: "client", tier: "pro" }).firestore();
const owner = env.authenticatedContext("81", { role: "owner", tier: "special" }).firestore();

console.log("=== Planos (pagina de precos e publica) ===");
await caso("anonimo le plano activo", assertSucceeds(anon.doc("plans/1").get()));
await caso("anonimo NAO le plano inactivo", assertFails(anon.doc("plans/9").get()));
await caso("owner le plano inactivo", assertSucceeds(owner.doc("plans/9").get()));

console.log("\n=== Perfis ===");
await caso("cliente le o proprio perfil", assertSucceeds(cliente.doc("users/100").get()));
await caso("cliente NAO le perfil de outro", assertFails(cliente.doc("users/81").get()));
await caso("owner le perfil de qualquer um", assertSucceeds(owner.doc("users/100").get()));
await caso("anonimo NAO le perfil nenhum", assertFails(anon.doc("users/100").get()));

console.log("\n=== Credenciais: negadas a todos ===");
await caso(
  "cliente NAO le as proprias credenciais",
  assertFails(cliente.doc("users/100/private/creds").get()),
);
await caso("owner NAO le credenciais de ninguem", assertFails(owner.doc("users/81/private/creds").get()));
await caso("owner NAO le credenciais de terceiros", assertFails(owner.doc("users/100/private/creds").get()));
await caso("anonimo NAO le credenciais", assertFails(anon.doc("users/100/private/creds").get()));

console.log("\n=== Encomendas ===");
await caso("cliente le a propria encomenda", assertSucceeds(cliente.doc("orders/1").get()));
await caso("cliente NAO le encomenda de outro", assertFails(cliente.doc("orders/2").get()));
await caso("owner le qualquer encomenda", assertSucceeds(owner.doc("orders/1").get()));
await caso("anonimo NAO le encomendas", assertFails(anon.doc("orders/1").get()));

console.log("\n=== Reviews ===");
await caso("anonimo le review aprovada", assertSucceeds(anon.doc("reviews/1").get()));
await caso("anonimo NAO le review por moderar", assertFails(anon.doc("reviews/2").get()));
await caso("owner le review por moderar", assertSucceeds(owner.doc("reviews/2").get()));

console.log("\n=== Dados de seguranca: fechados a toda a gente ===");
await caso("owner NAO le tokens", assertFails(owner.doc("tokens/1").get()));
await caso("owner NAO le auditoria", assertFails(owner.doc("audit_log/1").get()));
await caso("owner NAO le tentativas de login", assertFails(owner.doc("login_attempts/1").get()));
await caso("cliente NAO le tokens", assertFails(cliente.doc("tokens/1").get()));

console.log("\n=== O browser nunca escreve ===");
await caso("owner NAO escreve num plano", assertFails(owner.doc("plans/1").set({ price_cents: 0 })));
await caso("cliente NAO altera o proprio tier", assertFails(cliente.doc("users/100").update({ tier: "special" })));
await caso("cliente NAO cria encomenda", assertFails(cliente.doc("orders/999").set({ user_id: 100 })));
await caso("cliente NAO apaga auditoria", assertFails(cliente.doc("audit_log/1").delete()));

console.log("\n=== Coleccao nova nasce fechada ===");
await caso("anonimo NAO le coleccao desconhecida", assertFails(anon.doc("qualquer/coisa").get()));
await caso("owner NAO le coleccao desconhecida", assertFails(owner.doc("qualquer/coisa").get()));

await env.cleanup();
console.log(`\nPassou: ${pass}   Falhou: ${fail}`);
process.exit(fail > 0 ? 1 : 0);
