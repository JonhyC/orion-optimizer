import { lerCapa } from "@/lib/repo/plan-covers";

export const runtime = "nodejs";

/**
 * Entrega das capas de planos.
 *
 * As capas vivem no Firestore e nao em disco. Antes eram escritas com
 * fs.writeFile: na Vercel o sistema de ficheiros e efemero, portanto a
 * capa desaparecia no deploy seguinte e o cartao do plano ficava vazio na
 * pagina de precos, sem nada a indicar porque.
 *
 * Sao publicas de proposito: aparecem na pagina de precos, antes de haver
 * sessao. Nao ha aqui verificacao de utilizador nenhuma.
 */

const TIPOS_PERMITIDOS = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);

const naoEncontrado = () => new Response("Not found", { status: 404 });

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ filename: string }> },
) {
  const { filename } = await params;

  // O nome vem do URL e vai parar a um caminho de documento. A lista
  // branca exclui barras, pontos e tudo o que permitisse sair da
  // coleccao das capas.
  if (!/^[A-Za-z0-9-]{10,80}$/.test(filename)) return naoEncontrado();

  try {
    const capa = await lerCapa(filename);
    if (!capa) return naoEncontrado();

    // O mime vem da base de dados; se nao for um dos que aceitamos no
    // upload, nao e servido - evita que um documento adulterado passe a
    // devolver, por exemplo, text/html.
    if (!TIPOS_PERMITIDOS.has(capa.mime)) return naoEncontrado();

    return new Response(new Uint8Array(capa.bytes), {
      headers: {
        "Content-Type": capa.mime,
        "Content-Length": String(capa.bytes.byteLength),
        // O id leva timestamp e UUID, portanto o conteudo de um dado URL
        // nunca muda: pode ficar em cache para sempre.
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (erro) {
    console.error(`[orion] falha a servir capa ${filename}:`, (erro as Error)?.message ?? erro);
    return naoEncontrado();
  }
}
