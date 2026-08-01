import type { Tweak } from "./catalog";
import type { User } from "./db";

export type OptimizerTier = "basic" | "pro" | "ultimate" | "special";

const INTERNAL_ROLES = new Set(["staff", "developer", "owner"]);

export function optimizerTier(tier: string | null): OptimizerTier | null {
  if (tier === "basic" || tier === "pro" || tier === "ultimate") return tier;
  if (tier === "special" || tier === "orion") return "special";
  // Planos personalizados so podem ser criados/atribuidos pelo Owner.
  // Recebem o nivel Special em vez de entrarem com um catalogo vazio.
  return tier ? "special" : null;
}

export function minimumTierForTweak(tweak: Pick<Tweak, "id" | "layer">): OptimizerTier {
  if (tweak.layer === 0) return "basic";
  if (tweak.id.startsWith("net.") || tweak.id.startsWith("mmcss.")) return "pro";
  return "ultimate";
}

export function canUseTweak(
  user: Pick<User, "role" | "tier">,
  tweak: Pick<Tweak, "id" | "layer">,
): boolean {
  if (INTERNAL_ROLES.has(user.role)) return true;
  const tier = optimizerTier(user.tier);
  if (!tier) return false;
  const rank: Record<OptimizerTier, number> = {
    basic: 1,
    pro: 2,
    ultimate: 3,
    special: 4,
  };
  return rank[tier] >= rank[minimumTierForTweak(tweak)];
}

export function filterTweaksForUser<T extends Pick<Tweak, "id" | "layer">>(
  user: Pick<User, "role" | "tier">,
  tweaks: T[],
): T[] {
  return tweaks.filter((tweak) => canUseTweak(user, tweak));
}
