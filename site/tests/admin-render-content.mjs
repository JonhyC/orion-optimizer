/**
 * Verifica o HTML renderizado do Painel Administrativo.
 *
 *   node --env-file=.env.local --experimental-strip-types tests/admin-render-content.mjs
 *
 * Os testes de admin-dashboard.mjs provam que as FUNCOES estao certas.
 * Este prova que a PAGINA usa essas funcoes: um valor inventado que fique
 * escrito a mao no JSX passa incolume por testes de unidade.
 */
import { createToken, revokeToken } from "../lib/repo/tokens.ts";
import { listProfiles } from "../lib/repo/users.ts";

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
  html = await (await fetch(`${BASE}/panel/admin`, {
    headers: { cookie: `orion_session=${token}` },
  })).text();
} finally {
  await revokeToken(token);
}

// O texto visivel, sem atributos nem <script>, para nao apanhar falsos
// positivos vindos do payload de hidratacao.
const visivel = html
  .replace(/<script[\s\S]*?<\/script>/g, " ")
  .replace(/<[^>]+>/g, " ")
  .replace(/\s+/g, " ");

console.log("=== Valores inventados que foram removidos ===");
for (const valor of ["42 ms", "58 ms", "91 ms", "34 ms", "63 ms", "74 ms", "8 ms"]) {
  t(`nao mostra "${valor}"`, !visivel.includes(valor),
    "era uma latencia escrita a mao, nunca medida");
}
t("nao mostra 'Preparado' como metrica",
  !/\bPreparado\b/.test(visivel),
  "CPU/RAM diziam 'Preparado' sem nada ter sido medido");

console.log("\n=== O que a pagina TEM de mostrar ===");
t("titulo do painel", /Painel|Administra/i.test(visivel));
t("estado da base de dados medido", /\d+ ms para carregar este painel/.test(visivel),
  "e a unica latencia da pagina, e e cronometrada de verdade");
t("lista os quatro servicos",
  ["Base de dados", "Discord", "Pagamentos", "Aplica"].every((s) => visivel.includes(s)));
t("selector de periodo e clicavel",
  /aria-pressed/.test(html),
  "eram <span> decorativos; agora sao botoes");
t("tem os tres periodos",
  ["7 dias", "30 dias", "90 dias"].every((p) => visivel.includes(p)));

console.log(`\nPassou: ${pass}   Falhou: ${fail}`);
process.exit(fail > 0 ? 1 : 0);
