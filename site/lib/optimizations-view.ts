import type { ActiveOptimization } from "./repo/types.ts";

/**
 * Logica da pagina de Otimizacoes Ativas.
 *
 * Vive fora dos componentes por duas razoes: e testavel sem browser, e a
 * mesma decisao (que categoria e esta? esta pendente de reinicio?) e
 * precisa em varios sitios - cartoes, estatisticas, resumo - e tres
 * copias acabariam por divergir.
 *
 * Nada aqui inventa dados. A app desktop envia o que envia; o que nao
 * vier fica por "nao enviado" em vez de aparecer um valor plausivel.
 */

export type CategoriaId =
  | "system"
  | "game"
  | "net"
  | "power"
  | "privacy"
  | "ux"
  | "gpu"
  | "mem"
  | "cpu"
  | "storage"
  | "mmcss"
  | "input"
  | "outra";

export type Categoria = {
  id: CategoriaId;
  label: string;
  /** Cor do tema, nunca uma cor nova. */
  tone: "chart-1" | "good" | "warning" | "cyan" | "neutro";
};

/**
 * Os ids dos tweaks sao `categoria.nome` - o prefixo diz a familia. Mapear
 * aqui evita que a interface mostre "mmcss" a alguem que nao faz ideia do
 * que isso e.
 */
export const CATEGORIAS: Record<CategoriaId, Categoria> = {
  game: { id: "game", label: "Gaming", tone: "chart-1" },
  system: { id: "system", label: "Sistema", tone: "neutro" },
  net: { id: "net", label: "Rede", tone: "cyan" },
  power: { id: "power", label: "Energia", tone: "warning" },
  privacy: { id: "privacy", label: "Privacidade", tone: "good" },
  ux: { id: "ux", label: "Interface", tone: "neutro" },
  gpu: { id: "gpu", label: "Gráficos", tone: "chart-1" },
  mem: { id: "mem", label: "Memória", tone: "neutro" },
  cpu: { id: "cpu", label: "Processador", tone: "neutro" },
  storage: { id: "storage", label: "Armazenamento", tone: "neutro" },
  mmcss: { id: "mmcss", label: "Multimédia", tone: "cyan" },
  input: { id: "input", label: "Rato e teclado", tone: "chart-1" },
  outra: { id: "outra", label: "Outra", tone: "neutro" },
};

export function categoriaDe(item: Pick<ActiveOptimization, "category" | "tweak_id">): Categoria {
  const bruto = (item.category || item.tweak_id.split(".")[0] || "").toLowerCase();
  return CATEGORIAS[bruto as CategoriaId] ?? CATEGORIAS.outra;
}

/** Ordem de grandeza do impacto, para poder ordenar por ele. */
export function pesoImpacto(impacto: string | null): number {
  switch ((impacto ?? "").toLowerCase()) {
    case "alto":
      return 3;
    case "medio":
    case "médio":
      return 2;
    case "baixo":
      return 1;
    // "variavel" e "nenhum" ficam abaixo de "baixo": nao se pode prometer
    // o que depende da maquina, nem destacar o que nao muda nada.
    default:
      return 0;
  }
}

export const ORDENACOES = [
  { id: "recentes", label: "Mais recentes" },
  { id: "antigas", label: "Mais antigas" },
  { id: "nome", label: "Nome" },
  { id: "categoria", label: "Categoria" },
  { id: "impacto-maior", label: "Maior impacto" },
  { id: "impacto-menor", label: "Menor impacto" },
] as const;

export type OrdenacaoId = (typeof ORDENACOES)[number]["id"];

export function ordenar(
  itens: ActiveOptimization[],
  ordem: OrdenacaoId,
): ActiveOptimization[] {
  const copia = [...itens];
  switch (ordem) {
    case "antigas":
      return copia.sort((a, b) => a.applied_at - b.applied_at);
    case "nome":
      return copia.sort((a, b) => a.name.localeCompare(b.name, "pt"));
    case "categoria":
      return copia.sort(
        (a, b) =>
          categoriaDe(a).label.localeCompare(categoriaDe(b).label, "pt") ||
          b.applied_at - a.applied_at,
      );
    case "impacto-maior":
      return copia.sort(
        (a, b) => pesoImpacto(b.impact) - pesoImpacto(a.impact) || b.applied_at - a.applied_at,
      );
    case "impacto-menor":
      return copia.sort(
        (a, b) => pesoImpacto(a.impact) - pesoImpacto(b.impact) || b.applied_at - a.applied_at,
      );
    default:
      return copia.sort((a, b) => b.applied_at - a.applied_at);
  }
}

/**
 * Pesquisa em nome, id, descricao, categoria, sessao e maquina.
 *
 * Sem acentos e sem maiusculas dos dois lados: procurar "graficos" tem de
 * encontrar "Gráficos", senao a pesquisa parece partida.
 */
function normalizarTexto(v: string): string {
  return v
    .toLowerCase()
    .normalize("NFD")
    // Marcas de acentuacao combinantes: o NFD separa "á" em "a" + acento,
    // e isto remove o acento. Escrito por codigo e nao pelos caracteres em
    // si, que sao invisiveis no editor e faceis de partir sem dar por isso.
    .replace(/[̀-ͯ]/g, "");
}

export function pesquisar(itens: ActiveOptimization[], termo: string): ActiveOptimization[] {
  const alvo = normalizarTexto(termo.trim());
  if (!alvo) return itens;

  return itens.filter((item) => {
    const campos = [
      item.name,
      item.tweak_id,
      item.description ?? "",
      categoriaDe(item).label,
      item.session_id ?? "",
      item.machine_hwid ?? "",
      item.machine_gpu ?? "",
    ];
    return normalizarTexto(campos.join(" ")).includes(alvo);
  });
}

export type FiltroId = "todas" | "reinicio" | CategoriaId;

export function filtrar(itens: ActiveOptimization[], filtro: FiltroId): ActiveOptimization[] {
  if (filtro === "todas") return itens;
  if (filtro === "reinicio") return itens.filter((i) => i.requires_reboot === 1);
  return itens.filter((i) => categoriaDe(i).id === filtro);
}

/** Categorias presentes nos dados, com contagem. So essas viram filtro. */
export function contagemPorCategoria(
  itens: ActiveOptimization[],
): Array<{ categoria: Categoria; total: number }> {
  const mapa = new Map<CategoriaId, number>();
  for (const item of itens) {
    const c = categoriaDe(item).id;
    mapa.set(c, (mapa.get(c) ?? 0) + 1);
  }
  return [...mapa.entries()]
    .map(([id, total]) => ({ categoria: CATEGORIAS[id], total }))
    .sort((a, b) => b.total - a.total || a.categoria.label.localeCompare(b.categoria.label, "pt"));
}

export type GrupoTemporal = {
  /** "Hoje", "Ontem", ou a data. */
  titulo: string;
  itens: ActiveOptimization[];
};

/**
 * Agrupa por dia para a timeline.
 *
 * Compara datas no fuso local e nao por diferenca de segundos: algo
 * aplicado a 1h da manha nao e "ha 20 horas, portanto ontem" - foi hoje.
 */
export function agruparPorDia(itens: ActiveOptimization[], agora = new Date()): GrupoTemporal[] {
  const dia = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  const hoje = dia(agora);
  const ontemData = new Date(agora);
  ontemData.setDate(ontemData.getDate() - 1);
  const ontem = dia(ontemData);

  const grupos = new Map<string, ActiveOptimization[]>();
  for (const item of [...itens].sort((a, b) => b.applied_at - a.applied_at)) {
    const chave = dia(new Date(item.applied_at * 1000));
    grupos.set(chave, [...(grupos.get(chave) ?? []), item]);
  }

  return [...grupos.entries()].map(([chave, lista]) => {
    let titulo: string;
    if (chave === hoje) titulo = "Hoje";
    else if (chave === ontem) titulo = "Ontem";
    else {
      titulo = new Intl.DateTimeFormat("pt-PT", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      }).format(new Date(lista[0].applied_at * 1000));
    }
    return { titulo, itens: lista };
  });
}

export type Resumo = {
  total: number;
  categorias: number;
  maquinas: number;
  pendentesReinicio: number;
  /** Aplicadas em modo de simulacao: nao mexeram no Registry a serio. */
  emSimulacao: number;
  ultimaAplicacao: number | null;
  /** Frases curtas para o resumo. Cada uma so aparece se for verdade. */
  linhas: string[];
};

/**
 * Resumo honesto do estado.
 *
 * NAO ha "nenhum erro encontrado" a menos que se saiba disso. A app envia
 * as otimizacoes que aplicou com sucesso - o que esta nesta lista foi
 * aplicado. Dizer "nenhum erro" seria afirmar algo que estes dados nao
 * provam; o que se afirma e o que se sabe.
 */
export function resumir(itens: ActiveOptimization[]): Resumo {
  const maquinas = new Set(itens.map((i) => i.machine_hwid).filter(Boolean));
  const pendentesReinicio = itens.filter((i) => i.requires_reboot === 1).length;
  const emSimulacao = itens.filter((i) => i.mode !== "Real").length;
  const ultimaAplicacao = itens.length
    ? Math.max(...itens.map((i) => i.applied_at))
    : null;

  const linhas: string[] = [];
  if (itens.length) {
    linhas.push(
      `${itens.length} ${itens.length === 1 ? "otimização ativa" : "otimizações ativas"} em ` +
        `${maquinas.size || 1} ${maquinas.size === 1 || !maquinas.size ? "computador" : "computadores"}.`,
    );
  }
  if (pendentesReinicio > 0) {
    linhas.push(
      `${pendentesReinicio} ${pendentesReinicio === 1 ? "aguarda" : "aguardam"} reinício para ter efeito completo.`,
    );
  }
  if (emSimulacao > 0) {
    linhas.push(
      `${emSimulacao} ${emSimulacao === 1 ? "foi aplicada" : "foram aplicadas"} em modo de simulação — não alteraram o sistema.`,
    );
  }
  if (itens.length) {
    linhas.push("Todas podem ser revertidas pelo histórico da aplicação.");
  }

  return {
    total: itens.length,
    categorias: contagemPorCategoria(itens).length,
    maquinas: maquinas.size,
    pendentesReinicio,
    emSimulacao,
    ultimaAplicacao,
    linhas,
  };
}

/** "há 2 horas", "há 3 dias". Null quando nao ha data. */
export function haQuanto(segundos: number | null | undefined, agora = Date.now()): string | null {
  if (!segundos) return null;
  const s = Math.max(0, Math.floor(agora / 1000) - segundos);
  if (s < 60) return "agora mesmo";
  const m = Math.floor(s / 60);
  if (m < 60) return `há ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `há ${h} ${h === 1 ? "hora" : "horas"}`;
  const d = Math.floor(h / 24);
  if (d < 30) return `há ${d} ${d === 1 ? "dia" : "dias"}`;
  const meses = Math.floor(d / 30);
  return `há ${meses} ${meses === 1 ? "mês" : "meses"}`;
}

export function dataHora(valor: number | null | undefined): string {
  if (!valor) return "Sem data";
  return new Intl.DateTimeFormat("pt-PT", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(valor * 1000));
}
