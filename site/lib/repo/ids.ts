import { firestore } from "../firebase-admin.ts";

/**
 * Ids numericos sequenciais.
 *
 * O Firestore nao tem auto-incremento - gera ids em texto, aleatorios. Mas o
 * User.id do Orion e `number` e atravessa tudo: orders.user_id,
 * audit_log.user_id, a API do cliente Windows, os links do painel. Trocar
 * para texto obrigava a mexer em todo o lado e quebrava o contrato das
 * respostas de API.
 *
 * Por isso mantem-se numerico, com um contador por coleccao em
 * `counters/{coleccao}`, incrementado dentro de uma transaccao. Duas
 * criacoes simultaneas nunca recebem o mesmo numero: a transaccao do
 * Firestore volta a tentar sozinha se o documento mudou entretanto.
 *
 * O contador NAO e a fonte de verdade sobre que ids existem - e so o
 * proximo numero livre. Se desaparecer, `seedCounter` reconstroi-o a
 * partir do maior id que estiver na coleccao, o que torna a migracao
 * repetivel sem duplicar registos.
 */

const COUNTERS = "counters";

/**
 * O contador de cada coleccao e UM documento, e o Firestore aguenta cerca
 * de uma escrita por segundo sustentada em cada documento. Criacoes
 * simultaneas disputam-no e as transaccoes chegam a expirar o bloqueio.
 *
 * Para o Orion isto nao aperta: registos sao raros e chegam espacados. Mas
 * quando duas coincidem, a pessoa nao pode ver um erro - por isso ha nova
 * tentativa com espera crescente e aleatoria. O aleatorio importa: sem ele
 * duas tentativas rejeitadas voltariam a colidir exactamente ao mesmo
 * tempo, indefinidamente.
 *
 * Se um dia os registos passarem a ser muitos por segundo, a saida e
 * distribuir o contador por varios documentos (sharding) e somar. Fica
 * anotado; agora seria complexidade sem proveito.
 */
const TENTATIVAS = 5;

async function comNovaTentativa<T>(operacao: () => Promise<T>): Promise<T> {
  let ultimoErro: unknown;

  for (let tentativa = 0; tentativa < TENTATIVAS; tentativa++) {
    try {
      return await operacao();
    } catch (erro) {
      ultimoErro = erro;
      const codigo = (erro as { code?: number }).code;
      // 10 = ABORTED (conflito ou bloqueio expirado). Qualquer outro erro
      // nao ganha nada em ser repetido.
      if (codigo !== 10) throw erro;
      const espera = 40 * 2 ** tentativa + Math.floor(Math.random() * 60);
      await new Promise((r) => setTimeout(r, espera));
    }
  }
  throw ultimoErro;
}

/** Aloca o proximo id livre da coleccao. Transaccional. */
export async function allocateId(collection: string): Promise<number> {
  const db = firestore();
  const ref = db.collection(COUNTERS).doc(collection);

  return comNovaTentativa(() =>
    db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const atual = snap.exists ? Number(snap.data()?.next ?? 0) : 0;
      // Sem contador ainda: descobrir onde a coleccao vai, para nao
      // reutilizar um id de um documento que ja exista.
      const proximo = atual > 0 ? atual : (await maiorIdExistente(collection)) + 1;
      tx.set(ref, { next: proximo + 1 }, { merge: true });
      return proximo;
    }),
  );
}

/**
 * Aloca varios ids de uma vez. A migracao escreve centenas de documentos;
 * uma transaccao por cada um seria lenta e desnecessaria.
 */
export async function allocateIds(collection: string, quantos: number): Promise<number[]> {
  if (quantos <= 0) return [];
  const db = firestore();
  const ref = db.collection(COUNTERS).doc(collection);

  const primeiro = await comNovaTentativa(() =>
    db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const atual = snap.exists ? Number(snap.data()?.next ?? 0) : 0;
      const inicio = atual > 0 ? atual : (await maiorIdExistente(collection)) + 1;
      tx.set(ref, { next: inicio + quantos }, { merge: true });
      return inicio;
    }),
  );

  return Array.from({ length: quantos }, (_, i) => primeiro + i);
}

/**
 * Poe o contador acima de um id conhecido.
 *
 * A migracao preserva os ids do SQLite em vez de gerar novos, portanto o
 * contador tem de acabar acima do maior deles - senao a primeira conta
 * criada depois da migracao ia escrever por cima de uma existente.
 *
 * Nunca desce: chamar isto com um id menor nao tem efeito. E o que torna a
 * migracao segura de repetir.
 */
export async function ensureCounterAbove(collection: string, id: number): Promise<void> {
  const db = firestore();
  const ref = db.collection(COUNTERS).doc(collection);

  await comNovaTentativa(() =>
    db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const atual = snap.exists ? Number(snap.data()?.next ?? 0) : 0;
      if (atual > id) return;
      tx.set(ref, { next: id + 1 }, { merge: true });
    }),
  );
}

/**
 * Maior id ja usado numa coleccao.
 *
 * Ordena pelo CAMPO `id` e nao pelo id do documento: o Firestore recusa
 * varrer ids de documento por ordem descendente ("does not support
 * descending key scans"). Como todos os documentos com id numerico
 * guardam esse numero tambem num campo, ordenar por ele resolve - e usa o
 * indice de campo unico que o Firestore cria sozinho.
 *
 * Zero quando a coleccao esta vazia ou nao usa ids numericos.
 */
async function maiorIdExistente(collection: string): Promise<number> {
  try {
    const snap = await firestore()
      .collection(collection)
      .orderBy("id", "desc")
      .limit(1)
      .get();

    if (snap.empty) return 0;
    const n = Number(snap.docs[0].get("id"));
    return Number.isFinite(n) ? n : 0;
  } catch (erro) {
    // Coleccao sem campo `id` nenhum: nao ha sequencia a continuar.
    console.error(`[orion] nao foi possivel ler o maior id de ${collection}:`, erro);
    return 0;
  }
}
