import { bearerToken, nowSeconds, userFromToken } from "@/lib/auth";
import { updateProfile } from "@/lib/repo/users";
import { fail, ok } from "../_lib/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const user = await userFromToken(bearerToken(req));
  if (!user) return fail("Sessao invalida ou expirada.", 401, "invalid_token");
  await updateProfile(user.id, { client_seen_at: nowSeconds() });
  return ok({ online: true });
}
