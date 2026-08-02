import { requireRole } from "@/lib/session";
import { dateTime, money, recentOrders, summary } from "@/lib/stats";
import { Card, StatTile, StatusBadge } from "@/components/panel/Pieces";
import { refundOrderAction } from "../../actions";

export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  await requireRole("owner");

  const [s, orders] = await Promise.all([summary(), recentOrders(100)]);

  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight text-white">Vendas</h1>
      <p className="mt-1.5 text-[14px] text-white/40">
        Todas as encomendas, mais recentes primeiro.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Receita total" value={money(s.revenueTotal)} />
        <StatTile label="Encomendas pagas" value={String(s.ordersPaid)} />
        <StatTile label="Valor medio" value={money(s.avgOrder)} />
        <StatTile
          label="Reembolsado"
          value={money(s.refundedTotal)}
          foot={`${s.ordersByStatus.refunded ?? 0} encomendas`}
        />
      </div>

      <Card className="mt-5">
        {orders.length === 0 ? (
          <p className="py-10 text-center text-[13px] text-white/30">
            Ainda nao ha encomendas. Quando o checkout estiver ligado, aparecem aqui.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13.5px]">
              <thead>
                <tr>
                  {["#", "Data", "Cliente", "Plano", "Valor", "Metodo", "Estado", ""].map((h) => (
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
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td className="border-b border-white/[0.04] px-3 py-3 tabular-nums text-white/25">{o.id}</td>
                    <td className="border-b border-white/[0.04] px-3 py-3 tabular-nums text-white/45">
                      {dateTime(o.created_at)}
                    </td>
                    <td className="border-b border-white/[0.04] px-3 py-3 text-white/75">{o.username}</td>
                    <td className="border-b border-white/[0.04] px-3 py-3 text-white/50">{o.plan_name}</td>
                    <td className="border-b border-white/[0.04] px-3 py-3 tabular-nums text-white/75">
                      {money(o.amount_cents, o.currency)}
                    </td>
                    <td className="border-b border-white/[0.04] px-3 py-3 text-white/30">{o.provider}</td>
                    <td className="border-b border-white/[0.04] px-3 py-3">
                      <StatusBadge status={o.status} />
                    </td>
                    <td className="border-b border-white/[0.04] px-3 py-3 text-right">
                      {o.status === "paid" && (
                        <form action={refundOrderAction}>
                          <input type="hidden" name="orderId" value={o.id} />
                          <button className="rounded-md border border-[var(--serious)]/30 px-2.5 py-1 text-[11.5px] text-[var(--serious)] transition-colors hover:bg-[var(--serious)]/10">
                            Reembolsar
                          </button>
                        </form>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <p className="mt-5 text-[12.5px] text-white/25">
        Reembolsar retira da licenca o tempo que a encomenda tinha dado, mas nunca
        recua para antes de agora — um reembolso antigo nao pode expirar uma
        licenca que ainda esta paga por outra compra.
      </p>
    </>
  );
}
