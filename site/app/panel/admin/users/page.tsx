import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { requireRole, roleAtLeast } from "@/lib/session";
import { getDb, nowSeconds, type User } from "@/lib/db";
import { dateTime } from "@/lib/stats";
import { Card, StatusBadge } from "@/components/panel/Pieces";
import { resetHwidAction, setUserStatusAction } from "../../actions";
import CreateUser from "./CreateUser";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const actor = await requireRole("staff");
  // Staff ve as contas e desliga maquinas (suporte); suspender exige developer;
  // criar, editar a fundo e apagar sao exclusivos do owner.
  const canSuspend = roleAtLeast(actor, "developer");
  const canManage = roleAtLeast(actor, "owner");

  const users = getDb()
    .prepare("SELECT * FROM users ORDER BY created_at DESC")
    .all() as User[];
  const planRows = getDb()
    .prepare("SELECT code, name FROM plans ORDER BY sort_order, id")
    .all() as Array<{ code: string; name: string }>;
  const plans = planRows.map((plan) => ({ ...plan }));

  const now = nowSeconds();

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Contas</h1>
          <p className="mt-1.5 text-[14px] text-white/40">
            {users.length} contas.
            {canManage
              ? " Clica numa para editar papel, plano e licenca."
              : " Criar e editar a fundo exige owner."}
          </p>
        </div>
        {canManage && <CreateUser plans={plans} />}
      </div>

      <Card className="mt-8">
        <div className="overflow-x-auto">
          <table className="w-full text-[13.5px]">
            <thead>
              <tr>
                {["Utilizador", "Papel", "Plano", "Estado", "Licenca", "Suporte", "Maquina", "Criada", ""].map((h) => (
                  <th
                    key={h}
                    className="border-b border-white/[0.06] px-3 py-2.5 text-left text-[10.5px] font-semibold uppercase tracking-wide text-white/35"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                // Mesma regra da pagina de conta: expires_at a NULL sem plano
                // nenhum significa "nunca comprou", nao "licenca sem prazo".
                const hasLicense = u.tier !== null || u.expires_at !== null;
                const active = hasLicense && (u.expires_at === null || u.expires_at > now);
                const hasSupport =
                  u.support_lifetime === 1 ||
                  u.support_started_at !== null ||
                  u.support_expires_at !== null;
                // Um developer nao mexe numa conta de owner, e ninguem se
                // suspende a si proprio.
                const canEdit =
                  u.id !== actor.id && (u.role !== "owner" || actor.role === "owner");

                return (
                  <tr key={u.id}>
                    <td className="border-b border-white/[0.04] px-3 py-3 font-medium text-white/80">
                      {canManage ? (
                        <Link
                          href={`/panel/admin/users/${u.id}`}
                          className="text-white/85 transition-colors hover:text-[var(--chart-1)]"
                        >
                          {u.username}
                        </Link>
                      ) : (
                        u.username
                      )}
                      {u.discord_username && (
                        <span className="ml-2 text-[11.5px] font-normal text-white/25">
                          {u.discord_username}
                        </span>
                      )}
                    </td>
                    <td className="border-b border-white/[0.04] px-3 py-3 text-white/45">
                      {u.role}
                      {u.role_source === "manual" && (
                        <span className="ml-1.5 text-[10px] uppercase tracking-wide text-white/20">
                          fixo
                        </span>
                      )}
                    </td>
                    <td className="border-b border-white/[0.04] px-3 py-3 text-white/45">
                      {u.tier ?? "—"}
                    </td>
                    <td className="border-b border-white/[0.04] px-3 py-3">
                      <StatusBadge status={u.status} />
                    </td>
                    <td className="border-b border-white/[0.04] px-3 py-3 tabular-nums text-white/45">
                      {!hasLicense ? (
                        <span className="text-white/25">sem licenca</span>
                      ) : u.expires_at === null ? (
                        "life-time"
                      ) : active ? (
                        `${Math.ceil((u.expires_at - now) / 86400)} dias`
                      ) : (
                        <span className="text-[var(--critical)]">expirada</span>
                      )}
                    </td>
                    <td className="border-b border-white/[0.04] px-3 py-3 tabular-nums text-white/45">
                      {!hasSupport ? (
                        <span className="text-white/25">sem suporte</span>
                      ) : u.support_lifetime === 1 ? (
                        "life-time"
                      ) : u.support_expires_at !== null && u.support_expires_at > now ? (
                        `${Math.ceil((u.support_expires_at - now) / 86400)} dias`
                      ) : (
                        <span className="text-[var(--critical)]">expirado</span>
                      )}
                    </td>
                    <td className="border-b border-white/[0.04] px-3 py-3 font-mono text-[11.5px] text-white/30">
                      {u.hwid ? u.hwid.slice(0, 8) : "—"}
                    </td>
                    <td className="border-b border-white/[0.04] px-3 py-3 tabular-nums text-white/35">
                      {dateTime(u.created_at)}
                    </td>
                    <td className="border-b border-white/[0.04] px-3 py-3">
                      <div className="flex flex-wrap justify-end gap-2">
                        {canManage && (
                          <Link
                            href={`/panel/admin/users/${u.id}`}
                            aria-label={`Ver todos os detalhes de ${u.username}`}
                            title="Ver todos os detalhes"
                            className="grid h-7 w-7 place-items-center rounded-md border border-white/10 text-white/45 transition-colors hover:border-[var(--chart-1)] hover:text-[var(--chart-1)]"
                          >
                            <ChevronRight size={14} />
                          </Link>
                        )}
                        {canEdit && (
                          <>
                          {u.hwid && (
                            <form action={resetHwidAction}>
                              <input type="hidden" name="userId" value={u.id} />
                              <button className="rounded-md border border-white/10 px-2.5 py-1 text-[11.5px] text-white/50 transition-colors hover:border-white/25 hover:text-white">
                                Desligar maquina
                              </button>
                            </form>
                          )}
                          {canSuspend && (
                            <form action={setUserStatusAction}>
                              <input type="hidden" name="userId" value={u.id} />
                              <input
                                type="hidden"
                                name="status"
                                value={u.status === "active" ? "suspended" : "active"}
                              />
                              <button
                                className={`rounded-md border px-2.5 py-1 text-[11.5px] transition-colors ${
                                  u.status === "active"
                                    ? "border-[var(--critical)]/30 text-[var(--critical)] hover:bg-[var(--critical)]/10"
                                    : "border-[var(--good)]/30 text-[var(--good)] hover:bg-[var(--good)]/10"
                                }`}
                              >
                                {u.status === "active" ? "Suspender" : "Reativar"}
                              </button>
                            </form>
                          )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <p className="mt-5 text-[12.5px] text-white/25">
        Suspender uma conta termina as sessoes abertas de imediato — o token deixa
        de servir catalogo ao cliente Windows sem esperar que expire.
      </p>
    </>
  );
}
