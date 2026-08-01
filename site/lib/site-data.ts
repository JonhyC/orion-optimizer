import { getDb, nowSeconds } from "./db.ts";

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

export function publishedReviews(limit = 12): PublicReview[] {
  const rows = getDb()
    .prepare(
      `SELECT id, author_name, handle, rig, gain, rating, body
       FROM reviews WHERE approved = 1
       ORDER BY created_at DESC LIMIT ?`,
    )
    .all(limit) as PublicReview[];

  return rows.map((row) => ({ ...row }));
}

export type PublicStats = {
  clients: number;
  optimizedPCs: number;
  reviewCount: number;
  averageRating: number | null;
  /** true enquanto os numeros nao provarem nada. Ver a regra em publicStats. */
  empty: boolean;
};

export function publicStats(): PublicStats {
  const db = getDb();

  const clients = (
    db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'client'").get() as { n: number }
  ).n;

  // "PCs optimizados" = licencas que chegaram a ligar-se a uma maquina.
  // Contar encomendas seria inflacionar: uma renovacao nao e um PC novo.
  const optimizedPCs = (
    db
      .prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'client' AND hwid IS NOT NULL")
      .get() as { n: number }
  ).n;

  const r = db
    .prepare("SELECT COUNT(*) AS n, AVG(rating) AS avg FROM reviews WHERE approved = 1")
    .get() as { n: number; avg: number | null };

  // Uma conta registada nao prova nada - e um formulario preenchido. So ha
  // prova quando alguem chegou a ligar uma maquina ou deixou avaliacao.
  // Sem isso a seccao mostra as garantias: "0 PCs optimizados" em destaque
  // e pior do que nao mostrar numero nenhum.
  const hasProof = optimizedPCs > 0 || r.n > 0;

  return {
    clients,
    optimizedPCs,
    reviewCount: r.n,
    averageRating: r.avg,
    empty: !hasProof,
  };
}

// Os planos passaram para lib/plans.ts, que ja sabe ler do Firestore.
// Reexportados daqui para os imports existentes continuarem validos.
export { activePlans } from "./plans.ts";
export type { PublicPlan } from "./plans.ts";

export function nowTs(): number {
  return nowSeconds();
}
