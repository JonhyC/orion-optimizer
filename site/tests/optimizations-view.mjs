/**
 * Logica da pagina de Otimizacoes Ativas.
 *
 *   node tests/optimizations-view.mjs
 *
 * Nao precisa de Firestore nem de browser: e tudo funcoes puras sobre uma
 * lista. E onde os defeitos desta pagina se escondem - uma ordenacao
 * errada ou uma pesquisa que ignora acentos nao rebentam, so mostram a
 * coisa errada.
 */
import {
  agruparPorDia,
  categoriaDe,
  contagemPorCategoria,
  filtrar,
  ordenar,
  pesoImpacto,
  pesquisar,
  resumir,
  haQuanto,
} from "../lib/optimizations-view.ts";

let pass = 0, fail = 0;
const t = (nome, cond, detalhe = "") => {
  if (cond) { pass++; console.log(`  [OK]   ${nome}`); }
  else { fail++; console.log(`  [FALHA] ${nome}`); if (detalhe) console.log(`          ${detalhe}`); }
};

const AGORA = Math.floor(Date.now() / 1000);
const item = (o) => ({
  id: o.id ?? o.tweak_id, user_id: 1, tweak_id: o.tweak_id, name: o.name ?? o.tweak_id,
  description: o.description ?? null, category: o.category ?? o.tweak_id.split(".")[0],
  impact: o.impact ?? null, requires_reboot: o.requires_reboot ?? 0,
  session_id: o.session_id ?? null, applied_at: o.applied_at ?? AGORA,
  mode: o.mode ?? "Real", machine_hwid: o.machine_hwid ?? "PC-A",
  machine_chassis: null, machine_gpu: o.machine_gpu ?? null, machine_ram_gb: null,
  client_version: o.client_version ?? null, updated_at: AGORA,
});

const dados = [
  item({ tweak_id: "game.dvr-background", name: "Desativar Game DVR", impact: "alto", applied_at: AGORA - 3600 }),
  item({ tweak_id: "gpu.hags", name: "Aceleração Gráfica", impact: "variavel", requires_reboot: 1, applied_at: AGORA - 7200 }),
  item({ tweak_id: "net.throttling-index", name: "Network Throttling", impact: "medio", requires_reboot: 1, applied_at: AGORA - 90000 }),
  item({ tweak_id: "privacy.advertising-id", name: "ID de publicidade", impact: "nenhum", applied_at: AGORA - 200000, machine_hwid: "PC-B" }),
  item({ tweak_id: "ux.menu-delay", name: "Atraso dos menus", impact: "baixo", mode: "Mock", applied_at: AGORA - 400000 }),
];

console.log("=== Categorias ===");
t("prefixo do id vira categoria legivel", categoriaDe(dados[0]).label === "Gaming", categoriaDe(dados[0]).label);
t("net -> Rede", categoriaDe(dados[2]).label === "Rede");
t("prefixo desconhecido cai em Outra",
  categoriaDe({ category: "xpto", tweak_id: "xpto.coisa" }).label === "Outra");
t("sem categoria usa o prefixo do id",
  categoriaDe({ category: "", tweak_id: "power.qualquer" }).label === "Energia");

console.log("\n=== Impacto ===");
t("alto > medio > baixo", pesoImpacto("alto") > pesoImpacto("medio") && pesoImpacto("medio") > pesoImpacto("baixo"));
t("medio com acento conta igual", pesoImpacto("médio") === pesoImpacto("medio"),
  "a app pode enviar com ou sem acento");
t("variavel fica abaixo de baixo", pesoImpacto("variavel") < pesoImpacto("baixo"),
  "nao se destaca o que depende da maquina");
t("null nao rebenta", pesoImpacto(null) === 0);

console.log("\n=== Ordenacao ===");
t("recentes primeiro", ordenar(dados, "recentes")[0].tweak_id === "game.dvr-background");
t("antigas primeiro", ordenar(dados, "antigas")[0].tweak_id === "ux.menu-delay");
t("por nome", ordenar(dados, "nome")[0].name === "Aceleração Gráfica", ordenar(dados, "nome")[0].name);
t("maior impacto primeiro", ordenar(dados, "impacto-maior")[0].impact === "alto");
t("menor impacto primeiro", pesoImpacto(ordenar(dados, "impacto-menor")[0].impact) === 0);
t("ordenar nao muda o array original", dados[0].tweak_id === "game.dvr-background",
  "sort() muta - tem de haver copia");

console.log("\n=== Pesquisa ===");
t("por nome", pesquisar(dados, "Game DVR").length === 1);
t("por id do tweak", pesquisar(dados, "throttling").length === 1);
t("por categoria", pesquisar(dados, "Rede").length === 1);
t("ignora maiusculas", pesquisar(dados, "GAME DVR").length === 1);
t("ignora acentos: 'graficos' encontra 'Gráficos'", pesquisar(dados, "graficos").length === 1,
  `encontrou ${pesquisar(dados, "graficos").length}`);
t("ignora acentos ao contrario: 'Gráfica' encontra", pesquisar(dados, "Gráfica").length === 1);
t("termo vazio devolve tudo", pesquisar(dados, "   ").length === dados.length);
t("sem resultados devolve vazio", pesquisar(dados, "zzzz").length === 0);
t("por maquina", pesquisar(dados, "PC-B").length === 1);

console.log("\n=== Filtros ===");
t("todas", filtrar(dados, "todas").length === 5);
t("por categoria", filtrar(dados, "game").length === 1);
t("rollback/reinicio pendente", filtrar(dados, "reinicio").length === 2);
t("categoria sem itens devolve vazio", filtrar(dados, "mem").length === 0);

console.log("\n=== Contagem por categoria ===");
const contagens = contagemPorCategoria(dados);
t("uma entrada por categoria presente", contagens.length === 5, String(contagens.length));
t("nao inclui categorias ausentes",
  !contagens.some((c) => c.categoria.id === "mem"),
  "so aparecem as que existem nos dados");
t("total bate com a lista", contagens.reduce((s, c) => s + c.total, 0) === dados.length);

console.log("\n=== Timeline ===");
const grupos = agruparPorDia(dados);
t("agrupa por dia", grupos.length >= 2, `${grupos.length} grupos`);
t("o primeiro grupo e o mais recente", grupos[0].itens[0].tweak_id === "game.dvr-background");
t("hoje aparece como 'Hoje'", grupos[0].titulo === "Hoje", grupos[0].titulo);
// A meia-noite: aplicado ha 20h pode ainda ser "Hoje" se foi de madrugada.
const meiaNoite = new Date();
meiaNoite.setHours(1, 0, 0, 0);
const deMadrugada = [item({ tweak_id: "ux.x", applied_at: Math.floor(meiaNoite.getTime() / 1000) })];
t("compara datas e nao horas decorridas",
  agruparPorDia(deMadrugada, meiaNoite)[0].titulo === "Hoje",
  "algo aplicado a 1h da manha e de hoje, nao de ontem");

console.log("\n=== Resumo ===");
const r = resumir(dados);
t("conta o total", r.total === 5);
t("conta maquinas distintas", r.maquinas === 2, String(r.maquinas));
t("conta pendentes de reinicio", r.pendentesReinicio === 2);
t("conta as em simulacao", r.emSimulacao === 1);
t("a ultima aplicacao e a mais recente", r.ultimaAplicacao === AGORA - 3600);
t("menciona a simulacao", r.linhas.some((l) => /simula/i.test(l)),
  "aplicar em Mock nao alterou o sistema - tem de ser dito");
t("NAO afirma 'nenhum erro'", !r.linhas.some((l) => /erro/i.test(l)),
  "estes dados nao provam ausencia de erros; afirma-lo seria inventar");

const vazio = resumir([]);
t("lista vazia nao inventa linhas", vazio.linhas.length === 0);
t("lista vazia nao tem ultima aplicacao", vazio.ultimaAplicacao === null);

console.log("\n=== Tempo relativo ===");
t("minutos", haQuanto(AGORA - 300) === "há 5 min", haQuanto(AGORA - 300));
t("horas no singular", haQuanto(AGORA - 3600) === "há 1 hora");
t("dias no plural", haQuanto(AGORA - 259200) === "há 3 dias");
t("null devolve null", haQuanto(null) === null);
t("futuro nao da negativo", haQuanto(AGORA + 500) === "agora mesmo");

console.log(`\nPassou: ${pass}   Falhou: ${fail}`);
process.exit(fail > 0 ? 1 : 0);
