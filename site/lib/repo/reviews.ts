import { firestore } from "../firebase-admin.ts";
import { cached, invalidateCache } from "../cache.ts";
import { allocateId } from "./ids.ts";
import { COLLECTIONS, type Review } from "./types.ts";

/**
 * Avaliacoes.
 *
 * Sao poucas e mudam raramente, mas a pagina inicial le as aprovadas em
 * cada visita. Por isso `allReviews()` traz a coleccao inteira e quem
 * precisa de filtrar fa-lo em memoria - sai mais barato do que duas
 * queries com indices diferentes, e a lista cabe folgadamente numa
 * resposta.
 */

function col() {
  return firestore().collection(COLLECTIONS.reviews);
}

/** Booleanos do Firestore voltam a 0/1: a interface compara com === 1. */
function flag(v: unknown): number {
  return v === true || v === 1 ? 1 : 0;
}

function doDocumento(dados: Record<string, unknown>, id: number): Review {
  return {
    id,
    user_id: (dados.user_id as number | null) ?? null,
    author_name: String(dados.author_name ?? ""),
    handle: (dados.handle as string | null) ?? null,
    rig: (dados.rig as string | null) ?? null,
    gain: (dados.gain as string | null) ?? null,
    rating: Number(dados.rating ?? 5),
    body: String(dados.body ?? ""),
    approved: flag(dados.approved),
    created_at: Number(dados.created_at ?? 0),
  };
}

export async function allReviews(): Promise<Review[]> {
  return cached("reviews:all", 10_000, async () => {
    const snap = await col().get();
    const lista = snap.docs.map((d) => doDocumento(d.data(), Number(d.id)));
    // Mesma ordem que o SQLite dava: por aprovar primeiro, depois as mais
    // recentes. O painel conta com isso para separar as duas listas.
    lista.sort(
      (a, b) => a.approved - b.approved || b.created_at - a.created_at,
    );
    return lista;
  });
}

/** Aprovadas, mais recentes primeiro. Para a pagina publica. */
export async function approvedReviews(limite?: number): Promise<Review[]> {
  const aprovadas = (await allReviews())
    .filter((r) => r.approved === 1)
    .sort((a, b) => b.created_at - a.created_at);
  return limite ? aprovadas.slice(0, limite) : aprovadas;
}

export async function reviewStats(): Promise<{ count: number; avg: number }> {
  const aprovadas = await approvedReviews();
  if (!aprovadas.length) return { count: 0, avg: 0 };
  const soma = aprovadas.reduce((t, r) => t + r.rating, 0);
  return { count: aprovadas.length, avg: soma / aprovadas.length };
}

export async function createReview(dados: Omit<Partial<Review>, "id">): Promise<Review> {
  const id = await allocateId(COLLECTIONS.reviews);
  const review = doDocumento(dados as Record<string, unknown>, id);
  await col().doc(String(id)).set(review);
  invalidateCache("reviews:");
  return review;
}

export async function setReviewApproved(id: number, approved: boolean): Promise<void> {
  await col().doc(String(id)).set({ approved: approved ? 1 : 0 }, { merge: true });
  invalidateCache("reviews:");
}

export async function deleteReview(id: number): Promise<void> {
  await col().doc(String(id)).delete();
  invalidateCache("reviews:");
}
