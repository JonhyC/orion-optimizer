/**
 * Logica da barra de navegacao do painel.
 *
 * Fora do componente para poder ser testada sem browser. Sao duas coisas
 * que dao erro em silencio quando estao mal: o item marcado como activo e
 * o ponto onde os menus deixam de caber.
 */

export type ItemNav = {
  /** Serve tambem de chave para o icone, que vive no componente. */
  id: string;
  href: string;
  label: string;
  /** Menor = sai primeiro para o dropdown "Mais". */
  prioridade: number;
};

/**
 * Constroi a lista conforme o que a conta pode ver.
 *
 * A ordem e a de leitura; a `prioridade` e que decide quem sobrevive
 * quando o espaco aperta. "Ver site" e o primeiro a sair porque e o unico
 * que leva para fora do painel.
 */
export function itensDeNavegacao(opcoes: { temDashboard: boolean }): ItemNav[] {
  const itens: ItemNav[] = [];

  if (opcoes.temDashboard) {
    itens.push({ id: "dashboard", href: "/panel/dashboard", label: "Área Pessoal", prioridade: 4 });
  }
  itens.push({ id: "conta", href: "/panel", label: "A minha conta", prioridade: 5 });
  if (opcoes.temDashboard) {
    itens.push({
      id: "otimizacoes",
      href: "/panel/active-optimizations",
      label: "Otimizações Ativas",
      prioridade: 3,
    });
  }
  itens.push({ id: "suporte", href: "/panel/support", label: "Suporte", prioridade: 2 });
  itens.push({ id: "site", href: "/", label: "Ver site", prioridade: 1 });

  return itens;
}

/**
 * Qual o item activo para um dado caminho.
 *
 * O prefixo simples nao chega: "/panel" e prefixo de "/panel/dashboard" e
 * de todas as paginas de administracao, o que acenderia "A minha conta"
 * em praticamente todo o painel. Rotas que sao raiz de outras comparam-se
 * por igualdade; as restantes aceitam sub-rotas, para que
 * /panel/support/12 mantenha "Suporte" aceso.
 */
const SO_EXACTO = new Set(["/", "/panel"]);

export function estaAtivo(caminho: string, href: string): boolean {
  if (SO_EXACTO.has(href)) return caminho === href;
  return caminho === href || caminho.startsWith(`${href}/`);
}

/**
 * Quantos itens cabem na largura disponivel.
 *
 * Quando nem todos cabem, e preciso reservar espaco para o botao "Mais" -
 * caso contrario o proprio botao que resolve o excesso causava excesso.
 * Devolve sempre pelo menos 0 e nunca mais do que existem.
 */
export function quantosCabem(
  larguras: number[],
  disponivel: number,
  larguraDoMais: number,
): number {
  if (larguras.length === 0) return 0;

  const total = larguras.reduce((soma, l) => soma + l, 0);
  if (total <= disponivel) return larguras.length;

  let usado = larguraDoMais;
  let cabem = 0;
  for (const largura of larguras) {
    if (usado + largura > disponivel) break;
    usado += largura;
    cabem += 1;
  }
  return cabem;
}

/**
 * Separa os itens entre os que ficam na barra e os que vao para "Mais".
 *
 * Os que saem sao os de menor prioridade, mas a ordem de leitura e
 * mantida nos dois lados: tirar do meio e reordenar o resto faz o menu
 * parecer que muda sozinho.
 */
export function separarItens(
  itens: ItemNav[],
  quantosVisiveis: number,
): { visiveis: ItemNav[]; escondidos: ItemNav[] } {
  if (quantosVisiveis >= itens.length) return { visiveis: itens, escondidos: [] };

  const aEsconder = new Set(
    [...itens]
      .sort((a, b) => a.prioridade - b.prioridade)
      .slice(0, itens.length - Math.max(0, quantosVisiveis))
      .map((i) => i.id),
  );

  return {
    visiveis: itens.filter((i) => !aEsconder.has(i.id)),
    escondidos: itens.filter((i) => aEsconder.has(i.id)),
  };
}

/** Altura da barra em pixeis: encolhe com o scroll. */
export const ALTURA_NORMAL = 70;
export const ALTURA_COMPACTA = 58;

/** A partir de quantos pixeis de scroll a barra passa a compacta. */
export const SCROLL_PARA_COMPACTAR = 12;
