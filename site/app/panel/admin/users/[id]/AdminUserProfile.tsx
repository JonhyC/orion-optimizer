"use client";

import { useMemo, useState } from "react";
import {
  Check,
  Clock3,
  Copy,
  Crown,
  FileText,
  HardDrive,
  KeyRound,
  Monitor,
  Receipt,
  ShieldCheck,
  Sparkles,
  UserRound,
} from "lucide-react";
import { setAdminNoteAction, assignPlanAction, setLicenseAction, updateUserAction } from "../../../actions";
import { StatusBadge } from "@/components/panel/Pieces";
import DangerZone from "./DangerZone";
import PasswordReveal from "./PasswordReveal";

type UserDetail = {
  id: number;
  username: string;
  email: string | null;
  role: string;
  role_source: string;
  tier: string | null;
  tier_source: string;
  status: string;
  hwid: string | null;
  expires_at: number | null;
  created_at: number;
  discord_id: string | null;
  discord_username: string | null;
  discord_avatar: string | null;
  discord_avatar_url?: string | null;
  support_started_at: number | null;
  support_expires_at: number | null;
  support_lifetime: number;
  client_version: string | null;
  client_seen_at: number | null;
  password_hash: string;
  client_password: string | null;
  admin_note: string | null;
};

type PlanOption = {
  id: number;
  code: string;
  name: string;
  days: number;
  support_days: number | null;
  active: number;
};

type OrderRow = {
  id: number;
  plan_name: string;
  amount_cents: number;
  currency: string;
  status: string;
  provider: string;
  created_at: number;
  paid_at: number | null;
};

type ActivityRow = {
  id: number;
  action: string;
  detail: string | null;
  ip: string | null;
  created_at: number;
};

type LoginStats = { last_success: number | null; failed_total: number | null };
type Sessions = { optimizer: number | null; website: number | null };

const tabs = [
  "Perfil",
  "Licença",
  "Dispositivos",
  "Compras",
  "Atividade",
  "Segurança",
  "Permissões",
  "Notas",
  "Administração",
] as const;

type Tab = (typeof tabs)[number];

const roleLabels: Record<string, string> = {
  member: "Membro",
  client: "Cliente",
  staff: "Staff",
  developer: "Developer",
  owner: "Owner",
};

const NO_PASSWORD = "!discord";
const CONTROL_SELECT =
  "rounded-xl border border-white/[0.08] bg-[var(--panel-surface-2)] px-3 py-2 text-[13px] text-white outline-none transition-colors focus:border-[var(--chart-1)] disabled:opacity-40";

export default function AdminUserProfile({
  user,
  plans,
  orders,
  activity,
  loginStats,
  sessions,
  tickets,
  isSelf,
  now,
}: {
  user: UserDetail;
  plans: PlanOption[];
  orders: OrderRow[];
  activity: ActivityRow[];
  loginStats: LoginStats;
  sessions: Sessions;
  /**
   * Numero real de tickets desta conta.
   *
   * Era contado a procurar "support" ou "ticket" no texto das accoes de
   * auditoria - e nenhuma accao registada contem essas palavras, por isso
   * o cartao mostrava sempre 0.
   */
  tickets: number;
  isSelf: boolean;
  now: number;
}) {
  const [activeTab, setActiveTab] = useState<Tab>("Perfil");
  const daysLeft = user.expires_at === null ? null : Math.ceil((user.expires_at - now) / 86400);
  const licenseLabel = !hasLicense(user)
    ? "Sem licença"
    : user.expires_at === null
      ? "Life-time"
      : daysLeft !== null && daysLeft > 0
        ? `${daysLeft} dias`
        : "Expirada";
  const supportLabel = supportText(user, now);
  const accountAge = Math.max(0, Math.ceil((now - user.created_at) / 86400));
  const devices = makeDevices(user);

  return (
    <div className="space-y-5">
      <UserHero
        user={user}
        plans={plans}
        isSelf={isSelf}
        licenseLabel={licenseLabel}
        lastLogin={loginStats.last_success}
      />

      {isSelf && (
        <div className="rounded-2xl border border-[var(--warning)]/25 bg-[var(--warning)]/[0.06] px-4 py-3 text-[13px] text-[var(--warning)]">
          Esta é a tua conta. Não podes retirar-te o papel de owner, suspender-te nem apagar-te.
        </div>
      )}

      <UserSummaryCards
        rows={[
          ["Plano", user.tier ?? "Sem plano"],
          ["Licença", licenseLabel],
          ["Suporte", supportLabel],
          ["Compras", String(orders.length)],
          ["Dispositivos", String(devices.length)],
          ["Sessões", `${sessions.optimizer ?? 0}/${sessions.website ?? 0}`],
          ["Tickets", String(tickets)],
          ["Dias de utilização", String(accountAge)],
        ]}
      />

      <section className="rounded-2xl border border-white/[0.07] bg-[var(--panel-surface)]">
        <div className="flex gap-1 overflow-x-auto border-b border-white/[0.06] p-2">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`shrink-0 rounded-xl px-3 py-2 text-[12px] font-semibold transition-colors ${
                activeTab === tab
                  ? "bg-[var(--chart-1)] text-[#120c05]"
                  : "text-white/40 hover:bg-white/[0.04] hover:text-white/70"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="p-5">
          {activeTab === "Perfil" && <ProfileCard user={user} loginStats={loginStats} />}
          {activeTab === "Licença" && <LicenseCard user={user} plans={plans} licenseLabel={licenseLabel} supportLabel={supportLabel} />}
          {activeTab === "Dispositivos" && <DevicesCard devices={devices} userId={user.id} />}
          {activeTab === "Compras" && <PurchasesCard orders={orders} />}
          {activeTab === "Atividade" && <ActivityTimeline activity={activity} />}
          {activeTab === "Segurança" && (
            <SecurityCard
              user={user}
              loginStats={loginStats}
              sessions={sessions}
              /* A auditoria vem por ordem decrescente, portanto o primeiro
                 registo com IP e o mais recente. Antes esta linha dizia
                 "Preparado para API" - o IP sempre esteve aqui. */
              ultimoIp={activity.find((entrada) => entrada.ip)?.ip ?? null}
            />
          )}
          {activeTab === "Permissões" && <PermissionsCard user={user} />}
          {activeTab === "Notas" && <NotesCard userId={user.id} note={user.admin_note} />}
          {activeTab === "Administração" && <DangerZone userId={user.id} username={user.username} isSelf={isSelf} />}
        </div>
      </section>
    </div>
  );
}

function UserHero({
  user,
  plans,
  isSelf,
  licenseLabel,
  lastLogin,
}: {
  user: UserDetail;
  plans: PlanOption[];
  isSelf: boolean;
  licenseLabel: string;
  lastLogin: number | null;
}) {
  return (
    <section className="rounded-2xl border border-[var(--chart-1)]/20 bg-[radial-gradient(circle_at_0%_0%,rgba(214,167,91,0.10),transparent_32%),var(--panel-surface)] p-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 gap-4">
          <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.04] text-white/45">
            {user.discord_avatar_url ? <img src={user.discord_avatar_url} alt="" className="h-full w-full object-cover" /> : <UserRound size={30} />}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-2xl font-bold tracking-tight text-white">{user.discord_username ?? user.username}</h1>
              <RoleBadge label={roleLabels[user.role] ?? user.role} />
              {user.tier && <RoleBadge label={user.tier} />}
              <StatusBadge status={user.status} />
            </div>
            <p className="mt-1.5 text-[13px] text-white/40">@{user.username}</p>
            <div className="mt-4 flex flex-wrap gap-2 text-[11.5px] text-white/45">
              <span className="rounded-full border border-white/[0.07] px-2.5 py-1">{user.discord_id ? "Discord verificado" : "Discord por ligar"}</span>
              <span className="rounded-full border border-white/[0.07] px-2.5 py-1">Criada em {formatDate(user.created_at)}</span>
              <span className="rounded-full border border-white/[0.07] px-2.5 py-1">Último login {lastLogin ? formatDate(lastLogin) : "sem registo"}</span>
              <span className="rounded-full border border-white/[0.07] px-2.5 py-1">{licenseLabel}</span>
            </div>
          </div>
        </div>

        <form action={updateUserAction} className="grid min-w-[280px] gap-3 rounded-2xl border border-white/[0.06] bg-black/10 p-4">
          <input type="hidden" name="userId" value={user.id} />
          <input type="hidden" name="days" value="30" />
          <div className="grid grid-cols-2 gap-2">
            <select name="tier" defaultValue={user.tier ?? ""} className={CONTROL_SELECT} title="Alterar Plano">
              <option value="">sem plano</option>
              {plans.map((p) => <option key={p.id} value={p.code}>{p.code}</option>)}
            </select>
            <select name="role" defaultValue={user.role} disabled={isSelf} className={CONTROL_SELECT} title="Alterar Cargo">
              {["member", "client", "staff", "developer", "owner"].map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <select name="status" defaultValue={user.status} disabled={isSelf} className={CONTROL_SELECT} title="Estado da conta">
            <option value="active">active</option>
            <option value="suspended">suspended</option>
          </select>
          <div className="grid grid-cols-2 gap-2">
            <button className="rounded-xl bg-[var(--chart-1)] px-3 py-2 text-[12px] font-bold text-[#120c05] transition-opacity hover:opacity-90">Alterar</button>
            <button formAction={setLicenseAction} name="mode" value="add" className="rounded-xl border border-white/10 px-3 py-2 text-[12px] font-bold text-white/70 transition-colors hover:border-[var(--chart-1)] hover:text-white">
              Renovar
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button disabled={isSelf} name="status" value="suspended" className="rounded-xl border border-[var(--warning)]/30 px-3 py-2 text-[12px] font-bold text-[var(--warning)] transition-colors hover:bg-[var(--warning)]/10 disabled:opacity-30">Suspender</button>
            <button disabled={isSelf} name="status" value="suspended" className="rounded-xl border border-[var(--critical)]/30 px-3 py-2 text-[12px] font-bold text-[var(--critical)] transition-colors hover:bg-[var(--critical)]/10 disabled:opacity-30">Banir</button>
          </div>
        </form>
      </div>
    </section>
  );
}

function UserSummaryCards({ rows }: { rows: Array<[string, string]> }) {
  const icons = [Crown, ShieldCheck, Sparkles, Receipt, Monitor, KeyRound, FileText, Clock3];
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {rows.map(([label, value], index) => {
        const Icon = icons[index] ?? ShieldCheck;
        return (
          <div key={label} className="rounded-2xl border border-white/[0.07] bg-[var(--panel-surface)] p-4 transition-colors hover:border-[var(--chart-1)]/25">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/35"><Icon size={14} />{label}</div>
            <div className="mt-2 truncate text-xl font-bold tracking-tight text-white">{value}</div>
          </div>
        );
      })}
    </div>
  );
}

function ProfileCard({ user, loginStats }: { user: UserDetail; loginStats: LoginStats }) {
  return (
    <InfoGrid
      rows={[
        ["Avatar", user.discord_avatar_url ? "Discord" : "Sem avatar"],
        ["Discord", user.discord_username ?? "não ligado"],
        ["ID Discord", <CopyValue key="discord" value={user.discord_id} empty="não ligado" />],
        ["Username", user.username],
        ["Email", user.email ?? "não definido"],
        ["Data de criação", formatDate(user.created_at)],
        ["Idioma", "pt-PT"],
        ["Região", "Sistema"],
        ["Estado", <StatusBadge key="status" status={user.status} />],
        ["Último login", loginStats.last_success ? formatDate(loginStats.last_success) : "sem registo"],
      ]}
    />
  );
}

function LicenseCard({ user, plans, licenseLabel, supportLabel }: { user: UserDetail; plans: PlanOption[]; licenseLabel: string; supportLabel: string }) {
  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
      <InfoGrid
        rows={[
          ["Plano", user.tier ?? "Sem plano"],
          ["Tipo de licença", user.expires_at === null && hasLicense(user) ? "Life-time" : "Por dias"],
          ["Estado", licenseLabel],
          ["Data criação", formatDate(user.created_at)],
          ["Expiração", !hasLicense(user) ? "sem licença" : user.expires_at === null ? "life-time" : formatDate(user.expires_at)],
          ["Suporte", supportLabel],
          ["Quem atribuiu", user.tier_source === "manual" ? "Administração" : "Discord"],
        ]}
      />
      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
        <form action={assignPlanAction} className="space-y-3">
          <input type="hidden" name="userId" value={user.id} />
          <select name="planId" defaultValue={plans.find((p) => p.code === user.tier)?.id ?? plans[0]?.id} className={`${CONTROL_SELECT} w-full`}>
            {plans.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.days === 0 ? "Life-time" : `${p.days} dias`})</option>)}
          </select>
          <button name="mode" value="assign" className="w-full rounded-xl bg-[var(--chart-1)] py-2 text-[12px] font-bold text-[#120c05]">Alterar plano</button>
          <button name="mode" value="clear" className="w-full rounded-xl border border-[var(--critical)]/30 py-2 text-[12px] font-bold text-[var(--critical)]">Revogar</button>
        </form>
        <form action={setLicenseAction} className="mt-4 grid grid-cols-[1fr_auto_auto] gap-2">
          <input type="hidden" name="userId" value={user.id} />
          <input name="days" defaultValue="30" className={`${CONTROL_SELECT} min-w-0`} />
          <button name="mode" value="add" className="rounded-xl border border-white/10 px-3 text-[12px] font-bold text-white/70">Renovar</button>
          <button name="mode" value="set" className="rounded-xl border border-white/10 px-3 text-[12px] font-bold text-white/70">Duração</button>
        </form>
      </div>
      {/* A auditoria nao distingue accoes de licenca das outras, portanto
          nao ha historico proprio para mostrar aqui. A seccao existia com
          uma lista vazia e a legenda "preparado para integracao", que se
          le como se os dados estivessem para chegar. O historico completo
          esta na linha do tempo da conta. */}
    </div>
  );
}

function DevicesCard({ devices, userId }: { devices: ReturnType<typeof makeDevices>; userId: number }) {
  if (!devices.length) return <EmptyState title="Sem dispositivos associados" text="O primeiro login no cliente Windows vai associar o computador." />;
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {devices.map((device) => (
        <div key={device.hwid} className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
          <div className="flex items-start justify-between gap-3">
            <div><h3 className="font-semibold text-white">{device.name}</h3><p className="mt-1 font-mono text-[11px] text-white/35">{device.hwid}</p></div>
            <CopyButton value={device.hwid} label="Copiar Hardware ID" />
          </div>
          <InfoGrid compact rows={[["Versão Orion", device.version], ["Última ligação", device.lastSeen], ["Estado", device.status]]} />
          <div className="mt-4 flex flex-wrap gap-2">
            <form action={updateUserAction}>
              <input type="hidden" name="userId" value={userId} />
              <button type="button" className="rounded-xl border border-white/10 px-3 py-2 text-[12px] font-bold text-white/60">Ver detalhes</button>
            </form>
            <button className="rounded-xl border border-[var(--warning)]/30 px-3 py-2 text-[12px] font-bold text-[var(--warning)]">Reset Hardware</button>
            <button className="rounded-xl border border-[var(--critical)]/30 px-3 py-2 text-[12px] font-bold text-[var(--critical)]">Remover</button>
          </div>
        </div>
      ))}
    </div>
  );
}

function PurchasesCard({ orders }: { orders: OrderRow[] }) {
  if (!orders.length) return <EmptyState title="Sem compras" text="Quando existirem compras, faturas, cupões e métodos aparecem aqui." />;
  return (
    <DataTable
      headers={["Data", "Plano", "Método", "Valor", "Estado", "Fatura/Cupão"]}
      rows={orders.map((o) => [formatDate(o.created_at), o.plan_name, o.provider, moneyFmt(o.amount_cents, o.currency), o.status, o.paid_at ? "Emitida" : "Pendente"])}
    />
  );
}

function ActivityTimeline({ activity, title = "Timeline", empty = "Sem atividade registada." }: { activity: ActivityRow[]; title?: string; empty?: string }) {
  if (!activity.length) return <EmptyState title={title} text={empty} />;
  return (
    <div>
      <h3 className="mb-4 text-[14px] font-semibold text-white">{title}</h3>
      <div className="space-y-0 border-l border-white/[0.08] pl-5">
        {activity.map((entry) => (
          <div key={entry.id} className="relative pb-6">
            <span className="absolute -left-[25px] top-1 h-2 w-2 rounded-full bg-[var(--chart-1)] shadow-[0_0_18px_rgba(214,167,91,0.45)]" />
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/30">{relativeTime(entry.created_at)}</div>
            <div className="mt-1 font-semibold text-white">{entry.action.replaceAll("_", " ")}</div>
            <div className="mt-1 text-[12px] text-white/35">{entry.detail ?? "Sem detalhe"}{entry.ip ? ` · ${entry.ip}` : ""}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SecurityCard({
  user,
  loginStats,
  sessions,
  ultimoIp,
}: {
  user: UserDetail;
  loginStats: LoginStats;
  sessions: Sessions;
  ultimoIp: string | null;
}) {
  return (
    <div className="space-y-5">
      {/* "Tokens" saiu por ser o mesmo que "Sessoes" - sao tokens
          activos, ja contados na linha de cima. "Ultimo navegador" saiu
          por nao existir: nao guardamos user-agent em lado nenhum. */}
      <InfoGrid rows={[
        ["Sessões ativas", `${sessions.optimizer ?? 0} optimizer / ${sessions.website ?? 0} site`],
        ["Password Windows", user.password_hash === NO_PASSWORD ? "sem password" : <PasswordReveal key="pw" password={user.client_password} />],
        ["Discord ligado", user.discord_id ? "Sim" : "Não"],
        ["Último IP", ultimoIp ?? "sem registo"],
        ["Último dispositivo", user.hwid ?? "nenhum"],
        ["Último login com sucesso", loginStats.last_success ? formatDate(loginStats.last_success) : "sem registo"],
        ["Logins falhados", String(loginStats.failed_total ?? 0)],
      ]} />
      <div className="flex flex-wrap gap-2">
        <button className="rounded-xl border border-white/10 px-3 py-2 text-[12px] font-bold text-white/60">Terminar sessões</button>
        <button className="rounded-xl border border-white/10 px-3 py-2 text-[12px] font-bold text-white/60">Reset Token</button>
        <button className="rounded-xl border border-[var(--warning)]/30 px-3 py-2 text-[12px] font-bold text-[var(--warning)]">Reset Password</button>
      </div>
    </div>
  );
}

/**
 * O que este cargo permite. Leitura, nao controlo.
 *
 * A versao anterior parecia um painel de interruptores - eram <label>
 * com um quadrado desenhado, sem input nenhum por tras, portanto clicar
 * nao fazia nada. Havia ainda um "Beta" que nunca podia ficar activo e
 * uma caixa a dizer "Permissoes adicionais preparadas para API".
 *
 * As permissoes derivam do cargo e do plano; muda-se o cargo no separador
 * Perfil e o plano no separador Licenca. Aqui so se mostra o resultado.
 */
function PermissionsCard({ user }: { user: UserDetail }) {
  const interno = ["staff", "developer", "owner"].includes(user.role);
  const permissoes: Array<[string, boolean, string]> = [
    ["Acesso ao painel", interno, "ver a área de administração"],
    ["Gerir contas", user.role === "owner", "criar, suspender e apagar"],
    ["Gerir catálogo", ["developer", "owner"].includes(user.role), "otimizações e compatibilidade"],
    ["Responder a suporte", interno, "tickets dos clientes"],
    ["Cliente Windows", interno || user.tier !== null, "descarregar e usar o Optimizer"],
    ["Otimizações Special", user.tier === "special", "exclusivas do plano Special"],
  ];

  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {permissoes.map(([nome, activa, detalhe]) => (
          <div
            key={nome}
            className="flex items-start justify-between gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4"
          >
            <span className="min-w-0">
              <span className="block text-[13px] font-semibold text-white/70">{nome}</span>
              <span className="mt-0.5 block text-[11.5px] text-white/32">{detalhe}</span>
            </span>
            <span
              className={`grid h-6 w-6 shrink-0 place-items-center rounded-md border ${
                activa ? "border-good/30 bg-good/10 text-good" : "border-white/10 text-white/25"
              }`}
              title={activa ? "Permitido" : "Não permitido"}
            >
              {activa ? <Check size={14} /> : "—"}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[12px] text-white/30">
        Derivadas do cargo e do plano. O cargo altera-se no separador Perfil, o plano no separador Licença.
      </p>
    </div>
  );
}

/**
 * Nota interna sobre a conta.
 *
 * Guardava em localStorage: a nota existia so no browser de quem a
 * escreveu, os outros administradores viam o campo vazio, e limpar o
 * browser apagava-a. Agora e um campo do perfil como qualquer outro.
 */
function NotesCard({ userId, note }: { userId: number; note: string | null }) {
  return (
    <form action={setAdminNoteAction}>
      <input type="hidden" name="userId" value={userId} />
      <textarea
        name="note"
        defaultValue={note ?? ""}
        maxLength={2000}
        placeholder="Notas visíveis para toda a administração."
        className="min-h-[180px] w-full resize-y rounded-2xl border border-white/[0.08] bg-[var(--panel-surface-2)] p-4 text-[14px] leading-relaxed text-white outline-none transition-colors placeholder:text-white/20 focus:border-[var(--chart-1)]"
      />
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-[12px] text-white/30">
          Guardada na conta e visível para toda a administração. Máximo 2000 caracteres.
        </p>
        <button
          type="submit"
          className="rounded-xl bg-[var(--chart-1)] px-4 py-2 text-[12px] font-bold text-[#120c05] transition-transform duration-200 hover:scale-[1.03]"
        >
          Guardar nota
        </button>
      </div>
    </form>
  );
}

function InfoGrid({ rows, compact = false }: { rows: Array<[string, React.ReactNode]>; compact?: boolean }) {
  return (
    <dl className={`grid gap-3 ${compact ? "mt-4 sm:grid-cols-2" : "sm:grid-cols-2 xl:grid-cols-3"}`}>
      {rows.map(([label, value]) => (
        <div key={label} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
          <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/30">{label}</dt>
          <dd className="mt-2 min-h-5 break-words text-[13px] text-white/70">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function DataTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-white/[0.06]">
      <table className="w-full min-w-[760px] text-[13px]">
        <thead className="bg-white/[0.025]">
          <tr>{headers.map((h) => <th key={h} className="border-b border-white/[0.06] px-3 py-3 text-left text-[10px] font-semibold uppercase tracking-wide text-white/35">{h}</th>)}</tr>
        </thead>
        <tbody>{rows.map((row, i) => <tr key={i}>{row.map((c, j) => <td key={j} className="border-b border-white/[0.04] px-3 py-3 text-white/60">{j === 4 ? <StatusBadge status={c} /> : c}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

function EmptyState({ title, text }: { title: string; text: string }) {
  return <div className="grid min-h-[220px] place-items-center rounded-2xl border border-dashed border-white/[0.08] bg-white/[0.015] p-6 text-center"><div><div className="mx-auto grid h-11 w-11 place-items-center rounded-xl border border-white/[0.08] text-white/35"><FileText size={18} /></div><h3 className="mt-4 font-semibold text-white/70">{title}</h3><p className="mt-1 text-[13px] text-white/30">{text}</p></div></div>;
}

function RoleBadge({ label }: { label: string }) {
  return <span className="rounded-full border border-[var(--chart-1)]/20 bg-[var(--chart-1)]/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-[var(--chart-1)]">{label}</span>;
}

function CopyValue({ value, empty }: { value: string | null; empty: string }) {
  if (!value) return <span className="text-white/30">{empty}</span>;
  return <span className="inline-flex max-w-full items-center gap-2"><span className="truncate font-mono">{value}</span><CopyButton value={value} label="Copiar" /></span>;
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      title={label}
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      }}
      className="grid h-7 w-7 shrink-0 place-items-center rounded-md border border-white/10 text-white/40 transition-colors hover:border-[var(--chart-1)]/30 hover:text-white"
    >
      {copied ? <Check size={13} /> : <Copy size={13} />}
    </button>
  );
}

function makeDevices(user: UserDetail) {
  if (!user.hwid) return [];
  return [{
    name: "PC principal",
    hwid: user.hwid,

    version: user.client_version ?? "sem versão",
    lastSeen: user.client_seen_at ? formatDate(user.client_seen_at) : "sem ligação",
    status: user.client_seen_at ? "Ativo" : "Pendente",
  }];
}

function hasLicense(user: UserDetail) {
  return user.tier !== null || user.expires_at !== null;
}

function supportText(user: UserDetail, now: number) {
  if (user.support_lifetime === 1) return "Life-time";
  if (user.support_expires_at && user.support_expires_at > now) {
    return `${Math.ceil((user.support_expires_at - now) / 86400)} dias`;
  }
  if (user.support_started_at || user.support_expires_at) return "Expirado";
  return "Sem suporte";
}

function formatDate(ts: number) {
  return new Date(ts * 1000).toLocaleString("pt-PT", { dateStyle: "short", timeStyle: "short" });
}

function relativeTime(timestamp: number | null): string {
  if (!timestamp) return "Sem registo";
  const seconds = Math.max(0, Math.floor(Date.now() / 1000 - timestamp));
  if (seconds < 60) return "Hoje";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min`;
  if (seconds < 86400) return "Hoje";
  if (seconds < 172800) return "Ontem";
  return `${Math.floor(seconds / 86400)} dias`;
}

function moneyFmt(cents: number, currency = "EUR") {
  return new Intl.NumberFormat("pt-PT", { style: "currency", currency }).format(cents / 100);
}
