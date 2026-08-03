import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Activity,
  CalendarDays,
  Check,
  ExternalLink,
  HardDrive,
  Headphones,
  KeyRound,
  MessageCircle,
  MonitorCog,
  ReceiptText,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { Card, StatTile, StatusBadge } from "@/components/panel/Pieces";
import { DISCORD_URL } from "@/lib/data";
import { nowSeconds, NO_PASSWORD } from "@/lib/db";
import { auditForUser } from "@/lib/repo/audit";
import { processExpiredPlans } from "@/lib/plan-expiry";
import { requireUser, roleAtLeast } from "@/lib/session";
import { dateTime, money, ordersForUser } from "@/lib/stats";
import { optimizerRelease, releaseForPlan, updateStatus } from "@/lib/optimizer-release";
import { findAppVersionTarget } from "@/lib/repo/app-versions";
import { findPlanByCode } from "@/lib/repo/plans";
import OptimizerActions from "../OptimizerActions";
import CredentialsModalButton from "./CredentialsModalButton";

export const dynamic = "force-dynamic";

type PersonalPlan = {
  name: string;
  description: string | null;
  price_cents: number;
  currency: string;
  days: number;
  support_days: number | null;
  cover_url: string | null;
  app_version: string | null;
  app_min_supported: string | null;
};

type ActivityRow = { action: string; created_at: number };

/** Accoes que valem a pena mostrar ao cliente. As restantes sao ruido interno. */
const ACTIVITY_ACTIONS = new Set([
  "login_ok",
  "login_discord_verified",
  "catalog_served",
  "hwid_bound",
  "client_password_generated",
  "panel_login_ok",
  "logout",
  "discord_plan_roles_synced",
  "self_hwid_reset",
]);

const ACTIVITY_LABEL: Record<string, string> = {
  login_ok: "Sessao iniciada no Orion Optimizer 2.0",
  login_discord_verified: "Cargos Discord verificados",
  catalog_served: "Catalogo de otimizacoes carregado",
  hwid_bound: "Computador associado a licenca",
  self_hwid_reset: "Computador removido da licenca",
  client_password_generated: "Credenciais Windows atualizadas",
  panel_login_ok: "Sessao iniciada no painel",
  logout: "Sessao do Optimizer terminada",
  discord_plan_roles_synced: "Cargo do plano sincronizado no Discord",
};

export default async function PersonalDashboardPage() {
  await processExpiredPlans();
  const user = await requireUser();
  const baseRelease = optimizerRelease();
  const now = nowSeconds();
  const internalAccess = roleAtLeast(user, "staff");
  const activePlan = Boolean(
    user.tier && (user.expires_at === null || user.expires_at > now),
  );

  if (!activePlan && !internalAccess) redirect("/panel");

  const plan = user.tier
    ? ((await findPlanByCode(user.tier)) as PersonalPlan | null) ?? undefined
    : undefined;
  const roleRelease = !plan && (user.role === "staff" || user.role === "developer")
    ? await findAppVersionTarget(`role:${user.role}`)
    : null;
  const release = releaseForPlan(baseRelease, plan ?? roleRelease);
  const updater = updateStatus(release, user.client_version);
  const orders = await ordersForUser(user.id);
  const paidOrders = orders.filter((order) => order.status === "paid");
  const totalSpent = paidOrders.reduce((sum, order) => sum + order.amount_cents, 0);
  // Filtra-se em memoria e nao no Firestore de proposito: um `where` por
  // accao alem do `where` por utilizador exigiria um indice composto
  // (user_id, action, created_at) so para esta lista. Buscar 40 e ficar
  // com 7 sai mais barato do que manter mais um indice.
  const activity: ActivityRow[] = (await auditForUser(user.id, 40))
    .filter((entrada) => ACTIVITY_ACTIONS.has(entrada.action))
    .slice(0, 7)
    .map((entrada) => ({ action: entrada.action, created_at: entrada.created_at }));

  const licenseText = internalAccess && !user.tier
    ? "Acesso interno"
    : user.expires_at === null
      ? "Life-time"
      : `${Math.max(0, Math.ceil((user.expires_at - now) / 86400))} dias`;
  const supportText = user.support_lifetime === 1
    ? "Life-time"
    : user.support_expires_at && user.support_expires_at > now
      ? `${Math.ceil((user.support_expires_at - now) / 86400)} dias`
      : "Nao incluido";
  const planName = plan?.name ?? (internalAccess ? "Equipa Orion" : user.tier ?? "Sem plano");

  return (
    <>
      <div className={updater.outdated ? "relative" : "grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start"}>
        <div className="min-w-0">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--chart-1)]">
              Area pessoal
            </div>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-white">Dashboard</h1>
            <p className="mt-1.5 text-[14px] text-white/40">
              Bem-vindo, {user.discord_username ?? user.username}. Aqui tens o resumo do teu acesso Orion.
            </p>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile label="Plano atual" value={planName} foot={user.tier ?? "acesso por cargo"} />
            <StatTile label="Licenca" value={licenseText} foot="acesso ativo" />
            <StatTile label="Support Plan" value={supportText} foot={supportText === "Nao incluido" ? "sem cobertura ativa" : "cobertura ativa"} />
            <StatTile
              label="Compras"
              value={String(paidOrders.length)}
              foot={paidOrders.length ? `${money(totalSpent)} investidos` : "nenhuma compra registada"}
            />
          </div>
        </div>

        <aside
          className={
            updater.outdated
              ? "mt-5 min-w-0 lg:fixed lg:bottom-5 lg:right-5 lg:z-50 lg:mt-0 lg:w-[360px] lg:drop-shadow-2xl"
              : "min-w-0 lg:sticky lg:top-24"
          }
        >
          <OptimizerActions installedVersion={user.client_version} release={release} dismissible={updater.outdated} />
        </aside>
      </div>

      <div className="mt-5 grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[1.2fr_0.8fr]">
        <Card title="O teu acesso" subtitle="Plano, duracao e funcionalidades associadas">
          <div className="flex flex-col gap-5 sm:flex-row">
            {plan?.cover_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={plan.cover_url} alt={`Capa ${plan.name}`} className="aspect-video w-full rounded-lg object-cover sm:w-52" />
            ) : (
              <div className="grid aspect-video w-full shrink-0 place-items-center rounded-lg border border-white/[0.06] bg-[var(--panel-surface-2)] text-[var(--chart-1)] sm:w-52">
                <MonitorCog size={30} />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-[18px] font-semibold text-white">{planName}</h2>
                <StatusBadge status="active" />
              </div>
              <p className="mt-2 text-[13px] leading-5 text-white/40">
                {plan?.description ?? "Acesso interno ao Orion Optimizer 2.0 e ao catalogo de otimizacoes."}
              </p>
              <div className="mt-4 grid gap-2 text-[12.5px] text-white/45 sm:grid-cols-2">
                <span className="flex items-center gap-2"><CalendarDays size={14} />Licenca: {licenseText}</span>
                <span className="flex items-center gap-2"><Headphones size={14} />Suporte: {supportText}</span>
                <span className="flex items-center gap-2"><ShieldCheck size={14} />Discord verificado</span>
                <span className="flex items-center gap-2"><HardDrive size={14} />{user.hwid ? "PC associado" : "PC por associar"}</span>
              </div>
            </div>
          </div>
        </Card>

        <Card title="Estado da conta" subtitle="Requisitos para utilizar o cliente Windows">
          <div className="space-y-3">
            <AccessCheck icon={<UserRound size={15} />} label="Conta Orion ativa" ready={user.status === "active"} />
            <AccessCheck icon={<MessageCircle size={15} />} label="Discord ligado" ready={Boolean(user.discord_id)} />
            <AccessCheck icon={<HardDrive size={15} />} label="Computador associado" ready={Boolean(user.hwid)} optional="feito no primeiro login" />
            <AccessCheck
              icon={<KeyRound size={15} />}
              label="Credenciais Windows"
              ready={user.password_hash !== NO_PASSWORD}
              optional="gerir na conta"
              action={<CredentialsModalButton username={user.username} password={user.client_password} hasPassword={user.password_hash !== NO_PASSWORD} />}
            />
          </div>
          <Link href="/panel" className="mt-5 inline-flex items-center gap-2 text-[12.5px] font-semibold text-[var(--chart-1)] hover:underline">
            Gerir perfil e credenciais
            <ExternalLink size={13} />
          </Link>
        </Card>
      </div>

      <div className="mt-5 grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[1.2fr_0.8fr]">
        <Card title="Atividade recente" subtitle="Verificacoes e acessos desta conta">
          {activity.length === 0 ? (
            <p className="py-8 text-center text-[13px] text-white/30">Ainda nao existe atividade registada.</p>
          ) : (
            <div className="divide-y divide-white/[0.05]">
              {activity.map((item, index) => (
                <div key={`${item.action}-${item.created_at}-${index}`} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-[var(--chart-1)]/10 text-[var(--chart-1)]">
                    <Activity size={14} />
                  </div>
                  <div className="min-w-0 flex-1 truncate text-[13px] text-white/60">
                    {ACTIVITY_LABEL[item.action] ?? "Atividade da conta"}
                  </div>
                  <time className="shrink-0 text-[11.5px] tabular-nums text-white/25">
                    {dateTime(item.created_at)}
                  </time>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card title="Acessos rapidos">
          <div className="grid gap-2.5">
            <QuickLink href="/panel" icon={<UserRound size={16} />} title="A minha conta" text="Password, maquina e compras" />
            <QuickLink href="/#packages" icon={<ReceiptText size={16} />} title="Planos Orion" text="Ver planos e coberturas" />
            <QuickLink href={DISCORD_URL} icon={<MessageCircle size={16} />} title="Suporte Discord" text="Falar com a equipa Orion" external />
          </div>
        </Card>
      </div>
    </>
  );
}

function AccessCheck({
  icon,
  label,
  ready,
  optional,
  action,
}: {
  icon: React.ReactNode;
  label: string;
  ready: boolean;
  optional?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 text-[12.5px]">
      <span className="text-white/35">{icon}</span>
      <span className="flex-1 text-white/55">{label}</span>
      <span className={`inline-flex items-center gap-1.5 ${ready ? "text-[var(--good)]" : "text-white/25"}`}>
        {ready ? <><Check size={13} />Pronto</> : optional ?? "Pendente"}
      </span>
      {action}
    </div>
  );
}

function QuickLink({
  href,
  icon,
  title,
  text,
  external = false,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  text: string;
  external?: boolean;
}) {
  const classes = "flex items-center gap-3 rounded-lg border border-white/[0.06] bg-[var(--panel-surface-2)] px-3.5 py-3 transition-colors hover:border-[var(--chart-1)]/30";
  const content = <><span className="text-[var(--chart-1)]">{icon}</span><span><strong className="block text-[12.5px] font-semibold text-white/70">{title}</strong><small className="mt-0.5 block text-[11px] text-white/30">{text}</small></span></>;
  return external
    ? <a href={href} className={classes}>{content}</a>
    : <Link href={href} className={classes}>{content}</Link>;
}
