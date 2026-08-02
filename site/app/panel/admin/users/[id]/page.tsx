import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireRole } from "@/lib/session";
import { ordersForUser } from "@/lib/stats";
import { allPlans } from "@/lib/repo/plans";
import { findById } from "@/lib/repo/users";
import { auditForUser, loginStatsFor } from "@/lib/repo/audit";
import { countActiveByUser } from "@/lib/repo/tokens";
import { avatarUrl } from "@/lib/discord";
import AdminUserProfile from "./AdminUserProfile";

export const dynamic = "force-dynamic";

export default async function UserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const actor = await requireRole("owner");
  const { id } = await params;

  const user = await findById(Number(id));
  if (!user) notFound();

  const now = Math.floor(Date.now() / 1000);

  // As cinco leituras sao independentes umas das outras. Encadea-las somava
  // cinco idas ao Firestore (~93ms cada) ao tempo de abertura da pagina.
  const [plans, orders, loginStats, sessions, registos] = await Promise.all([
    allPlans(),
    ordersForUser(user.id),
    loginStatsFor(user.username),
    countActiveByUser(user.id),
    auditForUser(user.id, 20),
  ]);

  // A auditoria no Firestore usa ids automaticos e o componente precisa de
  // uma chave estavel por linha. O par accao+instante identifica cada
  // registo sem depender do id.
  const activity = registos.map((r, indice) => ({
    id: indice,
    action: r.action,
    detail: r.detail,
    ip: r.ip,
    created_at: r.created_at,
  }));

  return (
    <>
      <Link
        href="/panel/admin/users"
        className="inline-flex items-center gap-2 text-[13px] text-white/40 transition-colors hover:text-white"
      >
        <ArrowLeft size={14} />
        Contas
      </Link>

      <div className="mt-5">
        <AdminUserProfile
          user={{
            ...user,
            discord_avatar_url: user.discord_id ? avatarUrl(user.discord_id, user.discord_avatar) : null,
          }}
          plans={plans}
          orders={orders}
          activity={activity}
          loginStats={loginStats}
          sessions={sessions}
          isSelf={actor.id === user.id}
          now={now}
        />
      </div>
    </>
  );
}
