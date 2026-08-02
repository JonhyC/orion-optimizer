/**
 * Banco de ensaio da fundacao do repositorio Firestore.
 *
 *   node tests/repo-core.mjs      (emulador no 8085)
 *
 * Testa o que resolve o problema que motivou a migracao - a sessao que
 * desaparecia entre invocacoes - e as corridas que as transaccoes tem de
 * evitar. Estas ultimas sao o tipo de defeito que nunca aparece em uso
 * normal e so morde em producao, com dois pedidos ao mesmo tempo.
 */
process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8085";
process.env.GOOGLE_CLOUD_PROJECT = "demo-orion";

const { firestore } = await import("../lib/firebase-admin.ts");
const ids = await import("../lib/repo/ids.ts");
const users = await import("../lib/repo/users.ts");
const tokens = await import("../lib/repo/tokens.ts");

let pass = 0, fail = 0;
const t = (nome, cond, detalhe = "") => {
  if (cond) { pass++; console.log(`  [OK]   ${nome}`); }
  else { fail++; console.log(`  [FALHA] ${nome}`); if (detalhe) console.log(`          ${detalhe}`); }
};

// Bancada limpa.
const db = firestore();
for (const c of ["users", "tokens", "counters"]) {
  const snap = await db.collection(c).get();
  await Promise.all(snap.docs.map((d) => d.ref.delete()));
}

console.log("=== Ids numericos ===");
const a = await ids.allocateId("users");
const b = await ids.allocateId("users");
t("ids sao numeros", typeof a === "number" && typeof b === "number");
t("ids sao sequenciais", b === a + 1, `${a} -> ${b}`);

const lote = await ids.allocateIds("users", 5);
t("lote devolve 5 ids", lote.length === 5);
t("lote continua a sequencia", lote[0] === b + 1, `${b} -> ${lote[0]}`);
t("lote nao tem buracos", lote.every((v, i) => i === 0 || v === lote[i - 1] + 1));

// A corrida: 20 alocacoes em paralelo nao podem repetir numeros.
const paralelo = await Promise.all(Array.from({ length: 20 }, () => ids.allocateId("users")));
t("20 alocacoes simultaneas dao 20 ids distintos",
  new Set(paralelo).size === 20,
  `distintos: ${new Set(paralelo).size}`);

await ids.ensureCounterAbove("users", 9999);
const depois = await ids.allocateId("users");
t("ensureCounterAbove empurra o contador", depois === 10000, String(depois));
await ids.ensureCounterAbove("users", 5);
const naoDesce = await ids.allocateId("users");
t("ensureCounterAbove nunca desce", naoDesce === 10001, String(naoDesce));

console.log("\n=== Utilizadores ===");
const criado = await users.createUser(
  { username: "teste.um", role: "client", tier: "pro", status: "active" },
  { password_hash: "scrypt$16384$aa$bb", client_password: "segredo" },
);
t("createUser devolve id numerico", typeof criado.id === "number");

const perfil = await users.findProfileById(criado.id);
t("perfil le-se por id", perfil?.username === "teste.um");
t("perfil NAO tem password_hash", perfil && !("password_hash" in perfil),
  "o hash nao pode viajar numa leitura de perfil");
t("perfil NAO tem client_password", perfil && !("client_password" in perfil));

const completo = await users.findById(criado.id);
t("findById junta credenciais", completo?.password_hash === "scrypt$16384$aa$bb");
t("findById traz o perfil tambem", completo?.username === "teste.um");

const porNome = await users.findByUsername("teste.um");
t("procura por username", porNome?.id === criado.id);
t("username inexistente devolve null", (await users.findByUsername("nao.existe")) === null);

console.log("\n=== HWID: a corrida das duas maquinas ===");
const [m1, m2] = await Promise.all([
  users.bindHwid(criado.id, "MAQUINA-A"),
  users.bindHwid(criado.id, "MAQUINA-B"),
]);
const aceites = [m1, m2].filter((r) => r.ok).length;
t("duas maquinas simultaneas: so uma fica ligada", aceites === 1,
  `aceites: ${aceites} (m1.ok=${m1.ok} m2.ok=${m2.ok})`);
const ligado = (await users.findProfileById(criado.id))?.hwid;
t("o hwid gravado e o da maquina aceite", ligado === "MAQUINA-A" || ligado === "MAQUINA-B", String(ligado));
const reentrada = await users.bindHwid(criado.id, ligado);
t("a mesma maquina volta a entrar", reentrada.ok === true && reentrada.bound === false);
const intrusa = await users.bindHwid(criado.id, "MAQUINA-C");
t("uma terceira maquina e recusada", intrusa.ok === false);

console.log("\n=== Discord: a corrida dos dois logins ===");
const dois = await Promise.all([
  users.upsertFromDiscord({ discordId: "999", discordUsername: "Jonhy", discordAvatar: null, usernameBase: "jonhy", role: "client", tier: "pro" }),
  users.upsertFromDiscord({ discordId: "999", discordUsername: "Jonhy", discordAvatar: null, usernameBase: "jonhy", role: "client", tier: "pro" }),
]);
t("dois logins simultaneos criam UMA conta", dois[0].id === dois[1].id,
  `ids: ${dois[0].id} e ${dois[1].id}`);
const contas = await db.collection("users").where("discord_id", "==", "999").get();
t("existe mesmo so um documento", contas.size === 1, `documentos: ${contas.size}`);

// Decisao manual do owner tem de sobreviver ao login seguinte.
await users.updateProfile(dois[0].id, { tier: "special", tier_source: "manual", role_source: "manual", role: "owner" });
const depoisDeLogin = await users.upsertFromDiscord({
  discordId: "999", discordUsername: "Jonhy", discordAvatar: null, usernameBase: "jonhy", role: "client", tier: "basic",
});
t("tier fixado a mao sobrevive ao Discord", depoisDeLogin.tier === "special", String(depoisDeLogin.tier));
t("role fixado a mao sobrevive ao Discord", depoisDeLogin.role === "owner", String(depoisDeLogin.role));

console.log("\n=== Tokens: a sessao que se perdia ===");
const web = await tokens.createToken(criado.id, "web", 3600);
t("createToken devolve valor em claro", typeof web.token === "string" && web.token.length === 64);

const guardado = await db.collection("tokens").doc(tokens.sha256(web.token)).get();
t("o id do documento e o hash", guardado.exists);
t("o token em claro NAO esta guardado",
  !JSON.stringify(guardado.data()).includes(web.token),
  "o valor original nunca pode ficar em disco");

// O teste que importa: uma leitura completamente independente, como
// aconteceria noutra instancia serverless.
const encontrado = await tokens.findToken(web.token, "web");
t("token le-se num pedido independente", encontrado?.user_id === criado.id);
t("tipo errado nao passa", (await tokens.findToken(web.token, "api")) === null,
  "uma sessao web nao pode servir de token do cliente Windows");

const expirado = await tokens.createToken(criado.id, "web", -10);
t("token expirado e recusado", (await tokens.findToken(expirado.token, "web")) === null);

await tokens.revokeToken(web.token);
t("revogar remove a sessao", (await tokens.findToken(web.token, "web")) === null);

console.log("\n=== Revogacao selectiva ===");
const api1 = await tokens.createToken(criado.id, "api", 3600);
const web1 = await tokens.createToken(criado.id, "web", 3600);
await tokens.revokeClientTokens(criado.id);
t("revokeClientTokens corta o cliente Windows", (await tokens.findToken(api1.token, "api")) === null);
t("...mas a sessao do site sobrevive", (await tokens.findToken(web1.token, "web")) !== null,
  "terminar o optimizador nao pode deslogar o painel");

await tokens.revokeAllTokens(criado.id);
t("revokeAllTokens corta tudo", (await tokens.findToken(web1.token, "web")) === null);

console.log(`\nPassou: ${pass}   Falhou: ${fail}`);
process.exit(fail > 0 ? 1 : 0);
