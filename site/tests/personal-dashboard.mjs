/**
 * Logica da Area Pessoal.
 *
 *   node tests/personal-dashboard.mjs
 *
 * Nao precisa de Firestore nem de browser. Cada teste aqui corresponde a
 * uma coisa que a pagina dizia ao cliente e nao era verdade.
 */
import {
  ACCOES_VISIVEIS,
  estadoDaLicenca,
  estadoDoSuporte,
  requisitosDeAcesso,
  requisitosEmFalta,
  rotuloDeAtividade,
  totalGasto,
} from "../lib/personal-dashboard.ts";

let pass = 0, fail = 0;
const t = (nome, cond, detalhe = "") => {
  if (cond) { pass++; console.log(`  [OK]   ${nome}`); }
  else { fail++; console.log(`  [FALHA] ${nome}`); if (detalhe) console.log(`          ${detalhe}`); }
};

const AGORA = 1_800_000_000;
const dias = (n) => AGORA + n * 86400;
const licenca = (p) => estadoDaLicenca({
  tier: "pro", expiresAt: dias(30), agora: AGORA,
  acessoInterno: false, contaSuspensa: false, ...p,
});

console.log("=== Estado da licenca ===");
t("licenca folgada fica ativa", licenca({}).badge === "active");
t("licenca folgada nao e urgente", licenca({}).urgente === false);
t("conta o numero de dias certo", licenca({}).diasRestantes === 30, String(licenca({}).diasRestantes));

t("vitalicia nao tem contagem", licenca({ expiresAt: null }).diasRestantes === null);
t("vitalicia diz Life-time", licenca({ expiresAt: null }).texto === "Life-time");

t("expirada NAO diz 'Ativa'", licenca({ expiresAt: dias(-1) }).badge === "failed",
  "era o bug principal: o badge estava escrito a mao como 'active'");
t("expirada diz Expirada", licenca({ expiresAt: dias(-1) }).texto === "Expirada");
t("expirada e urgente", licenca({ expiresAt: dias(-1) }).urgente === true);
t("expirada nao mostra dias negativos", licenca({ expiresAt: dias(-40) }).diasRestantes === 0,
  String(licenca({ expiresAt: dias(-40) }).diasRestantes));

t("a 3 dias avisa", licenca({ expiresAt: dias(3) }).badge === "pending");
t("a 3 dias e urgente", licenca({ expiresAt: dias(3) }).urgente === true);
t("a 7 dias ainda avisa", licenca({ expiresAt: dias(7) }).urgente === true);
t("a 8 dias ja nao avisa", licenca({ expiresAt: dias(8) }).urgente === false,
  "o limite e 7 e tem de ser inclusivo de um lado so");
t("singular a um dia", licenca({ expiresAt: dias(1) }).texto === "1 dia",
  licenca({ expiresAt: dias(1) }).texto);

t("suspensa ganha a data valida",
  licenca({ contaSuspensa: true, expiresAt: dias(300) }).badge === "failed",
  "uma conta suspensa nao tem acesso mesmo com licenca por gastar");
t("suspensa e urgente", licenca({ contaSuspensa: true }).urgente === true);

const interno = estadoDaLicenca({
  tier: null, expiresAt: null, agora: AGORA, acessoInterno: true, contaSuspensa: false,
});
t("acesso interno reconhecido", interno.texto === "Acesso interno");
t("acesso interno nao e urgente", interno.urgente === false);

console.log("\n=== Estado do suporte ===");
const suporte = (p) => estadoDoSuporte({
  supportLifetime: 0, supportExpiresAt: null, agora: AGORA, ...p,
});
t("vitalicio", suporte({ supportLifetime: 1 }).texto === "Life-time");
t("vitalicio esta ativo", suporte({ supportLifetime: 1 }).ativo === true);
t("nunca teve diz 'Não incluído'", suporte({}).texto === "Não incluído");
t("expirado NAO diz 'Não incluído'",
  suporte({ supportExpiresAt: dias(-5) }).texto === "Terminado",
  "quem pagou suporte e o viu acabar nao pode ler que nunca o teve");
t("expirado nao esta ativo", suporte({ supportExpiresAt: dias(-5) }).ativo === false);
t("a decorrer conta dias", suporte({ supportExpiresAt: dias(12) }).texto === "12 dias");
t("a decorrer esta ativo", suporte({ supportExpiresAt: dias(12) }).ativo === true);
t("singular a um dia", suporte({ supportExpiresAt: dias(1) }).texto === "1 dia");

console.log("\n=== Total gasto ===");
const compra = (cents, currency = "EUR", status = "paid") =>
  ({ amount_cents: cents, currency, status });
t("soma as pagas", totalGasto([compra(2999), compra(1000)]) === totalGasto([compra(3999)]));
t("ignora as nao pagas",
  totalGasto([compra(2999), compra(9999, "EUR", "pending")]) === totalGasto([compra(2999)]));
t("sem compras da zero", totalGasto([]).includes("0"));
t("moedas diferentes nao sao somadas",
  totalGasto([compra(1000, "EUR"), compra(2000, "USD")]).includes("+"),
  "somar cents de moedas diferentes dava um numero que nao existe");
t("moeda em falta assume EUR", totalGasto([compra(1000, "")]) === totalGasto([compra(1000, "EUR")]));

console.log("\n=== Rotulos de atividade ===");
t("usa o nome do produto tal como o resto do site",
  rotuloDeAtividade("login_ok").includes("Orion Optimizer 2.0"),
  "o '2.0' e o nome do produto, nao a versao - que vai em 2.1.1");
t("accao desconhecida tem texto generico",
  rotuloDeAtividade("coisa_nova_qualquer") === "Atividade da conta");
t("as accoes visiveis tem todas rotulo",
  [...ACCOES_VISIVEIS].every((a) => rotuloDeAtividade(a) !== "Atividade da conta"));
t("os rotulos tem acentos", /ã|ç|á|é|í|ó/.test(rotuloDeAtividade("login_ok")));

console.log("\n=== Requisitos de acesso ===");
const todos = requisitosDeAcesso({
  contaAtiva: true, discordLigado: true, computadorAssociado: true, credenciaisGeradas: true,
});
t("quatro requisitos", todos.length === 4);
t("tudo pronto nao deixa nada em falta", requisitosEmFalta(todos) === 0);

const meio = requisitosDeAcesso({
  contaAtiva: true, discordLigado: false, computadorAssociado: false, credenciaisGeradas: true,
});
t("conta os que faltam", requisitosEmFalta(meio) === 2);
t("Discord por ligar nao aparece como pronto",
  meio.find((r) => r.id === "discord").pronto === false,
  "a pagina tinha 'Discord verificado' escrito a mao noutro cartao");

console.log(`\nPassou: ${pass}   Falhou: ${fail}`);
process.exit(fail > 0 ? 1 : 0);
