import crypto from "node:crypto";
import { firestore } from "../firebase-admin.ts";
import { COLLECTIONS, type Token, type TokenKind } from "./types.ts";

/**
 * Tokens de sessao.
 *
 * E aqui que estava o problema que motivou toda a migracao: com SQLite em
 * /tmp na Vercel, o login escrevia o token numa instancia e o pedido
 * seguinte corria noutra, que nao o encontrava. O Firestore e partilhado
 * por todas as instancias, portanto a sessao sobrevive.
 *
 * O ID DO DOCUMENTO E O PROPRIO HASH. Isto nao e detalhe: validar a
 * sessao acontece em TODAS as paginas do painel, e um `get()` por id e a
 * operacao mais barata e rapida do Firestore - nao varre indice nenhum.
 * Uma query por campo custaria mais e obrigava a um indice extra. De
 * borla, o id unico garante que nao ha dois tokens com o mesmo hash.
 *
 * O valor em claro NUNCA e guardado. So o SHA-256.
 */

export function sha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function col() {
  return firestore().collection(COLLECTIONS.tokens);
}

export function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

/**
 * Cria um token e devolve o valor em claro, que so existe neste momento.
 *
 * Ao contrario da versao SQLite, NAO apaga aqui os tokens expirados. Isso
 * era uma query mais N deletes a cada inicio de sessao - no Firestore,
 * escritas facturadas no caminho mais quente da aplicacao. A limpeza passa
 * a ser feita pela politica TTL do Firestore sobre `expires_at`, do lado
 * do servidor e sem custo. Ver DEPLOY.md.
 */
export async function createToken(
  userId: number,
  kind: TokenKind,
  ttlSeconds: number,
): Promise<{ token: string; expiresAt: number }> {
  const token = crypto.randomBytes(32).toString("hex");
  const agora = nowSeconds();
  const expiresAt = agora + ttlSeconds;

  const doc: Token = {
    token_hash: sha256(token),
    user_id: userId,
    kind,
    expires_at: expiresAt,
    created_at: agora,
    last_seen_at: agora,
  };

  await col().doc(doc.token_hash).set(doc);
  return { token, expiresAt };
}

/**
 * Le um token pelo valor em claro. Devolve null se nao existir, se for de
 * outro tipo, ou se ja tiver expirado.
 *
 * A expiracao e verificada aqui e nao so pela TTL: o Firestore apaga os
 * documentos expirados com atraso de ate 24 horas, portanto um token
 * expirado pode continuar a existir. Confiar so na TTL deixaria sessoes
 * validas para alem do prazo.
 */
export async function findToken(token: string, kind: TokenKind): Promise<Token | null> {
  const snap = await col().doc(sha256(token)).get();
  if (!snap.exists) return null;

  const dados = snap.data() as Token;
  if (dados.kind !== kind) return null;
  if (dados.expires_at <= nowSeconds()) return null;
  return dados;
}

/**
 * Marca o token como visto agora.
 *
 * Deliberadamente sem await de quem chama: serve para saber quem esta
 * online, e falhar a actualizar isso nunca pode impedir alguem de entrar.
 * Os erros sao registados e engolidos.
 */
export function touchToken(tokenHash: string): void {
  col()
    .doc(tokenHash)
    .update({ last_seen_at: nowSeconds() })
    .catch((erro: { code?: number; message?: string }) => {
      // 5 = NOT_FOUND. Acontece quando o token e revogado entre a leitura
      // e esta actualizacao - um logout a meio de outro pedido. E o
      // resultado correcto, nao um erro digno de registo.
      if (erro?.code === 5) return;
      console.error("[orion] falha a actualizar last_seen_at do token:", erro?.message ?? erro);
    });
}

export async function revokeToken(token: string): Promise<void> {
  await col().doc(sha256(token)).delete();
}

/** Revoga tudo do utilizador: ao suspender a conta ou mudar a password. */
export async function revokeAllTokens(userId: number): Promise<number> {
  return apagarPorQuery(col().where("user_id", "==", userId));
}

/** Corta apenas o cliente Windows; a sessao do site continua de pe. */
export async function revokeClientTokens(userId: number): Promise<number> {
  return apagarPorQuery(col().where("user_id", "==", userId).where("kind", "==", "api"));
}

/**
 * Apaga em lotes de 400.
 *
 * O limite do Firestore por lote e 500 escritas; 400 deixa margem e evita
 * ter de lidar com o erro quando alguem tem muitos tokens acumulados.
 */
async function apagarPorQuery(query: FirebaseFirestore.Query): Promise<number> {
  const db = firestore();
  let total = 0;

  while (true) {
    const snap = await query.limit(400).get();
    if (snap.empty) break;

    const lote = db.batch();
    for (const doc of snap.docs) lote.delete(doc.ref);
    await lote.commit();
    total += snap.size;

    if (snap.size < 400) break;
  }
  return total;
}

/**
 * Quem tem token vivo visto na janela dada. Usado pelo painel para
 * mostrar quem esta online, no site e no optimizador.
 */
export async function activeUserIds(kind: TokenKind, desde: number): Promise<Set<number>> {
  const snap = await col()
    .where("kind", "==", kind)
    .where("expires_at", ">", nowSeconds())
    .get();

  const ids = new Set<number>();
  for (const doc of snap.docs) {
    const t = doc.data() as Token;
    if ((t.last_seen_at ?? 0) >= desde) ids.add(t.user_id);
  }
  return ids;
}

/**
 * Remove tokens expirados. A TTL do Firestore ja faz isto sozinha; esta
 * funcao existe para o script de manutencao e para ambientes onde a TTL
 * nao esteja activa - o plano Spark pode nao a ter.
 */
export async function purgeExpired(): Promise<number> {
  return apagarPorQuery(col().where("expires_at", "<=", nowSeconds()));
}
