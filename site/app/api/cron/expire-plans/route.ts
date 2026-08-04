import { timingSafeEqual } from "node:crypto";
import { processExpiredPlans } from "@/lib/plan-expiry";
import { fail, ok } from "../../_lib/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET ?? "";
  const supplied = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!secret || !supplied) return false;
  const expected = Buffer.from(secret);
  const actual = Buffer.from(supplied);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export async function POST(req: Request) {
  if (!authorized(req)) return fail("Nao autorizado.", 401, "unauthorized");
  // O cron e quem tem de fazer o trabalho a serio: ignora o intervalo
  // minimo que trava as chamadas vindas das paginas.
  return ok(await processExpiredPlans({ forcar: true }));
}
