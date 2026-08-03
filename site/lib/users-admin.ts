/**
 * Logica da Gestao de Contas.
 *
 * Fora do componente de 1200 linhas para poder ser testada sem browser.
 * Mesma regra das outras paginas: nada aqui inventa dados.
 *
 * O que estava mal e que so se via a usar:
 *
 * - Os filtros "Windows" e "Regiao" nao eram filtros. A condicao escrita
 *   era `filters.windows === "all" && filters.region === "all"`, portanto
 *   escolher qualquer valor tornava a condicao falsa para TODOS os
 *   utilizadores e a lista ficava vazia.
 * - A "Regiao" nunca teve dados: o contador era `region: 0` e o filtro
 *   devolvia sempre false. Nao existe pais nem IP em lado nenhum do
 *   perfil, portanto foi removida em vez de fingida.
 * - A pesquisa juntava a string "token preparado" ao texto de cada
 *   utilizador, o que fazia procurar "token" devolver toda a gente.
 */

/** So os campos usados. Serve qualquer coisa com a forma de UserProfile. */
export type ContaFiltravel = {
  id: number;
  username: string;
  email: string | null;
  role: string;
  tier: string | null;
  status: string;
  hwid: string | null;
  expires_at: number | null;
  created_at: number;
  discord_id: string | null;
  discord_username: string | null;
  client_version: string | null;
  client_seen_at: number | null;
};

export type FiltroRapido = {
  chave: string;
  label: string;
  /** Nome do icone; o componente e que sabe desenha-lo. */
  icone: string;
};

/**
 * Filtros rapidos.
 *
 * Os planos vem da base de dados e nao de uma lista escrita a mao: a que
 * estava no componente tinha basic/pro/ultimate/special fixos e ficava
 * errada assim que um plano fosse criado ou desactivado.
 */
export function filtrosRapidos(planos: Array<{ code: string; name: string }>): FiltroRapido[] {
  return [
    { chave: "all", label: "Todos", icone: "users" },
    { chave: "active", label: "Ativos", icone: "check" },
    { chave: "suspended", label: "Suspensos", icone: "ban" },
    { chave: "banned", label: "Banidos", icone: "shield" },
    { chave: "no_license", label: "Sem licença", icone: "key" },
    { chave: "lifetime", label: "Life-time", icone: "sparkles" },
    ...planos.map((p) => ({ chave: `plan:${p.code}`, label: p.name, icone: "badge" })),
    { chave: "owner", label: "Owner", icone: "shield" },
    { chave: "developer", label: "Admin", icone: "shield" },
    { chave: "staff", label: "Staff", icone: "shield" },
    { chave: "discord", label: "Discord ligado", icone: "discord" },
    { chave: "machine", label: "Computador associado", icone: "monitor" },
    { chave: "recent", label: "Ativo nos últimos 7 dias", icone: "clock" },
    { chave: "windows", label: "Com cliente Windows", icone: "monitor" },
  ];
}

export function temLicenca(user: ContaFiltravel): boolean {
  return user.tier !== null || user.expires_at !== null;
}

export type TipoLicenca = "none" | "lifetime" | "active" | "expired";

export function tipoDeLicenca(user: ContaFiltravel, agora: number): TipoLicenca {
  if (!temLicenca(user)) return "none";
  if (user.expires_at === null) return "lifetime";
  return user.expires_at > agora ? "active" : "expired";
}

export function textoDaLicenca(user: ContaFiltravel, agora: number): string {
  const tipo = tipoDeLicenca(user, agora);
  if (tipo === "none") return "sem licença";
  if (tipo === "lifetime") return "life-time";
  if (tipo === "expired") return "expirada";
  const dias = Math.ceil((user.expires_at! - agora) / 86400);
  return dias === 1 ? "1 dia" : `${dias} dias`;
}

/**
 * Texto onde a pesquisa procura.
 *
 * Antes incluia a constante "token preparado", que nao vem de lado nenhum
 * e fazia qualquer pesquisa por "token" devolver todos os utilizadores.
 */
export function textoPesquisavel(user: ContaFiltravel, agora: number): string {
  return [
    user.username,
    user.email,
    user.discord_username,
    user.discord_id,
    user.hwid,
    user.tier,
    user.role,
    user.status,
    user.client_version,
    textoDaLicenca(user, agora),
  ]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase("pt");
}

export function correspondeAoFiltro(user: ContaFiltravel, chave: string, agora: number): boolean {
  if (chave === "all") return true;
  if (chave.startsWith("plan:")) return user.tier === chave.slice(5);
  if (chave === "active") return user.status === "active";
  if (chave === "suspended") return user.status === "suspended";
  if (chave === "banned") return user.status === "banned";
  if (chave === "no_license") return !temLicenca(user);
  if (chave === "lifetime") return temLicenca(user) && user.expires_at === null;
  if (chave === "owner" || chave === "developer" || chave === "staff") return user.role === chave;
  if (chave === "discord") return Boolean(user.discord_id);
  if (chave === "machine") return Boolean(user.hwid);
  if (chave === "recent") return (user.client_seen_at ?? 0) >= agora - 86400 * 7;
  if (chave === "windows") return Boolean(user.client_version);
  return true;
}

export function correspondeAoUltimoLogin(
  user: ContaFiltravel,
  valor: string,
  agora: number,
): boolean {
  const visto = user.client_seen_at ?? 0;
  if (valor === "all") return true;
  if (valor === "online") return visto >= agora - 300;
  if (valor === "24h") return visto >= agora - 86400;
  if (valor === "7d") return visto >= agora - 86400 * 7;
  if (valor === "never") return visto === 0;
  return true;
}

export type Filtros = {
  quick: string;
  plan: string;
  role: string;
  status: string;
  license: string;
  lastLogin: string;
  discord: string;
  sort: string;
};

export const FILTROS_INICIAIS: Filtros = {
  quick: "all",
  plan: "all",
  role: "all",
  status: "all",
  license: "all",
  lastLogin: "all",
  discord: "all",
  sort: "recent",
};

/** Quantos filtros estao a restringir a lista. Zero = a ver tudo. */
export function filtrosActivos(filtros: Filtros): number {
  let n = 0;
  if (filtros.quick !== "all") n++;
  if (filtros.plan !== "all") n++;
  if (filtros.role !== "all") n++;
  if (filtros.status !== "all") n++;
  if (filtros.license !== "all") n++;
  if (filtros.lastLogin !== "all") n++;
  if (filtros.discord !== "all") n++;
  return n;
}

export function aplicarFiltros<T extends ContaFiltravel>(
  users: T[],
  pesquisa: string,
  filtros: Filtros,
  agora: number,
): T[] {
  const agulha = pesquisa.trim().toLocaleLowerCase("pt");

  const resultado = users.filter((user) => {
    if (agulha && !textoPesquisavel(user, agora).includes(agulha)) return false;
    if (!correspondeAoFiltro(user, filtros.quick, agora)) return false;
    if (filtros.plan !== "all" && (user.tier ?? "none") !== filtros.plan) return false;
    if (filtros.role !== "all" && user.role !== filtros.role) return false;
    if (filtros.status !== "all" && user.status !== filtros.status) return false;
    if (filtros.license !== "all" && tipoDeLicenca(user, agora) !== filtros.license) return false;
    if (filtros.discord !== "all") {
      const ligado = Boolean(user.discord_id);
      if (filtros.discord === "linked" ? !ligado : ligado) return false;
    }
    if (!correspondeAoUltimoLogin(user, filtros.lastLogin, agora)) return false;
    return true;
  });

  return ordenar(resultado, filtros.sort);
}

export function ordenar<T extends ContaFiltravel>(users: T[], criterio: string): T[] {
  const copia = [...users];
  if (criterio === "name") return copia.sort((a, b) => a.username.localeCompare(b.username, "pt"));
  if (criterio === "old") return copia.sort((a, b) => a.created_at - b.created_at);
  if (criterio === "login")
    return copia.sort((a, b) => (b.client_seen_at ?? 0) - (a.client_seen_at ?? 0));
  if (criterio === "plan")
    return copia.sort((a, b) => (a.tier ?? "zz").localeCompare(b.tier ?? "zz", "pt"));
  return copia.sort((a, b) => b.created_at - a.created_at);
}

/** Contagem por filtro rapido. Usa o mesmo predicado da filtragem. */
export function contar(
  users: ContaFiltravel[],
  filtros: FiltroRapido[],
  agora: number,
): Record<string, number> {
  const contagens: Record<string, number> = {};
  for (const filtro of filtros) {
    contagens[filtro.chave] = users.filter((u) =>
      correspondeAoFiltro(u, filtro.chave, agora),
    ).length;
  }
  return contagens;
}

/**
 * Colunas da tabela.
 *
 * "Windows" e "Pais" saíram: o pais nunca existiu no perfil e a coluna
 * Windows mostrava "Preparado para API". A versao do cliente, essa, e
 * real e fica na coluna "Cliente".
 */
export const COLUNAS = [
  "Avatar",
  "Discord",
  "Plano",
  "Cargo",
  "Hardware",
  "Cliente",
  "Licença",
  "Último acesso",
] as const;
