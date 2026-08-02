import crypto from "node:crypto";
import { firestore } from "../firebase-admin.ts";
import { COLLECTIONS, type ActiveOptimization } from "./types.ts";

const agora = () => Math.floor(Date.now() / 1000);

function col() {
  return firestore().collection(COLLECTIONS.activeOptimizations);
}

function idFor(userId: number, hwid: string | null, tweakId: string) {
  const machine = crypto.createHash("sha256").update(hwid || "unknown").digest("hex").slice(0, 16);
  const tweak = String(tweakId).replace(/[^a-z0-9_.-]/gi, "_").slice(0, 120);
  return `${userId}_${machine}_${tweak}`;
}

function normalizar(id: string, dados: Partial<ActiveOptimization>): ActiveOptimization {
  return {
    id,
    user_id: Number(dados.user_id ?? 0),
    tweak_id: dados.tweak_id ?? "",
    name: dados.name ?? dados.tweak_id ?? "",
    description: dados.description ?? null,
    category: dados.category ?? "system",
    impact: dados.impact ?? null,
    requires_reboot: Number(dados.requires_reboot ?? 0),
    session_id: dados.session_id ?? null,
    applied_at: Number(dados.applied_at ?? 0),
    mode: dados.mode ?? "Real",
    machine_hwid: dados.machine_hwid ?? null,
    machine_chassis: dados.machine_chassis ?? null,
    machine_gpu: dados.machine_gpu ?? null,
    machine_ram_gb: dados.machine_ram_gb ?? null,
    client_version: dados.client_version ?? null,
    updated_at: Number(dados.updated_at ?? dados.applied_at ?? 0),
  };
}

export async function upsertActiveOptimization(
  userId: number,
  item: {
    tweakId: string;
    name: string;
    description?: string | null;
    category?: string | null;
    impact?: string | null;
    requiresReboot?: boolean;
    sessionId?: string | null;
    appliedAt?: number | null;
    mode?: string | null;
    machine?: {
      hwid?: string | null;
      chassis?: string | null;
      gpu?: string | null;
      ramGB?: number | null;
    };
    clientVersion?: string | null;
  },
): Promise<ActiveOptimization> {
  const now = agora();
  const hwid = item.machine?.hwid ?? null;
  const id = idFor(userId, hwid, item.tweakId);
  const payload: ActiveOptimization = {
    id,
    user_id: userId,
    tweak_id: String(item.tweakId),
    name: String(item.name || item.tweakId),
    description: item.description ? String(item.description) : null,
    category: String(item.category || item.tweakId.split(".")[0] || "system"),
    impact: item.impact ? String(item.impact) : null,
    requires_reboot: item.requiresReboot ? 1 : 0,
    session_id: item.sessionId ? String(item.sessionId) : null,
    applied_at: Number(item.appliedAt || now),
    mode: String(item.mode || "Real"),
    machine_hwid: hwid,
    machine_chassis: item.machine?.chassis ? String(item.machine.chassis) : null,
    machine_gpu: item.machine?.gpu ? String(item.machine.gpu) : null,
    machine_ram_gb: item.machine?.ramGB === null || item.machine?.ramGB === undefined ? null : Number(item.machine.ramGB),
    client_version: item.clientVersion ? String(item.clientVersion) : null,
    updated_at: now,
  };
  await col().doc(id).set(payload);
  return payload;
}

export async function listActiveOptimizations(userId: number): Promise<ActiveOptimization[]> {
  const snap = await col().where("user_id", "==", userId).get();
  return snap.docs
    .map((doc) => normalizar(doc.id, doc.data() as Partial<ActiveOptimization>))
    .sort((left, right) => right.applied_at - left.applied_at);
}

export async function removeActiveOptimization(userId: number, tweakId: string, hwid: string | null): Promise<void> {
  await col().doc(idFor(userId, hwid, tweakId)).delete();
}

export async function removeActiveOptimizationBySession(userId: number, sessionId: string): Promise<void> {
  const snap = await col()
    .where("user_id", "==", userId)
    .where("session_id", "==", sessionId)
    .get();
  await Promise.all(snap.docs.map((doc) => doc.ref.delete()));
}
