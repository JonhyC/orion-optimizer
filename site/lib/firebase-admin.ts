import { cert, getApps, initializeApp, applicationDefault, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import type { User } from "./db.ts";

/**
 * Firebase do lado do servidor.
 *
 * O Admin SDK ignora as Security Rules por completo - e por isso que so
 * pode viver aqui, nunca em codigo que chegue ao browser. As regras de
 * firestore.rules aplicam-se ao SDK do browser; este passa por cima delas.
 *
 * As credenciais nunca ficam no codigo. Vem de:
 *   FIREBASE_SERVICE_ACCOUNT        - o JSON da conta de servico, inteiro
 *   GOOGLE_APPLICATION_CREDENTIALS  - ou o caminho para esse ficheiro
 *   FIRESTORE_EMULATOR_HOST         - ou entao e o emulador, sem credenciais
 */

const EMULATOR = Boolean(process.env.FIRESTORE_EMULATOR_HOST);

function buildApp(): App {
  const existing = getApps();
  if (existing.length) return existing[0];

  const projectId =
    process.env.FIREBASE_PROJECT_ID ?? process.env.GOOGLE_CLOUD_PROJECT ?? undefined;

  // Contra o emulador nao ha credenciais nenhumas: basta o id do projecto.
  if (EMULATOR) {
    return initializeApp({ projectId: projectId ?? "demo-orion" });
  }

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT?.trim();
  if (raw) {
    let parsed: { project_id?: string; client_email?: string; private_key?: string };
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error(
        "FIREBASE_SERVICE_ACCOUNT nao e JSON valido. Cola o ficheiro da conta de servico inteiro, incluindo as chavetas.",
      );
    }
    if (!parsed.project_id || !parsed.client_email || !parsed.private_key) {
      throw new Error(
        "FIREBASE_SERVICE_ACCOUNT esta incompleto: faltam project_id, client_email ou private_key.",
      );
    }
    return initializeApp({
      credential: cert({
        projectId: parsed.project_id,
        clientEmail: parsed.client_email,
        // Painel de alojamento nenhum aceita quebras de linha reais num
        // valor, portanto a chave chega com \n literais. Sem isto o
        // arranque falha com um erro de PEM que nao ajuda ninguem.
        privateKey: parsed.private_key.replace(/\\n/g, "\n"),
      }),
      projectId: parsed.project_id,
    });
  }

  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return initializeApp({ credential: applicationDefault(), projectId });
  }

  throw new Error(
    "Firebase por configurar: define FIREBASE_SERVICE_ACCOUNT com o JSON da conta de servico.",
  );
}

let app: App | null = null;

/** Inicializacao preguicosa: um build sem credenciais nao pode rebentar. */
function adminApp(): App {
  if (!app) app = buildApp();
  return app;
}

export function firestore(): Firestore {
  return getFirestore(adminApp());
}

/** Diz se ha configuracao, sem tentar usa-la. Para paginas de diagnostico. */
export function firebaseConfigured(): boolean {
  return EMULATOR || Boolean(process.env.FIREBASE_SERVICE_ACCOUNT || process.env.GOOGLE_APPLICATION_CREDENTIALS);
}

/**
 * Emite o custom token com que o browser se autentica no Firebase.
 *
 * O uid e o id do utilizador em string, igual ao id do documento em
 * /users - e o que faz `isSelf()` funcionar nas regras.
 *
 * As claims sao a copia do cargo e do plano no momento da emissao. Isso
 * significa que promover alguem a staff so tem efeito no proximo token:
 * as regras leem a claim, nao a base de dados. E deliberado - ler o
 * documento do utilizador dentro de cada regra custaria uma leitura
 * facturada por cada leitura de qualquer coisa.
 */
export async function mintFirebaseToken(user: Pick<User, "id" | "role" | "tier">): Promise<string> {
  return getAuth(adminApp()).createCustomToken(String(user.id), {
    role: user.role,
    tier: user.tier ?? "",
  });
}
