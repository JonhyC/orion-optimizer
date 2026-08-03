/**
 * Logica do Painel Administrativo.
 *
 *   node tests/admin-dashboard.mjs
 *
 * Nao precisa de Firestore nem de browser. E onde se garante que o painel
 * nao mente ao dono: uma tendencia mal calculada ou um alerta que nao
 * aparece nao rebentam nada - so levam a decisoes erradas.
 */
import {
  derivarAlertas,
  estadoDosServicos,
  recortar,
  tendencia,
  totalDaSerie,
  variacao,
} from "../lib/admin-dashboard.ts";

let pass = 0, fail = 0;
const t = (nome, cond, detalhe = "") => {
  if (cond) { pass++; console.log(`  [OK]   ${nome}`); }
  else { fail++; console.log(`  [FALHA] ${nome}`); if (detalhe) console.log(`          ${detalhe}`); }
};

const serie = (valores) =>
  valores.map((v, i) => ({ date: `2026-01-${String(i + 1).padStart(2, "0")}`, label: String(i + 1), value: v }));

console.log("=== Alertas ===");
const semProblemas = derivarAlertas({
  ticketsPorLer: 0, comprasPendentes: 0, discordBotPronto: true,
  conflitosCatalogo: 0, tweaksSuspensos: 0, contasSuspensas: 0,
});
t("tudo bem nao gera alertas", semProblemas.length === 0, `gerou ${semProblemas.length}`);

const comTudo = derivarAlertas({
  ticketsPorLer: 2, comprasPendentes: 1, discordBotPronto: false,
  conflitosCatalogo: 3, tweaksSuspensos: 1, contasSuspensas: 4,
});
t("gera um alerta por problema", comTudo.length === 6, String(comTudo.length));
t("criticos primeiro", comTudo[0].severidade === "critico", comTudo[0].severidade);
t("tickets sao o mais grave", comTudo[0].id === "tickets");
t("info fica no fim", comTudo[comTudo.length - 1].severidade === "info");
t("alertas accionaveis levam a uma pagina",
  comTudo.filter((a) => a.href).length >= 4);
t("o do Discord nao tem pagina para onde ir",
  comTudo.find((a) => a.id === "discord")?.href === null,
  "resolve-se numa variavel de ambiente, nao no painel");

t("singular e plural", derivarAlertas({
  ticketsPorLer: 1, comprasPendentes: 0, discordBotPronto: true,
  conflitosCatalogo: 0, tweaksSuspensos: 0, contasSuspensas: 0,
})[0].texto === "1 ticket por responder");

t("NAO inclui a versao publicada como alerta",
  !comTudo.some((a) => /vers[aã]o/i.test(a.texto)),
  "e informacao, nao problema - misturar as duas faz nenhuma destacar-se");

console.log("\n=== Recorte de series ===");
const trintaDias = serie(Array.from({ length: 30 }, (_, i) => i + 1));
t("recorta aos ultimos 7", recortar(trintaDias, 7).length === 7);
t("os ultimos sao mesmo os ultimos", recortar(trintaDias, 7)[6].value === 30);
t("pedir mais do que existe devolve tudo", recortar(trintaDias, 90).length === 30,
  "nao inventa dias que nao ha");
t("total soma certo", totalDaSerie(serie([1, 2, 3])) === 6);

console.log("\n=== Tendencia ===");
// Metade anterior soma 2, metade recente soma 6: e o triplo, ou seja +200%.
t("subida detectada", tendencia(serie([1, 1, 3, 3])) === 200, String(tendencia(serie([1, 1, 3, 3]))));
t("duplicar da +100%", tendencia(serie([1, 1, 2, 2])) === 100, String(tendencia(serie([1, 1, 2, 2]))));
t("descida detectada", tendencia(serie([4, 4, 2, 2])) === -50);
t("estavel da zero", tendencia(serie([2, 2, 2, 2])) === 0);
t("metade anterior a zero devolve null", tendencia(serie([0, 0, 5, 5])) === null,
  "dividir por zero daria Infinity% - nao diz nada a ninguem");
t("serie curta demais devolve null", tendencia(serie([1, 5])) === null,
  "com dois dias nao existe tendencia");
t("serie vazia devolve null", tendencia([]) === null);

console.log("\n=== Formatacao de variacao ===");
t("positivo leva sinal", variacao(12.4) === "+12%");
t("negativo mantem o sinal", variacao(-8.9) === "-9%");
t("zero sem sinal de mais", variacao(0) === "0%");
t("null vira travessao", variacao(null) === "—");

console.log("\n=== Estado dos servicos ===");
const servicos = estadoDosServicos({
  firestoreMs: 120, discordBotPronto: true,
  pagamentosConfigurados: false, versaoPublicada: "1.1.6",
});
t("uma linha por servico", servicos.length === 4);
t("base de dados rapida fica ok", servicos[0].estado === "ok");
t("o detalhe da base de dados e uma MEDICAO",
  /120 ms/.test(servicos[0].detalhe),
  servicos[0].detalhe);
t("pagamentos por configurar ficam desligados",
  servicos.find((s) => s.nome === "Pagamentos")?.estado === "desligado");

const lento = estadoDosServicos({
  firestoreMs: 900, discordBotPronto: false,
  pagamentosConfigurados: true, versaoPublicada: "1.1.6",
});
t("base de dados lenta pede atencao", lento[0].estado === "atencao", lento[0].estado);
t("Discord sem token pede atencao",
  lento.find((s) => s.nome === "Discord")?.estado === "atencao");

const semResposta = estadoDosServicos({
  firestoreMs: null, discordBotPronto: true,
  pagamentosConfigurados: true, versaoPublicada: "1.1.6",
});
t("sem resposta e desligado, nao 'ok'", semResposta[0].estado === "desligado");
t("nenhum servico mostra numero inventado",
  !servicos.some((s) => /58 ms/.test(s.detalhe)),
  "o valor fixo que estava no codigo desapareceu");

console.log(`\nPassou: ${pass}   Falhou: ${fail}`);
process.exit(fail > 0 ? 1 : 0);
