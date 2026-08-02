import { requireRole, roleAtLeast } from "@/lib/session";
import { nowSeconds } from "@/lib/db";
import { avatarUrl } from "@/lib/discord";
import { activePlans } from "@/lib/repo/plans";
import { listProfiles } from "@/lib/repo/users";
import UsersManager from "./UsersManager";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const actor = await requireRole("staff");
  const canSuspend = roleAtLeast(actor, "developer");
  const canManage = roleAtLeast(actor, "owner");

  const [users, plans] = await Promise.all([listProfiles(500), activePlans()]);
  const now = nowSeconds();

  return (
    <UsersManager
      users={users.map((user) => ({
        ...user,
        discord_avatar_url: user.discord_id ? avatarUrl(user.discord_id, user.discord_avatar) : null,
      }))}
      plans={plans.map((plan) => ({ code: plan.code, name: plan.name }))}
      now={now}
      canSuspend={canSuspend}
      canManage={canManage}
      actorId={actor.id}
    />
  );
}
