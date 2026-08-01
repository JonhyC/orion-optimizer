import { requireRole, roleAtLeast } from "@/lib/session";
import { dailySeries, dateTime, money, recentOrders, revenueByPlan, summary } from "@/lib/stats";
import AreaChart from "@/components/panel/AreaChart";
import { BarList, Card, StatTile, StatusBadge, TableView } from "@/components/panel/Pieces";
import { discordConfig } from "@/lib/discord";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await requireRole("staff");
  const canSeeMoney = roleAtLeast(user, "owner");
  const discordBotReady = Boolean(discordConfig()?.botToken);
  const pendingDiscordSync = canSeeMoney
    ? (getDb().prepare("SELECT COUNT(*) AS total FROM discord_role_sync").get() as {
        total: number;
      }).total
    : 0;

  const s = summary();
  const revenue = dailySeries("revenue", 30);
  const signups = dailySeries("signups", 30);
  const plans = revenueByPlan();
  const orders = recentOrders(8);

  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight text-white">Painel</h1>
      <p className="mt-1.5 text-[14px] text-white/40">
        {canSeeMoney
          ? "Vendas, licencas e atividade dos ultimos 30 dias."
          : "Licencas e atividade dos ultimos 30 dias. Os numeros financeiros sao visiveis apenas ao dono."}
      </p>

      {canSeeMoney && (!discordBotReady || pendingDiscordSync > 0) && (
        <div className="mt-6 rounded-lg border border-[var(--warning)]/30 bg-[var(--warning)]/[0.06] px-4 py-3 text-[12.5px] text-white/55">
          {!discordBotReady
            ? "Sincronizacao de cargos pendente: falta configurar DISCORD_BOT_TOKEN."
            : `${pendingDiscordSync} alteracao${pendingDiscordSync === 1 ? "" : "oes"} de cargos Discord pendente${pendingDiscordSync === 1 ? "" : "s"}.`}
        </div>
      )}

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {canSeeMoney && (
          <>
            <StatTile
              label="Receita total"
              value={money(s.revenueTotal)}
              foot={`${s.ordersPaid} encomendas pagas`}
            />
            <StatTile
              label="Receita 30 dias"
              value={money(s.revenue30)}
              delta={s.revenueDelta}
            />
          </>
        )}
        <StatTile
          label="Licencas ativas"
          value={String(s.activeLicenses)}
          foot={`de ${s.clientsTotal} contas`}
        />
        <StatTile
          label="Novos clientes"
          value={String(s.clientsNew30)}
          foot="ultimos 30 dias"
        />
        {!canSeeMoney && (
          <StatTile
            label="Encomendas pendentes"
            value={String(s.ordersByStatus.pending ?? 0)}
            foot="a aguardar pagamento"
          />
        )}
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        {canSeeMoney && (
          <Card title="Receita por dia" subtitle="Ultimos 30 dias, encomendas pagas">
            <AreaChart points={revenue} format="money" emptyLabel="Ainda nao ha vendas registadas." />
            <TableView
              headers={["Dia", "Receita"]}
              rows={revenue.filter((p) => p.value > 0).map((p) => [p.label, money(p.value)])}
            />
          </Card>
        )}

        <Card title="Novos clientes por dia" subtitle="Ultimos 30 dias">
          <AreaChart points={signups} emptyLabel="Ainda nao ha registos." />
          <TableView
            headers={["Dia", "Novos"]}
            rows={signups.filter((p) => p.value > 0).map((p) => [p.label, p.value])}
          />
        </Card>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_1.3fr]">
        <Card
          title={canSeeMoney ? "Receita por plano" : "Encomendas por plano"}
          subtitle="Acumulado"
        >
          <BarList
            rows={plans.map((p) => ({
              label: p.name,
              value: canSeeMoney ? p.revenue : p.orders,
              display: canSeeMoney ? money(p.revenue) : String(p.orders),
              note: canSeeMoney ? `${p.orders} encomendas` : undefined,
            }))}
            empty="Ainda nao ha encomendas pagas."
          />
        </Card>

        <Card title="Ultimas encomendas">
          {orders.length === 0 ? (
            <p className="py-8 text-center text-[13px] text-white/30">Ainda nao ha encomendas.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr>
                    {["Data", "Cliente", "Plano", ...(canSeeMoney ? ["Valor"] : []), "Estado"].map((h) => (
                      <th
                        key={h}
                        className="border-b border-white/[0.06] px-2.5 py-2 text-left text-[10.5px] font-semibold uppercase tracking-wide text-white/35"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o.id}>
                      <td className="border-b border-white/[0.04] px-2.5 py-2.5 tabular-nums text-white/45">
                        {dateTime(o.created_at)}
                      </td>
                      <td className="border-b border-white/[0.04] px-2.5 py-2.5 text-white/70">{o.username}</td>
                      <td className="border-b border-white/[0.04] px-2.5 py-2.5 text-white/50">{o.plan_name}</td>
                      {canSeeMoney && (
                        <td className="border-b border-white/[0.04] px-2.5 py-2.5 tabular-nums text-white/70">
                          {money(o.amount_cents, o.currency)}
                        </td>
                      )}
                      <td className="border-b border-white/[0.04] px-2.5 py-2.5">
                        <StatusBadge status={o.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {canSeeMoney && s.refundedTotal > 0 && (
        <Card className="mt-5">
          <div className="flex flex-wrap items-center gap-x-10 gap-y-3 text-[13.5px]">
            <span className="text-white/40">
              Reembolsado: <strong className="tabular-nums text-white/70">{money(s.refundedTotal)}</strong>
            </span>
            <span className="text-white/40">
              Valor medio por encomenda:{" "}
              <strong className="tabular-nums text-white/70">{money(s.avgOrder)}</strong>
            </span>
          </div>
        </Card>
      )}
    </>
  );
}
