import { requireRole } from "@/lib/session";
import { fetchDiscordGuildRoles } from "@/lib/discord";
import PlanManager, { type AdminPlan, type PlanMetric } from "./PlanManager";
import { allPlans } from "@/lib/repo/plans";
import { listAllOrders } from "@/lib/repo/orders";
import { listProfiles } from "@/lib/repo/users";
import { nowSeconds } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function PlansPage() {
  await requireRole("owner");

  const [plans, orders, users] = await Promise.all([
    allPlans() as Promise<AdminPlan[]>,
    listAllOrders(2000),
    listProfiles(1000),
  ]);
  const since30 = nowSeconds() - 30 * 86400;
  const metrics: PlanMetric[] = plans.map((plan) => {
    const paid = orders.filter((order) => order.plan_id === plan.id && order.status === "paid");
    return {
      planId: plan.id,
      clients: users.filter((user) => user.tier === plan.code && user.status === "active").length,
      revenueCents: paid.reduce((sum, order) => sum + order.amount_cents, 0),
      sales: paid.length,
      salesThisMonth: paid.filter((order) => (order.paid_at ?? order.created_at) >= since30).length,
      lastSaleAt: paid.reduce<number | null>((latest, order) => {
        const date = order.paid_at ?? order.created_at;
        return latest === null || date > latest ? date : latest;
      }, null),
    };
  });
  let discordRoles: Awaited<ReturnType<typeof fetchDiscordGuildRoles>> = [];
  let discordError: string | null = null;
  try {
    discordRoles = await fetchDiscordGuildRoles();
  } catch (error) {
    discordError = (error as Error).message;
  }

  return (
    <PlanManager
      plans={plans}
      discordRoles={discordRoles}
      discordError={discordError}
      metrics={metrics}
    />
  );
}
