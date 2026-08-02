import { approvedReviews, reviewStats } from "./repo/reviews.ts";
import { countClients } from "./repo/users.ts";

/**
 * Dados publicos do site, lidos da base de dados.
 *
 * Nada aqui e inventado. Quando ainda nao ha vendas nem avaliacoes, as
 * funcoes devolvem zero e vazio - e as seccoes do site mostram um estado
 * honesto em vez de numeros de enfeite.
 */

export type PublicReview = {
  id: number;
  author_name: string;
  handle: string | null;
  rig: string | null;
  gain: string | null;
  rating: number;
  body: string;
};

/**
 * Executa uma leitura publica sem deixar que uma falha derrube a pagina.
 *
 * A pagina inicial e publica e nao depende destes numeros para existir. Um
 * problema de rede momentaneo ate ao Firestore - basta um `14 UNAVAILABLE`
 * do gRPC - fazia o Next devolver 500 e o site inteiro ficava em branco.
 *
 * Falhar em silencio nao seria melhor: o erro e registado. O que muda e
 * que a seccao afectada mostra o estado vazio, que ja existe e e honesto,
 * em vez de levar tudo atras.
 */
async function tolerante<T>(nome: string, ler: () => Promise<T>, aoFalhar: T): Promise<T> {
  try {
    return await ler();
  } catch (erro) {
    console.error(`[orion] ${nome} indisponivel:`, (erro as Error)?.message ?? erro);
    return aoFalhar;
  }
}

export async function publishedReviews(limit = 12): Promise<PublicReview[]> {
  const aprovadas = await tolerante("avaliacoes", () => approvedReviews(limit), []);
  // So os campos que a pagina publica mostra: nao expor user_id nem o
  // estado de aprovacao a quem nao esta autenticado.
  return aprovadas.map((r) => ({
    id: r.id,
    author_name: r.author_name,
    handle: r.handle,
    rig: r.rig,
    gain: r.gain,
    rating: r.rating,
    body: r.body,
  }));
}

export type PublicStats = {
  clients: number;
  optimizedPCs: number;
  reviewCount: number;
  averageRating: number | null;
  /** true enquanto os numeros nao provarem nada. Ver a regra em publicStats. */
  empty: boolean;
};

export async function publicStats(): Promise<PublicStats> {
  // Independentes: em paralelo poupa uma ida ao Firestore. Cada uma cai
  // para zero por si - uma falha nas avaliacoes nao deve esconder o
  // numero de clientes, nem o contrario.
  const [clientes, avaliacoes] = await Promise.all([
    tolerante("contagem de clientes", countClients, { total: 0, comMaquina: 0 }),
    tolerante("estatisticas de avaliacoes", reviewStats, { count: 0, avg: 0 }),
  ]);

  // Uma conta registada nao prova nada - e um formulario preenchido. So ha
  // prova quando alguem chegou a ligar uma maquina ou deixou avaliacao.
  // Sem isso a seccao mostra as garantias: "0 PCs optimizados" em destaque
  // e pior do que nao mostrar numero nenhum.
  const hasProof = clientes.comMaquina > 0 || avaliacoes.count > 0;

  return {
    clients: clientes.total,
    optimizedPCs: clientes.comMaquina,
    reviewCount: avaliacoes.count,
    averageRating: avaliacoes.count > 0 ? avaliacoes.avg : null,
    empty: !hasProof,
  };
}

// Os planos passaram para lib/plans.ts, que ja sabe ler do Firestore.
// Reexportados daqui para os imports existentes continuarem validos.
export { activePlans } from "./plans.ts";
export type { PublicPlan } from "./plans.ts";

export function nowTs(): number {
  return Math.floor(Date.now() / 1000);
}
