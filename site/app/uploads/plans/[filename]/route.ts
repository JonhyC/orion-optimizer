import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { planCoversDir } from "@/lib/storage-paths";

export const runtime = "nodejs";

/**
 * Entrega das capas de planos.
 *
 * As capas vivem no volume, fora de public/, porque ficheiros escritos em
 * public/ desaparecem no deploy seguinte - o contentor e reconstruido a
 * partir do repositorio e as capas nunca passam pelo git. Como saem de
 * public/, o Next deixa de as servir sozinho, e e esta rota que o faz.
 *
 * Le o ficheiro para memoria em vez de o transmitir em stream: o upload
 * esta limitado a 5 MB, portanto nao vale a pena o risco de gerir um
 * corpo em stream por uns quilobytes de RAM.
 *
 * Sao publicas de proposito: aparecem na pagina de precos, antes de haver
 * sessao. Nao ha aqui verificacao de utilizador nenhuma.
 */

const CONTENT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".avif": "image/avif",
};

const notFound = () => new Response("Not found", { status: 404 });

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ filename: string }> },
) {
  const { filename } = await params;

  // O nome vem do URL. Sem esta barreira, "..%2F..%2Forion.sqlite" servia
  // a base de dados inteira, com hashes de password la dentro. A lista
  // branca exclui barras e pontos consecutivos; o resolve() abaixo e a
  // segunda linha de defesa.
  if (!/^[a-zA-Z0-9_-]+\.[a-zA-Z0-9]+$/.test(filename)) return notFound();

  const type = CONTENT_TYPES[path.extname(filename).toLowerCase()];
  if (!type) return notFound();

  const full = path.resolve(planCoversDir, filename);
  if (path.dirname(full) !== path.resolve(planCoversDir)) return notFound();

  try {
    const info = await stat(full);
    if (!info.isFile()) return notFound();

    const bytes = await readFile(full);
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": type,
        "Content-Length": String(info.size),
        "Last-Modified": info.mtime.toUTCString(),
        // O nome leva timestamp e UUID, portanto o conteudo de um dado URL
        // nunca muda: pode ficar em cache para sempre.
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== "ENOENT" && code !== "ENOTDIR") {
      console.error(`[orion] falha a servir capa ${filename}:`, error);
    }
    return notFound();
  }
}
