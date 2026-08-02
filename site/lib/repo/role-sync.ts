import { firestore } from "../firebase-admin.ts";
import { COLLECTIONS, type DiscordRoleSync } from "./types.ts";

/**
 * Fila de sincronizacao de cargos do Discord.
 *
 * O id do documento e o user_id, como no SQLite onde era a chave primaria.
 * Isso da o comportamento de "uma entrada por utilizador" de graca: uma
 * alteracao nova substitui a tentativa antiga em vez de acumular filas
 * para a mesma pessoa.
 */

function col() {
  return firestore().collection(COLLECTIONS.roleSync);
}

const agora = () => Math.floor(Date.now() / 1000);

/**
 * Regista o estado desejado. Substitui o que la estiver e poe as
 * tentativas a zero - e um pedido novo, nao a continuacao do antigo.
 *
 * O remove_role_id anterior e preservado quando o novo vier vazio: era o
 * COALESCE do ON CONFLICT no SQLite. Sem isso, um cargo que ficou por
 * remover era esquecido a meio da fila.
 */
export async function queueRoleSync(params: {
  userId: number;
  tier: string | null;
  reason: string;
  removeRoleId?: string | null;
}): Promise<void> {
  const ref = col().doc(String(params.userId));

  await firestore().runTransaction(async (tx) => {
    const anterior = await tx.get(ref);
    const removeAnterior = anterior.exists
      ? ((anterior.data() as DiscordRoleSync).remove_role_id ?? null)
      : null;

    const entrada: DiscordRoleSync = {
      user_id: params.userId,
      tier: params.tier,
      reason: params.reason,
      attempts: 0,
      last_error: null,
      remove_role_id: params.removeRoleId ?? removeAnterior,
      updated_at: agora(),
    };
    tx.set(ref, entrada);
  });
}

/** Pendentes, os mais antigos primeiro. */
export async function pendingRoleSyncs(limite = 25): Promise<DiscordRoleSync[]> {
  const snap = await col().orderBy("updated_at", "asc").limit(limite).get();
  return snap.docs.map((d) => d.data() as DiscordRoleSync);
}

export async function countPendingRoleSyncs(): Promise<number> {
  const snap = await col().count().get();
  return snap.data().count;
}

export async function clearRoleSync(userId: number): Promise<void> {
  await col().doc(String(userId)).delete();
}

/**
 * Regista que a tentativa falhou.
 *
 * O contador de tentativas serve para espacar as repeticoes: quem chama
 * calcula o atraso a partir dele. Incrementar aqui e nao la fora evita
 * duas leituras do mesmo documento.
 */
export async function recordRoleSyncFailure(userId: number, erro: string): Promise<void> {
  const ref = col().doc(String(userId));

  await firestore().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return;
    const atual = snap.data() as DiscordRoleSync;
    tx.update(ref, {
      attempts: (atual.attempts ?? 0) + 1,
      last_error: erro.slice(0, 500),
      updated_at: agora(),
    });
  });
}
