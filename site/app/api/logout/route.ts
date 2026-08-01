import { bearerToken, clientIp, revokeToken, userFromToken } from "@/lib/auth";
import { audit } from "@/lib/db";
import { ok } from "../_lib/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const token = bearerToken(req);

  if (token) {
    const user = userFromToken(token);
    revokeToken(token);
    if (user) audit(user.id, "logout", null, clientIp(req));
  }

  // Sempre ok: revogar um token ja invalido nao e um erro.
  return ok({});
}
