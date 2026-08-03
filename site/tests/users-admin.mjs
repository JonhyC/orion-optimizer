/**
 * Logica da Gestao de Contas.
 *
 *   node tests/users-admin.mjs
 *
 * Cada bloco aqui corresponde a uma coisa que a pagina fazia mal e que so
 * se notava a usar: filtros que esvaziavam a lista, uma pesquisa que
 * devolvia toda a gente, contadores que nunca subiam de zero.
 */
import {
  COLUNAS,
  FILTROS_INICIAIS,
  aplicarFiltros,
  contar,
  correspondeAoFiltro,
  correspondeAoUltimoLogin,
  filtrosActivos,
  filtrosRapidos,
  ordenar,
  temLicenca,
  textoDaLicenca,
  textoPesquisavel,
  tipoDeLicenca,
} from "../lib/users-admin.ts";

let pass = 0, fail = 0;
const t = (nome, cond, detalhe = "") => {
  if (cond) { pass++; console.log(`  [OK]   ${nome}`); }
  else { fail++; console.log(`  [FALHA] ${nome}`); if (detalhe) console.log(`          ${detalhe}`); }
};

const AGORA = 1_800_000_000;
const dias = (n) => AGORA + n * 86400;

let proximoId = 1;
const conta = (p = {}) => ({
  id: proximoId++, username: "user", email: null, role: "client", tier: null,
  status: "active", hwid: null, expires_at: null, created_at: dias(-100),
  discord_id: null, discord_username: null, client_version: null, client_seen_at: null,
  ...p,
});

const PLANOS = [
  { code: "pro", name: "Pro" },
  { code: "ultimate", name: "Ultimate" },
  { code: "special", name: "Special" },
];

console.log("=== Filtros rapidos ===");
const rapidos = filtrosRapidos(PLANOS);
t("um filtro por plano da base de dados",
  PLANOS.every((p) => rapidos.some((f) => f.chave === `plan:${p.code}`)),
  "a lista estava escrita a mao e ficava errada com qualquer plano novo");
t("usa o NOME do plano, nao o codigo",
  rapidos.some((f) => f.label === "Special"));
t("NAO tem filtro de regiao",
  !rapidos.some((f) => /regi/i.test(f.label)),
  "nunca teve dados: o contador era 0 e o filtro devolvia sempre false");
t("chaves unicas", new Set(rapidos.map((f) => f.chave)).size === rapidos.length);

console.log("\n=== Filtros que esvaziavam a lista ===");
const comCliente = conta({ client_version: "2.1.1" });
const semCliente = conta({});
t("o filtro Windows encontra quem tem cliente",
  correspondeAoFiltro(comCliente, "windows", AGORA) === true);
t("o filtro Windows exclui quem nao tem",
  correspondeAoFiltro(semCliente, "windows", AGORA) === false);
t("escolher Windows NAO esvazia a lista",
  aplicarFiltros([comCliente, semCliente], "", { ...FILTROS_INICIAIS, quick: "windows" }, AGORA).length === 1,
  "a condicao antiga era `filters.windows === 'all'`, que dava falso para todos");

console.log("\n=== Pesquisa ===");
const alice = conta({ username: "alice", discord_username: "alice#1", tier: "pro" });
const bob = conta({ username: "bob" });
t("nao injecta 'token preparado' no texto",
  !/token/.test(textoPesquisavel(alice, AGORA)),
  textoPesquisavel(alice, AGORA));
t("procurar 'token' NAO devolve toda a gente",
  aplicarFiltros([alice, bob], "token", FILTROS_INICIAIS, AGORA).length === 0);
t("encontra pelo nome", aplicarFiltros([alice, bob], "alice", FILTROS_INICIAIS, AGORA).length === 1);
t("encontra pelo Discord", aplicarFiltros([alice, bob], "alice#1", FILTROS_INICIAIS, AGORA).length === 1);
t("ignora maiusculas", aplicarFiltros([alice, bob], "ALICE", FILTROS_INICIAIS, AGORA).length === 1);
t("pesquisa vazia devolve tudo", aplicarFiltros([alice, bob], "   ", FILTROS_INICIAIS, AGORA).length === 2);

console.log("\n=== Licenca ===");
t("sem plano nem data nao tem licenca", temLicenca(conta({})) === false);
t("so com data ja tem licenca", temLicenca(conta({ expires_at: dias(10) })) === true);
t("vitalicia", tipoDeLicenca(conta({ tier: "pro" }), AGORA) === "lifetime");
t("activa", tipoDeLicenca(conta({ tier: "pro", expires_at: dias(5) }), AGORA) === "active");
t("expirada", tipoDeLicenca(conta({ tier: "pro", expires_at: dias(-5) }), AGORA) === "expired");
t("sem licenca", tipoDeLicenca(conta({}), AGORA) === "none");
t("texto conta os dias", textoDaLicenca(conta({ tier: "pro", expires_at: dias(9) }), AGORA) === "9 dias");
t("singular a um dia", textoDaLicenca(conta({ tier: "pro", expires_at: dias(1) }), AGORA) === "1 dia");
t("texto com acentos", textoDaLicenca(conta({}), AGORA) === "sem licença");

console.log("\n=== Ultimo acesso ===");
const agoraMesmo = conta({ client_seen_at: AGORA - 60 });
const ontem = conta({ client_seen_at: AGORA - 86400 * 2 });
const nunca = conta({});
t("online conta os ultimos 5 minutos", correspondeAoUltimoLogin(agoraMesmo, "online", AGORA));
t("online exclui ontem", !correspondeAoUltimoLogin(ontem, "online", AGORA));
t("7 dias inclui ontem", correspondeAoUltimoLogin(ontem, "7d", AGORA));
t("nunca apanha quem nao tem registo", correspondeAoUltimoLogin(nunca, "never", AGORA));
t("nunca exclui quem ja entrou", !correspondeAoUltimoLogin(ontem, "never", AGORA));
t("'all' deixa passar tudo", correspondeAoUltimoLogin(nunca, "all", AGORA));

console.log("\n=== Contadores ===");
const povo = [
  conta({ status: "active", tier: "pro", discord_id: "1" }),
  conta({ status: "active", tier: "special", hwid: "abc" }),
  conta({ status: "suspended" }),
  conta({ role: "owner", tier: "ultimate" }),
];
const contagens = contar(povo, rapidos, AGORA);
t("total certo", contagens.all === 4);
t("activos certos", contagens.active === 3, String(contagens.active));
t("suspensos certos", contagens.suspended === 1);
t("conta por plano", contagens["plan:special"] === 1);
t("sem licenca certo", contagens.no_license === 1, String(contagens.no_license));
t("nenhum contador fica preso a zero por nao ter dados",
  Object.entries(contagens).filter(([, v]) => v === 0).every(([k]) => !/regi/i.test(k)));
t("o contador bate certo com o filtro",
  rapidos.every((f) =>
    contagens[f.chave] === aplicarFiltros(povo, "", { ...FILTROS_INICIAIS, quick: f.chave }, AGORA).length),
  "contador e filtro tem de usar o mesmo predicado");

console.log("\n=== Ordenacao ===");
const a = conta({ username: "ana", created_at: dias(-10), client_seen_at: AGORA - 100 });
const z = conta({ username: "zeca", created_at: dias(-1), client_seen_at: AGORA - 5 });
t("por nome", ordenar([z, a], "name")[0].username === "ana");
t("mais recentes primeiro", ordenar([a, z], "recent")[0].username === "zeca");
t("mais antigos primeiro", ordenar([z, a], "old")[0].username === "ana");
t("por ultimo acesso", ordenar([a, z], "login")[0].username === "zeca");
t("nao altera o array original", (() => { const orig = [z, a]; ordenar(orig, "name"); return orig[0].username === "zeca"; })());

console.log("\n=== Contagem de filtros activos ===");
t("nenhum no inicio", filtrosActivos(FILTROS_INICIAIS) === 0);
t("conta um", filtrosActivos({ ...FILTROS_INICIAIS, role: "staff" }) === 1);
t("conta varios", filtrosActivos({ ...FILTROS_INICIAIS, role: "staff", status: "active", quick: "windows" }) === 3);
t("a ordenacao nao conta como filtro",
  filtrosActivos({ ...FILTROS_INICIAIS, sort: "name" }) === 0,
  "ordenar nao esconde ninguem");

console.log("\n=== Colunas ===");
t("nao tem coluna Pais", !COLUNAS.some((c) => /pa[ií]s/i.test(c)),
  "o perfil nunca teve pais nenhum");
t("nao tem coluna Windows falsa", !COLUNAS.includes("Windows"),
  "mostrava 'Preparado para API'");
t("tem a versao do cliente, que e real", COLUNAS.includes("Cliente"));

console.log(`\nPassou: ${pass}   Falhou: ${fail}`);
process.exit(fail > 0 ? 1 : 0);
