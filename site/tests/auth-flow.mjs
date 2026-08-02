/**
 * Fluxo de autenticacao sobre Firestore.
 *
 *   node tests/auth-flow.mjs      (emulador no 8085)
 *
 * Testa o criterio de aceitacao da migracao: depois de autorizar o
 * Discord, a sessao TEM de sobreviver a pedidos seguintes. Era isso que
 * falhava com SQLite em /tmp na Vercel - o login escrevia numa instancia
 * e o pedido a seguir corria noutra, que nao encontrava nem o token nem o
 * utilizador.
 *
 * Aqui cada verificacao usa um modulo recem-importado, o mais parecido
 * que se consegue com "outro processo" sem lancar processos a serio: o
 * que conta e que nada fica em memoria entre uma chamada e a seguinte.
 */
process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8085";
process.env.GOOGLE_CLOUD_PROJECT = "demo-orion";

const { firestore } = await import("../lib/firebase-admin.ts");
const auth = await import("../lib/auth.ts");
const users = await import("../lib/repo/users.ts");
const tokensRepo = await import("../lib/repo/tokens.ts");

let pass = 0, fail = 0;
const t = (nome, cond, detalhe = "") => {
  if (cond) { pass++; console.log(`  [OK]   ${nome}`); }
  else { fail++; console.log(`  [FALHA] ${nome}`); if (detalhe) console.log(`          ${detalhe}`); }
};

const db = firestore();
for (const c of ["users", "tokens", "login_attempts", "counters"]) {
  while (true) {
    const s = await db.collection(c).limit(400).get();
    if (s.empty) break;
    for (const d of s.docs) {
      const sub = await d.ref.collection("private").get();
      for (const x of sub.docs) await x.ref.delete();
      await d.ref.delete();
    }
  }
}

console.log("=== Login Discord: criacao e sessao ===");
const { upsertDiscordUser } = await import("../lib/discord.ts");
const conta = await upsertDiscordUser(
  { id: "555000", username: "Jonhy", globalName: "Jonhy Dev", avatar: "abc" },
  "owner",
  "special",
);
t("conta criada a partir da identidade Discord", typeof conta.id === "number");
t("papel aplicado", conta.role === "owner", conta.role);
t("plano aplicado", conta.tier === "special", String(conta.tier));
t("sem password: marcador em vez de hash", conta.password_hash === "!discord");

const sessao = await auth.issueToken(conta.id, "web", auth.WEB_SESSION_TTL);
t("sessao emitida", typeof sessao.token === "string");

console.log("\n=== A sessao sobrevive a um pedido independente ===");
// Reimportar com cache-buster: nenhum estado de modulo transita.
const auth2 = await import(`../lib/auth.ts?pedido=2`);
const recuperado = await auth2.userFromToken(sessao.token, "web");
t("utilizador recuperado noutro 'pedido'", recuperado?.id === conta.id,
  recuperado ? `id ${recuperado.id}` : "null - era este o bug original");
t("papel preservado", recuperado?.role === "owner");
t("plano preservado", recuperado?.tier === "special");

const auth3 = await import(`../lib/auth.ts?pedido=3`);
t("e num terceiro pedido tambem", (await auth3.userFromToken(sessao.token, "web"))?.id === conta.id);

console.log("\n=== Separacao entre sessao do site e cliente Windows ===");
const api = await auth.issueToken(conta.id, "api", auth.TOKEN_TTL);
t("token de API emitido", typeof api.token === "string");
t("token web nao serve como API", (await auth.userFromToken(sessao.token, "api")) === null);
t("token API nao serve como web", (await auth.userFromToken(api.token, "web")) === null);

await auth.revokeClientTokens(conta.id);
t("revogar o cliente Windows corta o token API", (await auth.userFromToken(api.token, "api")) === null);
t("...e a sessao do site continua viva", (await auth.userFromToken(sessao.token, "web"))?.id === conta.id,
  "terminar o optimizador nao pode deslogar o painel");

console.log("\n=== Logout ===");
await auth.revokeToken(sessao.token);
t("logout invalida a sessao", (await auth.userFromToken(sessao.token, "web")) === null);

console.log("\n=== Expiracao de plano ===");
const cliente = await users.createUser(
  { username: "cliente.exp", role: "client", tier: "pro", status: "active",
    expires_at: Math.floor(Date.now() / 1000) - 60 },
  { password_hash: "!discord", client_password: null },
);
const tokenExpirado = await auth.issueToken(cliente.id, "api", auth.TOKEN_TTL);
t("plano expirado bloqueia o cliente Windows",
  (await auth.userFromToken(tokenExpirado.token, "api")) === null,
  "checkOptimizerAccess tem de recusar licenca fora de prazo");
t("...mas a conta do site continua a abrir",
  (await auth.userFromToken((await auth.issueToken(cliente.id, "web", 3600)).token, "web"))?.id === cliente.id,
  "o site pode ser usado sem licenca activa; o optimizador nao");

console.log("\n=== Conta suspensa ===");
await users.updateProfile(cliente.id, { status: "suspended" });
const tokenSusp = await auth.issueToken(cliente.id, "web", 3600);
t("conta suspensa nao entra", (await auth.userFromToken(tokenSusp.token, "web")) === null);

console.log("\n=== HWID ===");
await users.updateProfile(cliente.id, { status: "active", expires_at: null });
const primeira = await auth.checkHwid({ id: cliente.id }, "PC-DO-CLIENTE");
t("primeira maquina fica ligada", primeira.ok === true);
t("a mesma maquina volta a entrar", (await auth.checkHwid({ id: cliente.id }, "PC-DO-CLIENTE")).ok === true);
const outra = await auth.checkHwid({ id: cliente.id }, "OUTRO-PC");
t("outra maquina e recusada", outra.ok === false);
t("com mensagem util", /outro computador/i.test(outra.reason ?? ""), outra.reason);
t("sem hwid nenhum e recusado", (await auth.checkHwid({ id: cliente.id }, null)).ok === false);

console.log("\n=== Limite de tentativas ===");
const ip = "203.0.113.7";
t("comeca sem bloqueio", (await auth.isLockedOut("alvo", ip)) === false);
for (let i = 0; i < auth.MAX_ATTEMPTS; i++) await auth.recordAttempt("alvo", ip, false);
t(`bloqueia as ${auth.MAX_ATTEMPTS} falhas`, (await auth.isLockedOut("alvo", ip)) === true);
t("outro IP nao e afectado", (await auth.isLockedOut("alvo", "198.51.100.9")) === false,
  "o bloqueio e por utilizador E ip, nao so por utilizador");
await auth.recordAttempt("alvo", ip, true);
t("entrar com sucesso limpa o historico", (await auth.isLockedOut("alvo", ip)) === false);

console.log("\n=== Permissoes ===");
t("staff passa sem plano", auth.checkOptimizerAccess({ status: "active", role: "staff", tier: null, expires_at: null }).ok);
t("owner passa sem plano", auth.checkOptimizerAccess({ status: "active", role: "owner", tier: null, expires_at: null }).ok);
t("cliente sem plano nao passa", !auth.checkOptimizerAccess({ status: "active", role: "client", tier: null, expires_at: null }).ok);
t("member sem plano nao passa", !auth.checkOptimizerAccess({ status: "active", role: "member", tier: null, expires_at: null }).ok);
t("cliente com plano passa", auth.checkOptimizerAccess({ status: "active", role: "client", tier: "pro", expires_at: null }).ok);

console.log(`\nPassou: ${pass}   Falhou: ${fail}`);
process.exit(fail > 0 ? 1 : 0);
