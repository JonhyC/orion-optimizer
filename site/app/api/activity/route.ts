import { bearerToken, clientIp, userFromToken } from "@/lib/auth";
import { nowSeconds } from "@/lib/db";
import { audit } from "@/lib/repo/audit";
import { updateProfile } from "@/lib/repo/users";
import { body, fail, ok, str } from "../_lib/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_ACTIONS = new Set([
  "optimizer_previewed",
  "optimizer_applied",
  "optimizer_rolled_back",
]);

export async function POST(req: Request) {
  const user = await userFromToken(bearerToken(req));
  if (!user) return fail("Sessao invalida ou expirada.", 401, "invalid_token");

  const payload = await body(req);
  const action = str(payload.action).trim();
  const detail = str(payload.detail).trim().slice(0, 120);
  if (!ALLOWED_ACTIONS.has(action)) {
    return fail("Evento de atividade invalido.", 400, "invalid_activity");
  }

  audit(user.id, action, detail || null, clientIp(req));

  // O `client_seen_at` e o que alimenta a "ultima sessao" no painel do
  // cliente e a contagem de quem esta online no painel do administrador.
  // Ia para o SQLite, que na Vercel vive em /tmp e desaparece a cada
  // arranque: os dois numeros nunca podiam estar certos.
  await updateProfile(user.id, { client_seen_at: nowSeconds() });

  return ok({ recorded: true });
}
