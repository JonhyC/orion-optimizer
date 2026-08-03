import crypto from "node:crypto";
import { firestore } from "../firebase-admin.ts";

/**
 * Capas dos planos, guardadas no Firestore.
 *
 * Antes iam para o disco com fs.writeFile. Na Vercel esse disco e
 * efemero: a capa desaparecia no deploy seguinte e a pagina de precos
 * ficava com o cartao vazio, sem nada a indicar porque.
 *
 * LIMITE: um documento do Firestore nao pode passar de 1 MiB, e o base64
 * cresce cerca de 33% sobre os bytes originais. Sobra pouco mais de
 * 700 KB de imagem real - dai o MAX_BYTES abaixo. O editor ja reencoda a
 * capa para webp antes de a enviar, o que a deixa tipicamente na ordem
 * das dezenas de KB; o limite existe para o caso de alguem contornar o
 * recorte.
 *
 * Cada capa e um documento SEU, nunca um campo do plano: listar os planos
 * na pagina de precos passaria a arrastar as imagens todas atras.
 *
 * O Firebase Storage seria o sitio natural para ficheiros, mas exige o
 * plano Blaze. Enquanto o projecto estiver no Spark, e aqui.
 */

const COLECCAO = "plan_covers";

/** ~700 KB. Acima disto o documento nao cabe depois de codificado. */
export const MAX_BYTES = 700 * 1024;

export type Capa = {
  data: string;
  mime: string;
  size: number;
  created_at: number;
};

const col = () => firestore().collection(COLECCAO);

/**
 * Grava uma capa e devolve o id do documento.
 *
 * O id leva timestamp e UUID para que o URL de uma capa nunca mude de
 * conteudo - e o que permite servi-la com cache eterna.
 */
export async function guardarCapa(bytes: Buffer, mime: string): Promise<string> {
  const id = `${Date.now()}-${crypto.randomUUID()}`;
  const capa: Capa = {
    data: bytes.toString("base64"),
    mime,
    size: bytes.byteLength,
    created_at: Math.floor(Date.now() / 1000),
  };
  await col().doc(id).set(capa);
  return id;
}

export async function lerCapa(id: string): Promise<{ bytes: Buffer; mime: string } | null> {
  const snap = await col().doc(id).get();
  if (!snap.exists) return null;
  const capa = snap.data() as Capa;
  return { bytes: Buffer.from(capa.data, "base64"), mime: capa.mime };
}

export async function apagarCapa(id: string): Promise<void> {
  await col().doc(id).delete();
}

/**
 * Extrai o id do documento a partir do URL guardado no plano.
 *
 * Devolve null para qualquer coisa que nao siga o formato esperado - o
 * valor vem da base de dados e vai parar a um caminho de documento.
 */
export function idDoUrl(coverUrl: string | null): string | null {
  if (!coverUrl) return null;
  const m = /^\/uploads\/plans\/([A-Za-z0-9-]+)$/.exec(coverUrl);
  return m ? m[1] : null;
}
