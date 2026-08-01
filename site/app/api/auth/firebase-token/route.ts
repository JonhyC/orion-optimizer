import { currentUser } from "@/lib/session";
import { firebaseConfigured, mintFirebaseToken } from "@/lib/firebase-admin";
import { fail, ok } from "../../_lib/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Troca a sessao Orion por um token do Firebase.
 *
 * O browser precisa de identidade Firebase para as Security Rules o
 * reconhecerem quando abrir listeners em tempo real. Quem manda nessa
 * identidade e este endpoint: le a sessao ja existente (cookie ou bearer,
 * conforme o que o resto do site usa) e so entao emite o token.
 *
 * O cargo e o plano vao para dentro do token AQUI, no servidor, a partir
 * da base de dados. O browser nunca os escolhe - se escolhesse, bastava
 * pedir um token a dizer role=owner.
 */
export async function GET() {
  const user = await currentUser();
  if (!user) {
    return fail("Sessao invalida ou expirada.", 401, "invalid_session");
  }

  if (!firebaseConfigured()) {
    console.error("[orion] FIREBASE_SERVICE_ACCOUNT em falta; tempo real desligado");
    return fail("Firebase por configurar no servidor.", 503, "firebase_unconfigured");
  }

  try {
    const token = await mintFirebaseToken(user);
    // Uma hora e o maximo que o Firebase aceita para custom tokens. O
    // cliente troca-o por uma sessao Firebase que se renova sozinha; este
    // token so serve para essa primeira troca.
    return ok({ token, expiresInSeconds: 3600 });
  } catch (error) {
    console.error("[orion] falha a emitir custom token do Firebase:", error);
    return fail("Nao foi possivel iniciar a sessao em tempo real.", 500, "token_mint_failed");
  }
}
