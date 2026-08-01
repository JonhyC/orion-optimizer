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

/**
 * Nivel minimo exigido por um tweak.
 *
 * O campo `tier` do catalogo manda. So quando falta e que se cai na regra
 * antiga, que adivinhava pelo prefixo do id - e que tinha o defeito de
 * mandar para `ultimate` tudo o que nao fosse `net.` nem `mmcss.`, portanto
 * um tweak novo ficava fora do alcance de toda a gente sem aviso nenhum.
 */
export function minimumTierForTweak(tweak: Pick<Tweak, "id" | "layer" | "tier">): OptimizerTier {
  if (tweak.tier) return tweak.tier;

  if (tweak.layer === 0) return "basic";
  if (tweak.id.startsWith("net.") || tweak.id.startsWith("mmcss.")) return "pro";
  return "ultimate";
}

export function canUseTweak(
  user: Pick<User, "role" | "tier">,
  tweak: Pick<Tweak, "id" | "layer" | "tier">,
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

export function filterTweaksForUser<T extends Pick<Tweak, "id" | "layer" | "tier">>(
  user: Pick<User, "role" | "tier">,
  tweaks: T[],
): T[] {
  return tweaks.filter((tweak) => canUseTweak(user, tweak));
}

/**
 * Um tweak sem o campo `enabled` conta como ligado. Os catalogos anteriores
 * a este campo nao o tem, e a ausencia nunca pode significar suspenso.
 *
 * Vive aqui e nao em catalog.ts porque o painel precisa dela do lado do
 * cliente, e catalog.ts importa node:fs.
 */
export function isTweakEnabled(t: Pick<Tweak, "enabled">): boolean {
  return t.enabled !== false;
}

/** Rotulo para a interface. O Special e o unico que nao se compra. */
export const TIER_LABELS: Record<OptimizerTier, string> = {
  basic: "Basic",
  pro: "Pro",
  ultimate: "Ultimate",
  special: "Special",
};

/** Agrupa um catalogo por nivel, pela ordem em que se vendem. */
export function groupTweaksByTier<T extends Pick<Tweak, "id" | "layer" | "tier">>(
  tweaks: T[],
): Array<{ tier: OptimizerTier; tweaks: T[] }> {
  const order: OptimizerTier[] = ["basic", "pro", "ultimate", "special"];
  return order.map((tier) => ({
    tier,
    tweaks: tweaks.filter((t) => minimumTierForTweak(t) === tier),
  }));
}
