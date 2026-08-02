/**
 * Banco de ensaio da logica de versoes.
 *
 *   node tests/version.mjs
 *
 * E esta logica que decide se alguem ve "atualizada", "nova versao" ou
 * "obrigatoria". Um erro aqui ou esconde uma actualizacao critica, ou
 * bloqueia quem nao tem de ser bloqueado - nenhum dos dois da erro no
 * ecra, so o comportamento errado.
 */
import { compareVersions, updateState, formatBytes, timeAgo } from "../lib/version.ts";

let pass = 0, fail = 0;
const t = (nome, cond, detalhe = "") => {
  if (cond) { pass++; console.log(`  [OK]   ${nome}`); }
  else { fail++; console.log(`  [FALHA] ${nome}`); if (detalhe) console.log(`          ${detalhe}`); }
};

console.log("=== compareVersions ===");
t("1.0.5 < 1.0.6", compareVersions("1.0.5", "1.0.6") < 0);
t("1.0.6 = 1.0.6", compareVersions("1.0.6", "1.0.6") === 0);
t("1.0.10 > 1.0.9 (nao compara como texto)", compareVersions("1.0.10", "1.0.9") > 0,
  "comparacao textual poria a 1.0.10 antes da 1.0.9");
t("1.10.0 > 1.9.0", compareVersions("1.10.0", "1.9.0") > 0);
t("2.0.0 > 1.99.99", compareVersions("2.0.0", "1.99.99") > 0);

console.log("\n=== updateState ===");
const r = { version: "1.0.6" };
t("instalada igual -> actualizada", updateState(r, "1.0.6") === "actualizada");
t("instalada anterior -> disponivel", updateState(r, "1.0.5") === "disponivel");
t("instalada posterior -> actualizada", updateState(r, "1.0.7") === "actualizada",
  "quem tem uma versao de teste mais recente nao pode ser mandado 'actualizar' para tras");
t("sem versao -> desconhecida", updateState(r, null) === "desconhecida");
t("versao invalida -> desconhecida", updateState(r, "nao-e-versao") === "desconhecida");
t("string vazia -> desconhecida", updateState(r, "") === "desconhecida");

console.log("\n=== minSupported ===");
const rm = { version: "1.0.6", minSupported: "1.0.5" };
t("abaixo do minimo -> obrigatoria", updateState(rm, "1.0.4") === "obrigatoria");
t("igual ao minimo -> so disponivel", updateState(rm, "1.0.5") === "disponivel",
  "o minimo e o ultimo aceite, nao o primeiro recusado");
t("acima do minimo -> disponivel", updateState(rm, "1.0.5") === "disponivel");
t("ja na ultima -> actualizada, nunca obrigatoria", updateState(rm, "1.0.6") === "actualizada");

console.log("\n=== formatBytes ===");
t("108681551 -> 103,6 MB", formatBytes(108681551) === "103,6 MB", formatBytes(108681551));
t("null -> null", formatBytes(null) === null);
t("zero -> null (nao '0,0 MB')", formatBytes(0) === null);

console.log("\n=== timeAgo ===");
const agora = 1_700_000_000_000;
const seg = Math.floor(agora / 1000);
t("30s -> agora mesmo", timeAgo(seg - 30, agora) === "agora mesmo");
t("1 minuto no singular", timeAgo(seg - 60, agora) === "há 1 minuto", timeAgo(seg - 60, agora));
t("5 minutos no plural", timeAgo(seg - 300, agora) === "há 5 minutos");
t("2 horas", timeAgo(seg - 7200, agora) === "há 2 horas");
t("3 dias", timeAgo(seg - 259200, agora) === "há 3 dias");
t("1 mes no singular", timeAgo(seg - 2592000 * 1.1, agora) === "há 1 mês", timeAgo(seg - 2592000 * 1.1, agora));
t("futuro nao da negativo", timeAgo(seg + 500, agora) === "agora mesmo");
t("null -> null", timeAgo(null, agora) === null);

console.log(`\nPassou: ${pass}   Falhou: ${fail}`);
process.exit(fail > 0 ? 1 : 0);
