import { requireRole } from "@/lib/session";
import { getDb } from "@/lib/db";
import { fetchDiscordGuildRoles } from "@/lib/discord";
import PlanManager, { type AdminPlan } from "./PlanManager";

export const dynamic = "force-dynamic";

export default async function PlansPage() {
  await requireRole("owner");

  const rows = getDb()
    .prepare("SELECT * FROM plans ORDER BY sort_order, id")
    .all() as AdminPlan[];
  const plans = rows.map((plan) => ({ ...plan }));
  let discordRoles: Awaited<ReturnType<typeof fetchDiscordGuildRoles>> = [];
  let discordError: string | null = null;
  try {
    discordRoles = await fetchDiscordGuildRoles();
  } catch (error) {
    discordError = (error as Error).message;
  }

  return <PlanManager plans={plans} discordRoles={discordRoles} discordError={discordError} />;
}
