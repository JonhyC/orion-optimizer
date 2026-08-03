import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Activity,
  AlertTriangle,
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
import { dateTime, ordersForUser } from "@/lib/stats";
import {
  ACCOES_VISIVEIS,
  estadoDaLicenca,
  estadoDoSuporte,
  requisitosDeAcesso,
  requisitosEmFalta,
  rotuloDeAtividade,
  totalGasto,
} from "@/lib/personal-dashboard";
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

/** Icone por requisito. A lista em si vive em lib/personal-dashboard. */
const REQUISITO_ICONE: Record<string, React.ReactNode> = {
  conta: <UserRound size={15} />,
  discord: <MessageCircle size={15} />,
  computador: <HardDrive size={15} />,
  credenciais: <KeyRound size={15} />,
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
  // Filtra-se em memoria e nao no Firestore de proposito: um `where` por
  // accao alem do `where` por utilizador exigiria um indice composto
  // (user_id, action, created_at) so para esta lista. Buscar 40 e ficar
  // com 7 sai mais barato do que manter mais um indice. Sao 20 e nao 40
  // porque cada documento lido conta para a quota diaria do Firestore.
  const activity: ActivityRow[] = (await auditForUser(user.id, 20))
    .filter((entrada) => ACCOES_VISIVEIS.has(entrada.action))
    .slice(0, 7)
    .map((entrada) => ({ action: entrada.action, created_at: entrada.created_at }));

  const licenca = estadoDaLicenca({
    tier: user.tier,
    expiresAt: user.expires_at,
    agora: now,
    acessoInterno: internalAccess,
    contaSuspensa: user.status === "suspended",
  });
  const suporte = estadoDoSuporte({
    supportLifetime: user.support_lifetime,
    supportExpiresAt: user.support_expires_at,
    agora: now,
  });
  const requisitos = requisitosDeAcesso({
    contaAtiva: user.status === "active",
    discordLigado: Boolean(user.discord_id),
    computadorAssociado: Boolean(user.hwid),
    credenciaisGeradas: user.password_hash !== NO_PASSWORD,
  });
  const emFalta = requisitosEmFalta(requisitos);
  const planName = plan?.name ?? (internalAccess ? "Equipa Orion" : user.tier ?? "Sem plano");

  return (
    <>
      <div className={updater.outdated ? "relative" : "grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start"}>
        <div className="min-w-0">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--chart-1)]">
              Área pessoal
            </div>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-white">Dashboard</h1>
            <p className="mt-1.5 text-[14px] text-white/40">
              Bem-vindo, {user.discord_username ?? user.username}. Aqui tens o resumo do teu acesso Orion.
            </p>
          </div>

          {/* So aparece quando ha mesmo algo a fazer. Um aviso permanente
              deixa de ser lido ao fim da segunda visita. */}
          {licenca.urgente && (
            <div className="mt-6 flex flex-wrap items-center gap-3 rounded-xl border border-[var(--warning)]/25 bg-[var(--warning)]/[0.07] px-4 py-3">
              <AlertTriangle size={16} className="shrink-0 text-[var(--warning)]" />
              <p className="min-w-0 flex-1 text-[13px] text-white/65">
                {licenca.texto === "Suspensa"
                  ? "A tua conta está suspensa. Fala com a equipa para a reativar."
                  : licenca.diasRestantes === 0
                    ? "A tua licença expirou. Renova para voltares a usar o Orion Optimizer."
                    : `A tua licença termina em ${licenca.texto}. Renova para não perderes o acesso.`}
              </p>
              <Link
                href={licenca.texto === "Suspensa" ? DISCORD_URL : "/#packages"}
                className="shrink-0 text-[12.5px] font-semibold text-[var(--warning)] hover:underline"
              >
                {licenca.texto === "Suspensa" ? "Falar com a equipa" : "Ver planos"}
              </Link>
            </div>
          )}

          <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile label="Plano atual" value={planName} foot={user.tier ?? "acesso por cargo"} />
            <StatTile label="Licença" value={licenca.texto} foot={licenca.nota} />
            <StatTile label="Support Plan" value={suporte.texto} foot={suporte.nota} />
            <StatTile
              label="Compras"
              value={String(paidOrders.length)}
              foot={paidOrders.length ? `${totalGasto(orders)} investidos` : "nenhuma compra registada"}
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
        <Card title="O teu acesso" subtitle="Plano, duração e funcionalidades associadas">
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
                {/* Derivado, nao fixo: dizia sempre "Ativa" mesmo com a
                    licenca expirada ou a conta suspensa. */}
                <StatusBadge status={licenca.badge} />
              </div>
              <p className="mt-2 text-[13px] leading-5 text-white/40">
                {plan?.description ?? "Acesso interno ao Orion Optimizer e ao catálogo de otimizações."}
              </p>
              <div className="mt-4 grid gap-2 text-[12.5px] text-white/45 sm:grid-cols-2">
                <span className="flex items-center gap-2"><CalendarDays size={14} />Licença: {licenca.texto}</span>
                <span className="flex items-center gap-2"><Headphones size={14} />Suporte: {suporte.texto}</span>
                {/* Estava escrito a mao como "Discord verificado" e aparecia
                    mesmo em contas sem Discord - a contradizer o cartao ao lado. */}
                <span className="flex items-center gap-2">
                  <ShieldCheck size={14} />
                  {user.discord_id ? "Discord verificado" : "Discord por ligar"}
                </span>
                <span className="flex items-center gap-2"><HardDrive size={14} />{user.hwid ? "PC associado" : "PC por associar"}</span>
              </div>
            </div>
          </div>
        </Card>

        <Card
          title="Estado da conta"
          subtitle={
            emFalta === 0
              ? "Está tudo pronto para usar o cliente Windows"
              : `${emFalta} ${emFalta === 1 ? "passo em falta" : "passos em falta"} para usar o cliente Windows`
          }
        >
          <div className="space-y-3">
            {requisitos.map((requisito) => (
              <AccessCheck
                key={requisito.id}
                icon={REQUISITO_ICONE[requisito.id]}
                label={requisito.label}
                ready={requisito.pronto}
                optional={requisito.pendente}
                action={
                  requisito.id === "credenciais" ? (
                    <CredentialsModalButton
                      username={user.username}
                      password={user.client_password}
                      hasPassword={user.password_hash !== NO_PASSWORD}
                    />
                  ) : undefined
                }
              />
            ))}
          </div>
          <Link href="/panel" className="mt-5 inline-flex items-center gap-2 text-[12.5px] font-semibold text-[var(--chart-1)] hover:underline">
            Gerir perfil e credenciais
            <ExternalLink size={13} />
          </Link>
        </Card>
      </div>

      <div className="mt-5 grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[1.2fr_0.8fr]">
        <Card title="Atividade recente" subtitle="Verificações e acessos desta conta">
          {activity.length === 0 ? (
            <p className="py-8 text-center text-[13px] text-white/30">
              Ainda não existe atividade registada. Aparece aqui assim que iniciares sessão no Orion Optimizer.
            </p>
          ) : (
            <div className="divide-y divide-white/[0.05]">
              {activity.map((item, index) => (
                <div key={`${item.action}-${item.created_at}-${index}`} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-[var(--chart-1)]/10 text-[var(--chart-1)]">
                    <Activity size={14} />
                  </div>
                  <div className="min-w-0 flex-1 truncate text-[13px] text-white/60">
                    {rotuloDeAtividade(item.action)}
                  </div>
                  <time className="shrink-0 text-[11.5px] tabular-nums text-white/25">
                    {dateTime(item.created_at)}
                  </time>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card title="Acessos rápidos">
          <div className="grid gap-2.5">
            <QuickLink href="/panel" icon={<UserRound size={16} />} title="A minha conta" text="Password, máquina e compras" />
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
