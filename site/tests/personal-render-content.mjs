/**
 * Verifica o HTML renderizado da Area Pessoal.
 *
 *   node --env-file=.env.local --experimental-strip-types tests/personal-render-content.mjs
 *
 * O personal-dashboard.mjs prova que as FUNCOES estao certas; este prova
 * que a PAGINA as usa. Um valor escrito a mao no JSX passa incolume por
 * testes de unidade - foi exactamente assim que o `status="active"` fixo
 * sobreviveu ate agora.
 */
import { createToken, revokeToken } from "../lib/repo/tokens.ts";
import { listProfiles } from "../lib/repo/users.ts";

const BASE = process.env.ORION_BASE ?? "http://127.0.0.1:3400";

let pass = 0, fail = 0;
const t = (nome, cond, detalhe = "") => {
  if (cond) { pass++; console.log(`  [OK]   ${nome}`); }
  else { fail++; console.log(`  [FALHA] ${nome}`); if (detalhe) console.log(`          ${detalhe}`); }
};

const perfis = await listProfiles(500);
const owner = perfis.find((p) => p.role === "owner");
if (!owner) { console.error("Sem owner no Firestore."); process.exit(1); }

const { token } = await createToken(owner.id, "web", 300);
let html = "";
try {
  html = await (await fetch(`${BASE}/panel/dashboard`, {
    headers: { cookie: `orion_session=${token}` },
  })).text();
} finally {
  await revokeToken(token);
}

const visivel = html
  .replace(/<script[\s\S]*?<\/script>/g, " ")
  .replace(/<[^>]+>/g, " ")
  .replace(/\s+/g, " ");

console.log("=== Texto escrito a mao que foi removido ===");
t("nao tem 'Nao incluido' sem acentos", !/Nao incluido/.test(visivel));
t("nao tem 'Licenca' sem cedilha", !/\bLicenca\b/.test(visivel));
t("nao tem 'Area pessoal' sem acento", !/\bArea pessoal\b/.test(visivel));
t("nao tem 'Verificacoes' sem acentos", !/Verificacoes/.test(visivel));

console.log("\n=== Coerencia entre os dois cartoes ===");
const dizVerificado = /Discord verificado/.test(visivel);
const dizPorLigar = /Discord por ligar/.test(visivel);
t("a pagina nao se contradiz sobre o Discord",
  dizVerificado !== dizPorLigar,
  "os dois cartoes liam fontes diferentes e chegavam a dizer o contrario");
t("o estado do Discord bate certo com a conta",
  (owner.discord_id ? dizVerificado : dizPorLigar),
  `discord_id=${owner.discord_id ? "presente" : "ausente"}`);

console.log("\n=== O que a pagina TEM de mostrar ===");
t("cabecalho da area pessoal", /Área pessoal/.test(visivel));
t("os quatro mosaicos",
  ["Plano atual", "Licença", "Support Plan", "Compras"].every((m) => visivel.includes(m)));
t("cartao de acesso", /O teu acesso/.test(visivel));
t("estado da conta", /Estado da conta/.test(visivel));
t("atividade recente", /Atividade recente/.test(visivel));
t("acessos rapidos", /Acessos rápidos|Acessos rapidos/.test(visivel));

console.log("\n=== Coerencia do estado da licenca ===");
// O owner tem acesso interno: nao pode aparecer um aviso de expiracao nem
// um badge de expirada.
const temAviso = /licença termina em|licença expirou|conta está suspensa/i.test(visivel);
t("owner com acesso interno nao ve aviso de expiracao", !temAviso,
  "o aviso so pode aparecer quando ha mesmo algo a fazer");
t("nao mostra dias negativos", !/-\d+ dias/.test(visivel));

console.log(`\nPassou: ${pass}   Falhou: ${fail}`);
process.exit(fail > 0 ? 1 : 0);
