import { cached } from "./cache.ts";

/**
 * IsThereAnyDeal - comparacao de precos entre lojas.
 *
 * Existe porque o bloco `loja` dos plugins tinha precos escritos a mao no
 * manifesto. Um preco fixo fica errado em dias e nao ha forma de dizer
 * "o mais barato" sem consultar as lojas.
 *
 * TERMOS DE SERVICO do ITAD que o codigo tem de respeitar, e respeita:
 *
 *   - Os dados NAO podem ser alterados. Os URLs sao passados tal e qual,
 *     incluindo etiquetas de afiliado, e os precos vao como vem. E por
 *     isso que nada aqui reformata valores nem reescreve links.
 *   - A fonte tem de ser mencionada. Quem mostra estes dados na interface
 *     tem de dizer que vem do IsThereAnyDeal.
 *   - Ha limite de pedidos: 1000 por janela de 5 minutos. Dai a cache
 *     abaixo ser longa e as buscas serem feitas em lote.
 *
 * A chave vive em ITAD_API_KEY. Sem ela nada disto funciona, e as funcoes
 * devolvem null em vez de rebentar - o bloco da loja mostra entao um
 * aviso de que a comparacao nao esta configurada.
 */

const BASE = "https://api.isthereanydeal.com";

export type Oferta = {
  titulo: string;
  loja: string;
  /** Como vem do ITAD. Nao reformatar. */
  preco: number;
  moeda: string;
  /** Desconto em percentagem. */
  desconto: number;
  /** URL da loja, tal e qual. Nao alterar. */
  url: string;
  /** Minimo historico, para se ver se vale a pena esperar. */
  minimoHistorico: number | null;
};

function chave(): string | null {
  return process.env.ITAD_API_KEY?.trim() || null;
}

export function itadConfigurado(): boolean {
  return chave() !== null;
}

async function pedir<T>(caminho: string, init: RequestInit, params: Record<string, string> = {}): Promise<T | null> {
  const k = chave();
  if (!k) return null;

  const url = new URL(`${BASE}${caminho}`);
  for (const [nome, valor] of Object.entries(params)) url.searchParams.set(nome, valor);

  try {
    const resposta = await fetch(url, {
      ...init,
      headers: { "Content-Type": "application/json", "ITAD-API-Key": k, ...(init.headers ?? {}) },
    });
    // 429 e o limite de pedidos. Nao insistimos: a cache serve a proxima
    // chamada e insistir so agrava o limite.
    if (!resposta.ok) {
      console.error(`[orion] ITAD ${caminho} respondeu ${resposta.status}`);
      return null;
    }
    return (await resposta.json()) as T;
  } catch (erro) {
    console.error(`[orion] ITAD ${caminho} falhou:`, (erro as Error)?.message ?? erro);
    return null;
  }
}

/** Titulos -> ids do ITAD. Um pedido para a lista toda, nao um por titulo. */
async function idsPorTitulo(titulos: string[]): Promise<Record<string, string | null> | null> {
  return pedir<Record<string, string | null>>("/lookup/id/title/v1", {
    method: "POST",
    body: JSON.stringify(titulos),
  });
}

type PrecoITAD = {
  id: string;
  historyLow?: { all?: { amount: number } | null } | null;
  deals?: Array<{
    shop: { name: string };
    price: { amount: number; currency: string };
    cut: number;
    url: string;
  }>;
};

/**
 * A oferta mais barata de cada titulo.
 *
 * `country` importa: os precos e as lojas disponiveis mudam por pais, e
 * mostrar precos dos Estados Unidos a quem compra em Portugal seria dar
 * um numero que nao se paga.
 *
 * Cache de 30 minutos. Os precos mudam ao longo do dia, mas nao ao
 * minuto, e o limite de pedidos do ITAD nao admite consultar a cada
 * abertura da aba.
 */
export async function ofertasMaisBaratas(titulos: string[], country = "PT"): Promise<Oferta[] | null> {
  if (!itadConfigurado() || titulos.length === 0) return null;

  const chaveCache = `itad:${country}:${titulos.slice().sort().join("|")}`;
  return cached(chaveCache, 30 * 60 * 1000, async () => {
    const ids = await idsPorTitulo(titulos);
    if (!ids) return null;

    // O ITAD aceita no maximo 200 ids por pedido; a lista de um plugin
    // nunca chega la, mas o corte evita um 400 se algum dia chegar.
    const encontrados = Object.entries(ids).filter(([, id]) => id) as Array<[string, string]>;
    if (encontrados.length === 0) return [];

    const precos = await pedir<PrecoITAD[]>(
      "/games/prices/v3",
      { method: "POST", body: JSON.stringify(encontrados.slice(0, 200).map(([, id]) => id)) },
      { country, deals: "true" },
    );
    if (!precos) return null;

    const porId = new Map(precos.map((p) => [p.id, p]));
    const ofertas: Oferta[] = [];

    for (const [titulo, id] of encontrados) {
      const registo = porId.get(id);
      const negocios = registo?.deals ?? [];
      if (negocios.length === 0) continue;

      // O mais barato. O ITAD nao garante ordem, portanto ordena-se aqui.
      const melhor = negocios.reduce((a, b) => (b.price.amount < a.price.amount ? b : a));
      ofertas.push({
        titulo,
        loja: melhor.shop.name,
        preco: melhor.price.amount,
        moeda: melhor.price.currency,
        desconto: melhor.cut,
        url: melhor.url,
        minimoHistorico: registo?.historyLow?.all?.amount ?? null,
      });
    }

    return ofertas.sort((a, b) => a.preco - b.preco);
  });
}
