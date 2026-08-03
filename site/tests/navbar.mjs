/**
 * Logica da barra de navegacao do painel.
 *
 *   node tests/navbar.mjs
 *
 * O item activo errado e o tipo de bug que ninguem reporta e toda a gente
 * nota: a barra fica a dizer que estamos numa pagina onde nao estamos.
 */
import {
  estaAtivo,
  itensDeNavegacao,
  quantosCabem,
  separarItens,
} from "../lib/navbar.ts";

let pass = 0, fail = 0;
const t = (nome, cond, detalhe = "") => {
  if (cond) { pass++; console.log(`  [OK]   ${nome}`); }
  else { fail++; console.log(`  [FALHA] ${nome}`); if (detalhe) console.log(`          ${detalhe}`); }
};

console.log("=== Item activo ===");
t("caminho igual acende", estaAtivo("/panel/support", "/panel/support"));
t("sub-rota mantem o pai aceso", estaAtivo("/panel/support/12", "/panel/support"),
  "abrir um ticket nao pode apagar o 'Suporte'");
t("outra rota nao acende", !estaAtivo("/panel/admin", "/panel/support"));

t("'/panel' NAO acende em /panel/dashboard", !estaAtivo("/panel/dashboard", "/panel"),
  "prefixo simples acendia 'A minha conta' em quase todo o painel");
t("'/panel' NAO acende em /panel/admin", !estaAtivo("/panel/admin", "/panel"));
t("'/panel' acende em /panel", estaAtivo("/panel", "/panel"));

t("'/' NAO acende no painel", !estaAtivo("/panel", "/"),
  "a barra toda ficaria acesa");
t("'/' acende na raiz", estaAtivo("/", "/"));

t("prefixo parcial nao conta", !estaAtivo("/panel/supportive", "/panel/support"),
  "startsWith sem a barra apanhava rotas parecidas");

console.log("\n=== Lista de itens ===");
const comTudo = itensDeNavegacao({ temDashboard: true });
const semPlano = itensDeNavegacao({ temDashboard: false });
t("com plano tem cinco itens", comTudo.length === 5, String(comTudo.length));
t("sem plano tem tres", semPlano.length === 3, String(semPlano.length));
t("sem plano esconde a Area Pessoal", !semPlano.some((i) => i.id === "dashboard"));
t("sem plano esconde as Otimizacoes", !semPlano.some((i) => i.id === "otimizacoes"));
t("a conta esta sempre la", semPlano.some((i) => i.id === "conta"));
t("os ids nao se repetem", new Set(comTudo.map((i) => i.id)).size === comTudo.length);
t("os labels tem acentos",
  comTudo.find((i) => i.id === "dashboard").label === "Área Pessoal" &&
  comTudo.find((i) => i.id === "otimizacoes").label === "Otimizações Ativas");

console.log("\n=== Quantos cabem ===");
t("todos cabem quando ha espaco", quantosCabem([100, 100, 100], 400, 80) === 3);
t("largura exacta ainda cabe", quantosCabem([100, 100], 200, 80) === 2,
  "o limite tem de ser inclusivo, senao esconde um item sem precisar");
t("reserva espaco para o 'Mais'",
  quantosCabem([100, 100, 100], 250, 80) === 1,
  "80 do Mais + 100 = 180; o segundo daria 280 > 250");
t("nao cabe nenhum", quantosCabem([300], 100, 80) === 0);
t("lista vazia da zero", quantosCabem([], 500, 80) === 0);
t("nunca devolve mais do que existe", quantosCabem([10, 10], 9999, 80) === 2);

console.log("\n=== Separacao entre barra e 'Mais' ===");
const itens = itensDeNavegacao({ temDashboard: true });
const tudoVisivel = separarItens(itens, 5);
t("nada escondido quando cabe tudo", tudoVisivel.escondidos.length === 0);
t("visiveis mantem os cinco", tudoVisivel.visiveis.length === 5);

const apertado = separarItens(itens, 3);
t("esconde os que faltam", apertado.escondidos.length === 2);
t("visiveis ficam tres", apertado.visiveis.length === 3);
t("'Ver site' e o primeiro a sair",
  apertado.escondidos.some((i) => i.id === "site"),
  "e o unico que leva para fora do painel");
t("'A minha conta' e o ultimo a sair",
  apertado.visiveis.some((i) => i.id === "conta"));
t("nenhum item se perde",
  apertado.visiveis.length + apertado.escondidos.length === itens.length);
t("nenhum item aparece nos dois lados",
  apertado.visiveis.every((v) => !apertado.escondidos.some((e) => e.id === v.id)));

const ordemOriginal = itens.map((i) => i.id);
t("a ordem de leitura e mantida",
  apertado.visiveis.map((i) => i.id).join() ===
    ordemOriginal.filter((id) => apertado.visiveis.some((v) => v.id === id)).join(),
  "reordenar faz o menu parecer que muda sozinho");

t("zero visiveis manda tudo para o Mais",
  separarItens(itens, 0).escondidos.length === itens.length);

console.log(`\nPassou: ${pass}   Falhou: ${fail}`);
process.exit(fail > 0 ? 1 : 0);
