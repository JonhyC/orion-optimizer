import { bearerToken, userFromToken } from "@/lib/auth";
import { itadConfigurado, ofertasMaisBaratas } from "@/lib/itad";
import { fail, ok } from "../../_lib/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Precos comparados, para o bloco `loja` dos plugins.
 *
 * A chamada ao IsThereAnyDeal e feita AQUI e nao na aplicacao por duas
 * razoes: a chave de API nao pode viajar para o cliente, e a cache do
 * servidor e partilhada por todos - com a cache no cliente, cada
 * instalacao gastava a sua parte do limite de pedidos.
 */

/** Limite por pedido. Uma lista de plugin nao chega la; existe como travao. */
const MAX_TITULOS = 60;

export async function POST(req: Request) {
  const actor = await userFromToken(bearerToken(req));
  if (!actor) return fail("Sessao invalida ou expirada.", 401, "invalid_token");

  if (!itadConfigurado()) {
    return fail(
      "A comparacao de precos nao esta configurada neste servidor.",
      503,
      "itad_off",
    );
  }

  const corpo = (await req.json().catch(() => null)) as { titles?: unknown; country?: unknown } | null;
  const titulos = Array.isArray(corpo?.titles)
    ? corpo.titles.map((t) => String(t).trim()).filter(Boolean).slice(0, MAX_TITULOS)
    : [];
  if (titulos.length === 0) return fail("Envia uma lista de titulos.", 400, "bad_request");

  // Duas letras, maiusculas. O ITAD recusa qualquer outra coisa, e sem
  // isto um valor vindo do cliente ia parar directo ao pedido externo.
  const paisBruto = String(corpo?.country ?? "PT").toUpperCase();
  const country = /^[A-Z]{2}$/.test(paisBruto) ? paisBruto : "PT";

  const ofertas = await ofertasMaisBaratas(titulos, country);
  if (!ofertas) {
    return fail("Nao foi possivel obter precos neste momento.", 502, "itad_unavailable");
  }

  return ok({
    deals: ofertas,
    // Os termos do ITAD obrigam a mencionar a fonte. A aplicacao mostra
    // este texto junto aos precos.
    source: "Preços via IsThereAnyDeal",
    sourceUrl: "https://isthereanydeal.com",
  });
}
