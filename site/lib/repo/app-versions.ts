import { firestore } from "../firebase-admin.ts";

export type AppVersionTarget = {
  id: string;
  label: string;
  app_version: string | null;
  app_min_supported: string | null;
  updated_at: number | null;
};

const COLLECTION = "app_version_targets";

function col() {
  return firestore().collection(COLLECTION);
}

function normalize(id: string, data: FirebaseFirestore.DocumentData | undefined): AppVersionTarget {
  return {
    id,
    label: typeof data?.label === "string" ? data.label : id,
    app_version: typeof data?.app_version === "string" ? data.app_version : null,
    app_min_supported: typeof data?.app_min_supported === "string" ? data.app_min_supported : null,
    updated_at: Number.isFinite(data?.updated_at) ? Number(data?.updated_at) : null,
  };
}

export async function findAppVersionTarget(id: string): Promise<AppVersionTarget | null> {
  const snap = await col().doc(id).get();
  return snap.exists ? normalize(id, snap.data()) : null;
}

export async function listAppVersionTargets(ids: Array<{ id: string; label: string }>): Promise<AppVersionTarget[]> {
  const docs = await Promise.all(ids.map(async (target) => {
    const snap = await col().doc(target.id).get();
    return normalize(target.id, { label: target.label, ...(snap.data() ?? {}) });
  }));
  return docs;
}

export async function updateAppVersionTarget(
  id: string,
  patch: Pick<AppVersionTarget, "label" | "app_version" | "app_min_supported">,
): Promise<void> {
  await col().doc(id).set({ ...patch, updated_at: Math.floor(Date.now() / 1000) }, { merge: true });
}
