import { firestore } from "../firebase-admin.ts";
import { COLLECTIONS, type AuditEntry, type LoginAttempt } from "./types.ts";

/**
 * Auditoria e tentativas de login.
 *
 * As duas coleccoes so crescem e nunca sao lidas por id, portanto usam os
 * ids automaticos do Firestore em vez do contador numerico. Poupa uma
 * transaccao por escrita - e a auditoria escreve em quase todas as accoes.
 */

const agora = () => Math.floor(Date.now() / 1000);

// ------------------------------------------------------------- auditoria

/**
 * Regista uma accao.
 *
 * NAO devolve promessa e nunca rebenta: a auditoria e um registo lateral e
 * falhar a escrever nao pode impedir a accao que a originou. No SQLite era
 * sincrona e gratuita; aqui e uma escrita de rede, e obrigar cada chamador
 * a esperar por ela somava latencia a operacoes que nao dependem dela.
 *
 * Quem precisar de garantir que ficou registado usa `auditAndWait`.
 */
export function audit(
  userId: number | null,
  action: string,
  detail?: string | null,
  ip?: string | null,
): void {
  auditAndWait(userId, action, detail, ip).catch((erro) => {
    console.error(`[orion] falha a registar auditoria (${action}):`, erro?.message ?? erro);
  });
}

export async function auditAndWait(
  userId: number | null,
  action: string,
  detail?: string | null,
  ip?: string | null,
): Promise<void> {
  const entrada: AuditEntry = {
    user_id: userId,
    action,
    detail: detail ?? null,
    ip: ip ?? null,
    created_at: agora(),
  };
  await firestore().collection(COLLECTIONS.audit).add(entrada);
}

export async function recentAudit(limite = 50): Promise<AuditEntry[]> {
  const snap = await firestore()
    .collection(COLLECTIONS.audit)
    .orderBy("created_at", "desc")
    .limit(limite)
    .get();
  return snap.docs.map((d) => d.data() as AuditEntry);
}

export async function auditForUser(userId: number, limite = 20): Promise<AuditEntry[]> {
  const snap = await firestore()
    .collection(COLLECTIONS.audit)
    .where("user_id", "==", userId)
    .orderBy("created_at", "desc")
    .limit(limite)
    .get();
  return snap.docs.map((d) => d.data() as AuditEntry);
}

/**
 * Ultima vez que um utilizador fez uma accao concreta.
 *
 * Usado para arrefecimentos - por exemplo, so deixar trocar de computador
 * uma vez por dia. Precisa do indice composto (user_id, created_at) que
 * esta declarado em firestore.indexes.json.
 */
export async function lastAuditFor(
  userId: number,
  action: string,
): Promise<AuditEntry | null> {
  const snap = await firestore()
    .collection(COLLECTIONS.audit)
    .where("user_id", "==", userId)
    .where("action", "==", action)
    .orderBy("created_at", "desc")
    .limit(1)
    .get();

  return snap.empty ? null : (snap.docs[0].data() as AuditEntry);
}

/** Quantas vezes cada accao ocorreu desde `desde`. Para o painel. */
export async function auditCountsSince(desde: number): Promise<Record<string, number>> {
  const snap = await firestore()
    .collection(COLLECTIONS.audit)
    .where("created_at", ">=", desde)
    .get();

  const contagem: Record<string, number> = {};
  for (const doc of snap.docs) {
    const a = (doc.data() as AuditEntry).action;
    contagem[a] = (contagem[a] ?? 0) + 1;
  }
  return contagem;
}

// -------------------------------------------------- tentativas de login

/**
 * Conta falhas recentes do mesmo utilizador e IP.
 *
 * Usa aggregation query: devolve so o numero, sem trazer os documentos.
 * O Firestore cobra isto a uma leitura por cada 1000 documentos varridos,
 * em vez de uma por documento - e esta verificacao corre em CADA tentativa
 * de login.
 */
export async function countRecentFailures(
  username: string,
  ip: string,
  desde: number,
): Promise<number> {
  const snap = await firestore()
    .collection(COLLECTIONS.attempts)
    .where("username", "==", username)
    .where("ip", "==", ip)
    .where("success", "==", 0)
    .where("created_at", ">", desde)
    .count()
    .get();
  return snap.data().count;
}

/**
 * Ultimo login com sucesso e total de falhas de um utilizador.
 *
 * O painel de administracao mostra isto na ficha de cada conta. Substitui
 * o MAX(CASE WHEN...) / SUM(CASE WHEN...) que o SQLite fazia numa query:
 * o Firestore nao tem agregacoes condicionais, portanto le-se as
 * tentativas do utilizador e percorre-se em memoria.
 *
 * As tentativas antigas sao apagadas por purgeAttemptsBefore, portanto
 * este conjunto mantem-se pequeno.
 */
export async function loginStatsFor(
  username: string,
): Promise<{ last_success: number | null; failed_total: number }> {
  const snap = await firestore()
    .collection(COLLECTIONS.attempts)
    .where("username", "==", username)
    .get();

  let last_success: number | null = null;
  let failed_total = 0;

  for (const doc of snap.docs) {
    const a = doc.data() as LoginAttempt;
    if (a.success === 1) {
      if (last_success === null || a.created_at > last_success) last_success = a.created_at;
    } else {
      failed_total++;
    }
  }
  return { last_success, failed_total };
}

export async function recordAttempt(
  username: string,
  ip: string,
  success: boolean,
): Promise<void> {
  const tentativa: LoginAttempt = {
    username,
    ip,
    success: success ? 1 : 0,
    created_at: agora(),
  };
  await firestore().collection(COLLECTIONS.attempts).add(tentativa);

  // Entrar com sucesso limpa o historico de falhas, como no SQLite: senao
  // quem errou quatro vezes e acertou a quinta continuava a um passo do
  // bloqueio.
  if (success) await clearFailures(username, ip);
}

export async function clearFailures(username: string, ip: string): Promise<number> {
  const db = firestore();
  const query = db
    .collection(COLLECTIONS.attempts)
    .where("username", "==", username)
    .where("ip", "==", ip)
    .where("success", "==", 0);

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
 * Apaga tentativas antigas. So servem para a janela de bloqueio; guardar
 * mais do que isso e pagar armazenamento por dados sem utilidade.
 */
export async function purgeAttemptsBefore(limite: number): Promise<number> {
  const db = firestore();
  const query = db.collection(COLLECTIONS.attempts).where("created_at", "<", limite);

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
