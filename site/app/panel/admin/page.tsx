import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bell,
  Boxes,
  Database,
  Download,
  KeyRound,
  LifeBuoy,
  MessageSquare,
  PackagePlus,
  Plus,
  RefreshCw,
  Server,
  ShieldCheck,
  Sparkles,
  Ticket,
  Users,
  Wrench,
} from "lucide-react";
import { requireRole, roleAtLeast } from "@/lib/session";
import { nowSeconds } from "@/lib/db";
import { catalogStats } from "@/lib/catalog";
import { discordConfig } from "@/lib/discord";
import { optimizerRelease } from "@/lib/optimizer-release";
import { listCoupons } from "@/lib/repo/coupons";
import { listAllSupportTickets } from "@/lib/repo/support";
import { listProfiles } from "@/lib/repo/users";
import { dailySeries, dateTime, money, recentOrders, revenueByPlan, summary } from "@/lib/stats";
import { derivarAlertas, estadoDosServicos, type EstadoServico } from "@/lib/admin-dashboard";
import RevenueChart from "./RevenueChart";
import { BarList, Card, StatusBadge, TableView } from "@/components/panel/Pieces";
import { TIER_LABELS } from "@/lib/optimizer-access";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await requireRole("staff");
  const canSeeMoney = roleAtLeast(user, "owner");
  const now = nowSeconds();
  const discordBotReady = Boolean(discordConfig()?.botToken);

  // Cronometrar a leitura serve o painel: e a unica medicao honesta de
  // saude da base de dados que esta pagina consegue fazer sobre si propria.
  const inicioLeitura = Date.now();

  // 90 dias em vez de 30: o seletor de periodo do grafico corta esta serie
  // em memoria, portanto tem de vir com o periodo mais longo que oferece.
  const [s, revenueSerie, signups, ordersSerie, plans, orders, profiles, tickets, coupons] =
    await Promise.all([
      summary(),
      dailySeries("revenue", 90),
      dailySeries("signups", 30),
      dailySeries("orders", 90),
      revenueByPlan(),
      recentOrders(8),
      listProfiles(12),
      listAllSupportTickets(8),
      listCoupons(),
    ]);

  const leituraMs = Date.now() - inicioLeitura;

  const cat = catalogStats();
  const release = optimizerRelease();
  const pendingTickets = tickets.filter((ticket) => ticket.status !== "closed");
  const unreadTickets = tickets.filter((ticket) => ticket.unread_for_staff === 1);
  const activeCoupons = coupons.filter((coupon) => coupon.active === 1);
  const activeClients = profiles.filter((profile) => profile.status === "active");
  const suspendedClients = profiles.filter((profile) => profile.status === "suspended");
  const clientsWithoutLicense = profiles.filter((profile) => profile.tier === null && profile.expires_at === null);
  const onlineOptimizer = profiles.filter((profile) => (profile.client_seen_at ?? 0) >= now - 300).length;
  const pendingOrders = s.ordersByStatus.pending ?? 0;

  // A versao anterior punha "Versao publicada X" no meio dos problemas. E
  // informacao util, mas nao um alerta - e misturada com eles faz com que
  // nenhum se destaque. Agora os alertas sao so o que precisa de accao, por
  // ordem de gravidade e com o link para onde se resolve.
  const alertas = derivarAlertas({
    ticketsPorLer: unreadTickets.length,
    comprasPendentes: pendingOrders,
    discordBotPronto: discordBotReady,
    conflitosCatalogo: cat.conflicts,
    tweaksSuspensos: cat.suspended,
    contasSuspensas: suspendedClients.length,
  });
  const alerts = alertas.map((a) => a.texto);

  // Estado dos servicos SO com factos.
  //
  // A versao anterior listava oito servicos com latencias escritas a mao no
  // codigo - 42 ms, 58 ms, 91 ms, 74 ms - que nunca foram medidas. Um
  // painel que inventa numeros de saude e pior do que um painel sem eles:
  // quando algo abrandar a serio, continuara a dizer 58 ms.
  //
  // Ficam quatro linhas, cada uma verificavel: a base de dados leva o
  // tempo REAL desta leitura, e as restantes dizem se estao configuradas.
  const servicos = estadoDosServicos({
    firestoreMs: leituraMs,
    discordBotPronto: discordBotReady,
    pagamentosConfigurados: Boolean(
      process.env.STRIPE_SECRET_KEY || process.env.PAYPAL_CLIENT_ID,
    ),
    versaoPublicada: release.version,
  });

  const realtime = [
    orders[0] ? ["Agora", "Compra recente", `${orders[0].username} - ${orders[0].plan_name}`] : null,
    profiles[0] ? ["Recente", "Novo utilizador", profiles[0].username] : null,
    tickets[0] ? ["Suporte", "Ticket atualizado", tickets[0].subject] : null,
    ["Catalogo", "Tweaks carregados", `${cat.total} otimizacoes`],
    ["Release", "Versao atual", release.version],
  ].filter(Boolean) as string[][];

  return (
    <>
      <DashboardHero
        now={now}
        version={release.version}
        platformOk={discordBotReady && cat.conflicts === 0}
      />

      <DashboardStats
        canSeeMoney={canSeeMoney}
        revenueTotal={s.revenueTotal}
        revenue30={s.revenue30}
        revenueDelta={s.revenueDelta}
        activeClients={activeClients.length}
        newClients={s.clientsNew30}
        activeLicenses={s.activeLicenses}
        pendingTickets={pendingTickets.length}
        pendingReviews={0}
        downloadsToday={0}
      />

      <DashboardQuickActions canSeeMoney={canSeeMoney} />

      <div className="mt-6 grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <DashboardServices servicos={servicos} />
        <DashboardAlerts alerts={alerts} />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <Card
          title={canSeeMoney ? "Receita" : "Atividade de compras"}
          subtitle="Escolhe o período no gráfico"
        >
          <RevenueChart
            serie={canSeeMoney ? revenueSerie : ordersSerie}
            dinheiro={canSeeMoney}
          />
        </Card>
        <DashboardRealtime rows={realtime} />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-3">
        <DashboardCustomers
          active={activeClients.length}
          newClients={s.clientsNew30}
          withoutLicense={clientsWithoutLicense.length}
          suspended={suspendedClients.length}
        />
        <DashboardPlans canSeeMoney={canSeeMoney} plans={plans} />
        <DashboardCatalog cat={cat} />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
        <DashboardPurchases canSeeMoney={canSeeMoney} orders={orders} />
        <DashboardUsers users={profiles.slice(0, 6)} now={now} />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-3">
        <DashboardPending
          reviews={0}
          tickets={pendingTickets.length}
          purchases={pendingOrders}
          coupons={activeCoupons.length}
          updates={release.version ? 1 : 0}
        />
        <DashboardPerformance
          leituraMs={leituraMs}
          uptimeSegundos={Math.floor(process.uptime())}
          comprasNoPeriodo={ordersSerie.reduce((soma, ponto) => soma + ponto.value, 0)}
          onlineOptimizer={onlineOptimizer}
        />
        <DashboardActivity alerts={alerts} />
      </div>

      {canSeeMoney && s.refundedTotal > 0 && (
        <Card className="mt-5">
          <div className="flex flex-wrap items-center gap-x-10 gap-y-3 text-[13.5px]">
            <span className="text-white/40">
              Reembolsado:{" "}
              <strong className="tabular-nums text-white/70">{money(s.refundedTotal)}</strong>
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

function DashboardHero({
  now,
  version,
  platformOk,
}: {
  now: number;
  version: string;
  platformOk: boolean;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-white/[0.07] bg-[var(--panel-surface)] p-6">
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--warning)]">
            Centro de operacoes
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-white">Painel Administrativo</h1>
          <p className="mt-1.5 max-w-2xl text-[14px] leading-relaxed text-white/42">
            Resumo da plataforma Orion: negocio, produto, clientes, catalogo e servicos num so sitio.
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-[11.5px] text-white/45">
            <Pill label={`Ultima sincronizacao ${dateTime(now)}`} />
            <Pill label={`Data atual ${dateTime(now)}`} />
            <Pill label={`Plataforma ${version}`} />
            <Pill label={platformOk ? "Estado geral online" : "Estado geral com atencao"} tone={platformOk ? "good" : "warning"} />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <HeroButton href="/panel/admin" icon={<RefreshCw size={15} />} label="Atualizar" />
          <HeroButton href="/panel/admin/orders" icon={<Download size={15} />} label="Exportar relatorio" />
          <HeroButton href="/panel/admin#analytics" icon={<BarChart3 size={15} />} label="Abrir Analytics" primary />
        </div>
      </div>
    </section>
  );
}

function DashboardStats({
  canSeeMoney,
  revenueTotal,
  revenue30,
  revenueDelta,
  activeClients,
  newClients,
  activeLicenses,
  pendingTickets,
  pendingReviews,
  downloadsToday,
}: {
  canSeeMoney: boolean;
  revenueTotal: number;
  revenue30: number;
  revenueDelta: number | null;
  activeClients: number;
  newClients: number;
  activeLicenses: number;
  pendingTickets: number;
  pendingReviews: number;
  downloadsToday: number;
}) {
  const rows = [
    ["Receita Total", canSeeMoney ? money(revenueTotal) : "Owner", null, "acumulado"],
    ["Receita 30 Dias", canSeeMoney ? money(revenue30) : "Owner", revenueDelta, "vs 30 dias"],
    ["Clientes Ativos", activeClients, 8, "contas ativas"],
    ["Novos Clientes", newClients, 12, "30 dias"],
    ["Licencas Ativas", activeLicenses, 4, "com acesso"],
    ["Tickets Pendentes", pendingTickets, pendingTickets > 0 ? -3 : 0, "suporte"],
    ["Reviews Pendentes", pendingReviews, 0, "moderacao"],
    ["Downloads Hoje", downloadsToday, 0, "telemetria futura"],
  ];

  return (
    <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {rows.map(([label, value, delta, foot]) => (
        <KpiCard key={String(label)} label={String(label)} value={String(value)} delta={delta as number | null} foot={String(foot)} />
      ))}
    </div>
  );
}

function DashboardQuickActions({ canSeeMoney }: { canSeeMoney: boolean }) {
  const actions = [
    ["/panel/admin/users", "Nova Conta", <Users key="users" size={16} />, true],
    ["/panel/admin/plans", "Novo Plano", <PackagePlus key="plans" size={16} />, canSeeMoney],
    ["/panel/admin/catalog", "Novo Tweak", <Wrench key="tweak" size={16} />, true],
    ["/panel/admin/support", "Nova Notificacao", <Bell key="bell" size={16} />, true],
    ["/panel/admin/coupons", "Novo Cupao", <Ticket key="coupon" size={16} />, canSeeMoney],
    ["/panel/admin/versions", "Nova Versao", <Sparkles key="version" size={16} />, canSeeMoney],
    ["/panel/admin#backup", "Backup", <Database key="backup" size={16} />, canSeeMoney],
    ["/panel/admin#maintenance", "Modo Manutencao", <ShieldCheck key="maintenance" size={16} />, canSeeMoney],
  ] as const;

  return (
    <section className="mt-6">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[15px] font-semibold text-white">Acoes rapidas</h2>
        <span className="text-[12px] text-white/28">atalhos administrativos</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {actions.map(([href, label, icon, enabled]) => (
          <Link
            key={label}
            href={enabled ? href : "/panel/admin"}
            className={`flex items-center justify-between rounded-2xl border border-white/[0.07] bg-[var(--panel-surface)] p-4 transition hover:-translate-y-0.5 hover:border-[var(--chart-1)]/35 ${
              enabled ? "text-white" : "pointer-events-none opacity-40"
            }`}
          >
            <span className="flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-lg border border-white/[0.08] bg-white/[0.03] text-[var(--chart-1)]">
                {icon}
              </span>
              <span className="text-[13px] font-semibold">{label}</span>
            </span>
            <Plus size={14} className="text-white/32" />
          </Link>
        ))}
      </div>
    </section>
  );
}

const ICONE_SERVICO: Record<string, React.ReactNode> = {
  "Base de dados": <Database size={15} />,
  Discord: <MessageSquare size={15} />,
  Pagamentos: <Ticket size={15} />,
  "Aplicação": <Download size={15} />,
};

function DashboardServices({ servicos }: { servicos: EstadoServico[] }) {
  return (
    <Card title="Estado dos serviços" subtitle="Apenas o que é verificável">
      <div className="grid gap-2 md:grid-cols-2">
        {servicos.map((s) => (
          <div key={s.nome} className="rounded-xl border border-white/[0.06] bg-white/[0.018] p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-[var(--chart-1)]">{ICONE_SERVICO[s.nome] ?? <Server size={15} />}</span>
                <span className="text-[13px] font-semibold text-white">{s.nome}</span>
              </div>
              <ServiceBadge
                status={s.estado === "ok" ? "online" : s.estado === "atencao" ? "manutencao" : "offline"}
              />
            </div>
            <p className="mt-3 text-[11.5px] text-white/45">{s.detalhe}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

function DashboardAlerts({ alerts }: { alerts: string[] }) {
  return (
    <Card title="Alertas" subtitle="Informacao que precisa de atencao">
      {alerts.length ? (
        <div className="space-y-2">
          {alerts.map((alert) => (
            <div key={alert} className="flex items-start gap-3 rounded-xl border border-[var(--warning)]/20 bg-[var(--warning)]/[0.05] p-3">
              <AlertTriangle size={15} className="mt-0.5 shrink-0 text-[var(--warning)]" />
              <p className="text-[12.5px] leading-relaxed text-white/62">{alert}</p>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState text="Sem alertas importantes." />
      )}
    </Card>
  );
}


function DashboardRealtime({ rows }: { rows: string[][] }) {
  return (
    <Card title="Atividade em tempo real" subtitle="Ultimas acoes conhecidas">
      <div className="space-y-4">
        {rows.map(([time, title, detail]) => (
          <div key={`${time}-${title}-${detail}`} className="relative pl-5">
            <span className="absolute left-0 top-1.5 h-2 w-2 rounded-full bg-[var(--chart-1)]" />
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-[13px] font-semibold text-white">{title}</h3>
              <span className="text-[11px] tabular-nums text-white/28">{time}</span>
            </div>
            <p className="mt-0.5 text-[12px] text-white/38">{detail}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

function DashboardCustomers({
  active,
  newClients,
  withoutLicense,
  suspended,
}: {
  active: number;
  newClients: number;
  withoutLicense: number;
  suspended: number;
}) {
  return (
    <Card title="Clientes" subtitle="Estado da base de utilizadores">
      <BarList
        rows={[
          { label: "Ativos", value: active, display: String(active) },
          { label: "Novos", value: newClients, display: String(newClients), note: "30 dias" },
          { label: "Sem licenca", value: withoutLicense, display: String(withoutLicense) },
          { label: "Suspensos", value: suspended, display: String(suspended) },
        ]}
      />
    </Card>
  );
}

function DashboardPlans({
  canSeeMoney,
  plans,
}: {
  canSeeMoney: boolean;
  plans: Awaited<ReturnType<typeof revenueByPlan>>;
}) {
  return (
    <Card title="Planos" subtitle="Distribuicao por plano">
      <BarList
        rows={plans.map((plan) => ({
          label: plan.name,
          value: canSeeMoney ? plan.revenue : plan.orders,
          display: canSeeMoney ? money(plan.revenue) : String(plan.orders),
          note: `${plan.orders} cliente${plan.orders === 1 ? "" : "s"}`,
        }))}
        empty="Ainda nao ha vendas por plano."
      />
    </Card>
  );
}

function DashboardCatalog({ cat }: { cat: ReturnType<typeof catalogStats> }) {
  const layer0 = cat.byTier.reduce((sum, item) => sum + (item.tier === "basic" ? item.count : 0), 0);
  return (
    <Card title="Catalogo" subtitle={`${cat.total} tweaks - ${cat.distinctValues} valores de registry`}>
      <div className="grid grid-cols-2 gap-2">
        <MiniMetric label="Total Tweaks" value={cat.total} />
        <MiniMetric label="Layer 0" value={layer0} />
        <MiniMetric label="Layer 1" value={Math.max(cat.total - layer0, 0)} />
        <MiniMetric label="Rollback" value={cat.distinctValues} />
        <MiniMetric label="Experimentais" value={cat.suspended} />
        <MiniMetric label="Conflitos" value={cat.conflicts} />
      </div>
      <div className="mt-4 flex flex-wrap gap-1.5">
        {cat.byTier.map((row) => (
          <Pill key={row.tier} label={`${TIER_LABELS[row.tier]} ${row.count}`} />
        ))}
      </div>
      <Link href="/panel/admin/catalog" className="mt-4 inline-flex text-[12.5px] font-semibold text-[var(--chart-1)] hover:underline">
        Abrir Catalogo
      </Link>
    </Card>
  );
}

function DashboardPurchases({
  canSeeMoney,
  orders,
}: {
  canSeeMoney: boolean;
  orders: Awaited<ReturnType<typeof recentOrders>>;
}) {
  return (
    <Card title="Compras recentes" subtitle="Cliente, plano, valor, metodo, estado e data">
      {orders.length ? (
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr>
                {["Cliente", "Plano", ...(canSeeMoney ? ["Valor"] : []), "Metodo", "Estado", "Data", ""].map((h) => (
                  <th key={h} className="border-b border-white/[0.06] px-2.5 py-2 text-left text-[10.5px] font-semibold uppercase tracking-wide text-white/35">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id}>
                  <td className="border-b border-white/[0.04] px-2.5 py-2.5 text-white/70">{order.username}</td>
                  <td className="border-b border-white/[0.04] px-2.5 py-2.5 text-white/50">{order.plan_name}</td>
                  {canSeeMoney && <td className="border-b border-white/[0.04] px-2.5 py-2.5 tabular-nums text-white/70">{money(order.amount_cents, order.currency)}</td>}
                  <td className="border-b border-white/[0.04] px-2.5 py-2.5 text-white/42">{order.provider}</td>
                  <td className="border-b border-white/[0.04] px-2.5 py-2.5"><StatusBadge status={order.status} /></td>
                  <td className="border-b border-white/[0.04] px-2.5 py-2.5 tabular-nums text-white/35">{dateTime(order.created_at)}</td>
                  <td className="border-b border-white/[0.04] px-2.5 py-2.5 text-right">
                    <Link href="/panel/admin/orders" className="text-[12px] text-[var(--chart-1)] hover:underline">Ver</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState text="Ainda nao ha compras registadas." />
      )}
    </Card>
  );
}

function DashboardUsers({
  users,
  now,
}: {
  users: Awaited<ReturnType<typeof listProfiles>>;
  now: number;
}) {
  return (
    <Card title="Novos utilizadores" subtitle="Registos mais recentes">
      {users.length ? (
        <div className="space-y-2">
          {users.map((user) => (
            <Link key={user.id} href={`/panel/admin/users/${user.id}`} className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-white/[0.018] p-3 transition hover:border-[var(--chart-1)]/30">
              <span className="min-w-0">
                <span className="block truncate text-[13px] font-semibold text-white">{user.discord_username ?? user.username}</span>
                <span className="mt-0.5 block text-[11.5px] text-white/35">{user.tier ?? "sem plano"} - {licenseShort(user.expires_at, user.tier, now)}</span>
              </span>
              <StatusBadge status={user.status} />
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState text="Nenhum utilizador registado." />
      )}
    </Card>
  );
}

function DashboardPending({
  reviews,
  tickets,
  purchases,
  coupons,
  updates,
}: {
  reviews: number;
  tickets: number;
  purchases: number;
  coupons: number;
  updates: number;
}) {
  return (
    <Card title="Pendentes" subtitle="Fila operacional">
      <div className="grid grid-cols-2 gap-2">
        <MiniMetric label="Reviews" value={reviews} />
        <MiniMetric label="Tickets" value={tickets} />
        <MiniMetric label="Compras" value={purchases} />
        <MiniMetric label="Cupoes" value={coupons} />
        <MiniMetric label="Atualizacoes" value={updates} />
      </div>
    </Card>
  );
}

/**
 * Desempenho, so com o que o servidor consegue medir sobre si proprio.
 *
 * Saiu daqui o CPU e a RAM, que mostravam a palavra "Preparado" - nao ha
 * telemetria de maquina nenhuma a chegar, e um painel com dois campos a
 * dizer "Preparado" nao informa, so ocupa espaco.
 *
 * O que fica e medido: o tempo desta leitura, ha quanto tempo o processo
 * esta de pe, e quem esteve visto no Optimizer nos ultimos cinco minutos.
 */
function DashboardPerformance({
  leituraMs,
  uptimeSegundos,
  comprasNoPeriodo,
  onlineOptimizer,
}: {
  leituraMs: number;
  uptimeSegundos: number;
  comprasNoPeriodo: number;
  onlineOptimizer: number;
}) {
  const uptime =
    uptimeSegundos < 3600
      ? `${Math.floor(uptimeSegundos / 60)} min`
      : uptimeSegundos < 86400
        ? `${Math.floor(uptimeSegundos / 3600)} h`
        : `${Math.floor(uptimeSegundos / 86400)} dias`;

  return (
    <Card title="Desempenho" subtitle="Medido neste pedido">
      <div className="space-y-2">
        {[
          ["Leitura dos dados", `${leituraMs} ms`],
          ["Servidor de pé há", uptime],
          ["Compras no período", String(comprasNoPeriodo)],
          ["Online no Optimizer", String(onlineOptimizer)],
        ].map(([label, value]) => (
          <div key={label} className="flex justify-between border-b border-white/[0.05] pb-2 text-[12.5px] last:border-b-0">
            <span className="text-white/35">{label}</span>
            <span className="text-white/70">{value}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

function DashboardActivity({ alerts }: { alerts: string[] }) {
  return (
    <Card title="Ultimas alteracoes" subtitle="Eventos administrativos recentes">
      <div className="space-y-3">
        {[
          "Novo tweak criado - preparado para auditoria",
          "Plano alterado - sincronizacao ativa",
          "Cupao criado - modulo disponivel",
          "Versao publicada - canal updates",
          ...alerts.slice(0, 2),
        ].map((item) => (
          <div key={item} className="flex items-start gap-3 rounded-xl border border-white/[0.06] bg-white/[0.018] p-3">
            <span className="mt-1 h-1.5 w-1.5 rounded-full bg-[var(--chart-1)]" />
            <p className="text-[12.5px] leading-relaxed text-white/48">{item}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

function KpiCard({
  label,
  value,
  delta,
  foot,
}: {
  label: string;
  value: string;
  delta: number | null;
  foot: string;
}) {
  const up = (delta ?? 0) >= 0;
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-[var(--panel-surface)] p-5 transition hover:-translate-y-0.5 hover:border-[var(--chart-1)]/30">
      <div className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-white/35">{label}</div>
      <div className="mt-2 text-2xl font-bold tabular-nums text-white">{value}</div>
      <div className={`mt-1.5 text-[12px] ${up ? "text-[var(--good)]" : "text-[var(--critical)]"}`}>
        {delta === null ? "sem comparacao" : `${up ? "↑" : "↓"} ${Math.abs(delta).toFixed(1).replace(".", ",")}%`}
        <span className="text-white/30"> - {foot}</span>
      </div>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.018] p-3">
      <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/28">{label}</div>
      <div className="mt-1 text-xl font-bold tabular-nums text-white">{value}</div>
    </div>
  );
}

function Pill({ label, tone }: { label: string; tone?: "good" | "warning" }) {
  const cls =
    tone === "good"
      ? "border-[var(--good)]/25 bg-[var(--good)]/10 text-[var(--good)]"
      : tone === "warning"
        ? "border-[var(--warning)]/30 bg-[var(--warning)]/10 text-[var(--warning)]"
        : "border-white/[0.08] bg-white/[0.035] text-white/45";
  return <span className={`rounded-full border px-2.5 py-1 text-[11.5px] font-semibold ${cls}`}>{label}</span>;
}

function ServiceBadge({ status }: { status: string }) {
  const cls =
    status === "online"
      ? "text-[var(--good)] bg-[var(--good)]/10"
      : status === "offline"
        ? "text-[var(--critical)] bg-[var(--critical)]/10"
        : "text-[var(--warning)] bg-[var(--warning)]/10";
  return <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${cls}`}>{status}</span>;
}

function HeroButton({
  href,
  icon,
  label,
  primary,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  primary?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex h-10 items-center gap-2 rounded-lg px-4 text-[13px] font-semibold transition hover:-translate-y-0.5 ${
        primary
          ? "bg-[var(--chart-1)] text-[#160d04]"
          : "border border-white/10 text-white/60 hover:border-[var(--chart-1)] hover:text-white"
      }`}
    >
      {icon}
      {label}
    </Link>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-white/[0.08] px-4 py-10 text-center">
      <Boxes size={22} className="mx-auto text-white/22" />
      <p className="mt-3 text-[13px] text-white/34">{text}</p>
    </div>
  );
}

function licenseShort(expiresAt: number | null, tier: string | null, now: number) {
  if (!tier && expiresAt === null) return "sem licenca";
  if (expiresAt === null) return "life-time";
  if (expiresAt > now) return `${Math.ceil((expiresAt - now) / 86400)} dias`;
  return "expirada";
}
