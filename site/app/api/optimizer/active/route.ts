import { bearerToken, clientIp, nowSeconds, userFromToken } from "@/lib/auth";
import { audit } from "@/lib/repo/audit";
import {
  listActiveOptimizations,
  removeActiveOptimization,
  removeActiveOptimizationBySession,
  upsertActiveOptimization,
} from "@/lib/repo/active-optimizations";
import { updateProfile } from "@/lib/repo/users";
import { body, fail, ok, str } from "../../_lib/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function num(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function bool(value: unknown): boolean {
  return value === true || value === 1 || value === "1";
}

export async function GET(req: Request) {
  const user = await userFromToken(bearerToken(req));
  if (!user) return fail("Sessao invalida ou expirada.", 401, "invalid_token");
  return ok({ items: await listActiveOptimizations(user.id) });
}

export async function POST(req: Request) {
  const user = await userFromToken(bearerToken(req));
  if (!user) return fail("Sessao invalida ou expirada.", 401, "invalid_token");

  const payload = await body(req);
  const tweakId = str(payload.tweakId).trim();
  const name = str(payload.name).trim();
  if (!tweakId || !name) return fail("Otimizacao invalida.", 400, "invalid_optimization");

  const machine = payload.machine && typeof payload.machine === "object"
    ? payload.machine as Record<string, unknown>
    : {};
  const clientVersion = str(payload.clientVersion).trim() || null;

  const item = await upsertActiveOptimization(user.id, {
    tweakId,
    name,
    description: str(payload.description).trim() || null,
    category: str(payload.category).trim() || null,
    impact: str(payload.impact).trim() || null,
    requiresReboot: bool(payload.requiresReboot),
    sessionId: str(payload.sessionId).trim() || null,
    appliedAt: num(payload.appliedAt),
    mode: str(payload.mode).trim() || "Real",
    machine: {
      hwid: str(machine.hwid).trim() || user.hwid,
      chassis: str(machine.chassis).trim() || null,
      gpu: str(machine.gpu).trim() || null,
      ramGB: num(machine.ramGB),
    },
    clientVersion,
  });

  await updateProfile(user.id, {
    client_seen_at: nowSeconds(),
    ...(clientVersion ? { client_version: clientVersion } : {}),
  });
  audit(user.id, "optimizer_active_synced", tweakId, clientIp(req));
  return ok({ item });
}

export async function DELETE(req: Request) {
  const user = await userFromToken(bearerToken(req));
  if (!user) return fail("Sessao invalida ou expirada.", 401, "invalid_token");

  const payload = await body(req);
  const sessionId = str(payload.sessionId).trim();
  const tweakId = str(payload.tweakId).trim();
  const hwid = str(payload.hwid).trim() || user.hwid;

  if (sessionId) {
    await removeActiveOptimizationBySession(user.id, sessionId);
    audit(user.id, "optimizer_active_removed", sessionId, clientIp(req));
  } else if (tweakId) {
    await removeActiveOptimization(user.id, tweakId, hwid);
    audit(user.id, "optimizer_active_removed", tweakId, clientIp(req));
  } else {
    return fail("Indica tweakId ou sessionId.", 400, "missing_target");
  }

  return ok({ items: await listActiveOptimizations(user.id) });
}
