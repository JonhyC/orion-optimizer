/**
 * Verifica o HTML renderizado de "A minha conta".
 *
 *   node --env-file=.env.local --experimental-strip-types tests/account-render-content.mjs
 *
 * Prova que a pagina usa a logica de lib/personal-dashboard em vez de
 * reimplementar a sua propria versao do mesmo estado - era assim que as
 * duas paginas conseguiam dizer coisas diferentes sobre a mesma licenca.
 */
import { createToken, revokeToken } from "../lib/repo/tokens.ts";
import { listProfiles } from "../lib/repo/users.ts";
import { allPlans } from "../lib/repo/plans.ts";

const BASE = process.env.ORION_BASE ?? "http://127.0.0.1:3400";

let pass = 0, fail = 0;
const t = (nome, cond, detalhe = "") => {
  if (cond) { pass++; console.log(`  [OK]   ${nome}`); }
  else { fail++; console.log(`  [FALHA] ${nome}`); if (detalhe) console.log(`          ${detalhe}`); }
};

const owner = (await listProfiles(500)).find((p) => p.role === "owner");
if (!owner) { console.error("Sem owner no Firestore."); process.exit(1); }

const { token } = await createToken(owner.id, "web", 300);
let html = "";
try {
  html = await (await fetch(`${BASE}/panel`, {
    headers: { cookie: `orion_session=${token}` },
  })).text();
} finally {
  await revokeToken(token);
}

const visivel = html
  .replace(/<script[\s\S]*?<\/script>/g, " ")
  .replace(/<[^>]+>/g, " ")
  .replace(/\s+/g, " ");

console.log("=== Palavras erradas que foram corrigidas ===");
t("licenca expirada NAO pode dizer 'Falhou'", !/Falhou/.test(visivel),
  "'failed' e vocabulario de pagamento; uma licenca expira, nao falha");
for (const errado of ["Licenca", "Nao incluido", "Maquina", "operacao", "seguranca", "Papel:"]) {
  t(`nao tem "${errado}" sem acentos`, !new RegExp(`\\b${errado}`).test(visivel));
}

console.log("\n=== Nome do plano vem da base de dados ===");
const planos = await allPlans();
const doOwner = owner.tier ? planos.find((p) => p.code === owner.tier) : null;
if (doOwner) {
  t(`mostra "${doOwner.name}" e nao o codigo cru`,
    visivel.includes(doOwner.name),
    "o mapa escrito a mao nao conhecia o Special e mostrava 'special' em minusculas");
  if (doOwner.name !== owner.tier) {
    t("nao mostra o codigo do plano em minusculas",
      !new RegExp(`\\b${owner.tier}\\b`).test(visivel));
  }
} else {
  t("owner sem plano: nada a verificar", true);
}

console.log("\n=== Coerencia com a Area Pessoal ===");
// As duas paginas leem estadoDaLicenca/estadoDoSuporte. Se uma disser
// "Life-time" e a outra outra coisa, a logica deixou de ser partilhada.
const { token: t2 } = await createToken(owner.id, "web", 300);
let htmlDash = "";
try {
  htmlDash = await (await fetch(`${BASE}/panel/dashboard`, {
    headers: { cookie: `orion_session=${t2}` },
  })).text();
} finally {
  await revokeToken(t2);
}
const visivelDash = htmlDash.replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

for (const estado of ["Life-time", "Não incluído", "Terminado", "Expirada", "Suspensa"]) {
  const naConta = visivel.includes(estado);
  const noDash = visivelDash.includes(estado);
  if (naConta || noDash) {
    t(`"${estado}" aparece nas duas ou em nenhuma`, naConta === noDash,
      `conta=${naConta} dashboard=${noDash}`);
  }
}

console.log("\n=== O que a pagina TEM de mostrar ===");
t("titulo", /A minha conta/.test(visivel));
t("cartao da licenca", /Licença/.test(visivel));
t("Support Plan", /Support Plan/.test(visivel));
t("conta Discord", /Conta Discord/.test(visivel));
t("maquina ligada", /Máquina ligada/.test(visivel));
t("cliente Windows", /Cliente Windows/.test(visivel));
t("compras", /Compras/.test(visivel));

console.log(`\nPassou: ${pass}   Falhou: ${fail}`);
process.exit(fail > 0 ? 1 : 0);
