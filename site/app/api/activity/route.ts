import { bearerToken, clientIp, userFromToken } from "@/lib/auth";
import { audit, getDb, nowSeconds } from "@/lib/db";
import { body, fail, ok, str } from "../_lib/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_ACTIONS = new Set([
  "optimizer_previewed",
  "optimizer_applied",
  "optimizer_rolled_back",
]);

export async function POST(req: Request) {
  const user = userFromToken(bearerToken(req));
  if (!user) return fail("Sessao invalida ou expirada.", 401, "invalid_token");

  const payload = await body(req);
  const action = str(payload.action).trim();
  const detail = str(payload.detail).trim().slice(0, 120);
  if (!ALLOWED_ACTIONS.has(action)) {
    return fail("Evento de atividade invalido.", 400, "invalid_activity");
  }

  audit(user.id, action, detail || null, clientIp(req));
  getDb().prepare("UPDATE users SET client_seen_at = ? WHERE id = ?").run(nowSeconds(), user.id);
  return ok({ recorded: true });
}
