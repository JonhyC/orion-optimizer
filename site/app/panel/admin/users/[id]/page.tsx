import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireRole } from "@/lib/session";
import { getDb, nowSeconds, NO_PASSWORD, type User } from "@/lib/db";
import { dateTime, money, ordersForUser } from "@/lib/stats";
import { Card, StatusBadge } from "@/components/panel/Pieces";
import { assignPlanAction, setLicenseAction, updateUserAction } from "../../../actions";
import DangerZone from "./DangerZone";
import PasswordReveal from "./PasswordReveal";

export const dynamic = "force-dynamic";

export default async function UserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const actor = await requireRole("owner");
  const { id } = await params;

  const user = getDb().prepare("SELECT * FROM users WHERE id = ?").get(Number(id)) as
    | User
    | undefined;
  if (!user) notFound();
  const plans = getDb()
    .prepare("SELECT id, code, name, days, support_days, active FROM plans ORDER BY sort_order, id")
    .all() as Array<{
      id: number;
      code: string;
      name: string;
      days: number;
      support_days: number | null;
      active: number;
    }>;

  const isSelf = actor.id === user.id;
  const orders = ordersForUser(user.id);
  const now = nowSeconds();
  const loginStats = getDb()
    .prepare(
      `SELECT
         MAX(CASE WHEN success = 1 THEN created_at END) AS last_success,
         SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) AS failed_total
       FROM login_attempts
       WHERE username = ?`,
    )
    .get(user.username) as { last_success: number | null; failed_total: number | null };
  const sessions = getDb()
    .prepare(
      `SELECT
         SUM(CASE WHEN kind = 'api' AND expires_at > ? THEN 1 ELSE 0 END) AS optimizer,
         SUM(CASE WHEN kind = 'web' AND expires_at > ? THEN 1 ELSE 0 END) AS website
       FROM tokens
       WHERE user_id = ?`,
    )
    .get(now, now, user.id) as { optimizer: number | null; website: number | null };
  const activity = getDb()
    .prepare(
      `SELECT id, action, detail, ip, created_at
       FROM audit_log
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT 10`,
    )
    .all(user.id) as Array<{
      id: number;
      action: string;
      detail: string | null;
      ip: string | null;
      created_at: number;
    }>;
  const hasLicense = user.tier !== null || user.expires_at !== null;
  const daysLeft =
    user.expires_at === null ? null : Math.ceil((user.expires_at - now) / 86400);
  const hasSupport =
    user.support_lifetime === 1 ||
    user.support_started_at !== null ||
    user.support_expires_at !== null;
  const supportActive =
    user.support_lifetime === 1 ||
    (user.support_expires_at !== null && user.support_expires_at > now);
  const supportDaysLeft =
    user.support_expires_at === null
      ? null
      : Math.max(0, Math.ceil((user.support_expires_at - now) / 86400));

  return (
    <>
      <Link
        href="/panel/admin/users"
        className="inline-flex items-center gap-2 text-[13px] text-white/40 transition-colors hover:text-white"
      >
        <ArrowLeft size={14} />
        Contas
      </Link>

      <h1 className="mt-4 text-2xl font-bold tracking-tight text-white">{user.username}</h1>
      <p className="mt-1.5 text-[14px] text-white/40">
        {user.discord_username ? `Discord: ${user.discord_username}` : "Conta local"}
        {" · "}criada em {dateTime(user.created_at)}
      </p>

      {isSelf && (
        <div className="mt-6 rounded-xl border border-[var(--warning)]/25 bg-[var(--warning)]/[0.06] px-4 py-3 text-[13px] text-[var(--warning)]">
          Esta é a tua conta. Não podes retirar-te o papel de owner, suspender-te
          nem apagares-te — é o que impede o painel de ficar sem ninguém com acesso.
        </div>
      )}

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <Card title="Papel e plano">
          <form action={updateUserAction} className="space-y-4">
            <input type="hidden" name="userId" value={user.id} />

            <div>
              <label className="block text-[12px] font-medium text-white/50">Papel</label>
              <select
                name="role"
                defaultValue={user.role}
                disabled={isSelf}
                className="mt-1.5 w-full rounded-lg border border-white/[0.08] bg-[var(--panel-surface-2)] px-3 py-2 text-[14px] text-white outline-none focus:border-[var(--chart-1)] disabled:opacity-40"
              >
                {["member", "client", "staff", "developer", "owner"].map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[12px] font-medium text-white/50">Plano</label>
              <select
                name="tier"
                defaultValue={user.tier ?? ""}
                className="mt-1.5 w-full rounded-lg border border-white/[0.08] bg-[var(--panel-surface-2)] px-3 py-2 text-[14px] text-white outline-none focus:border-[var(--chart-1)]"
              >
                <option value="">sem plano</option>
                {plans.map((p) => (
                  <option key={p.id} value={p.code}>
                    {p.code}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[12px] font-medium text-white/50">Estado</label>
              <select
                name="status"
                defaultValue={user.status}
                disabled={isSelf}
                className="mt-1.5 w-full rounded-lg border border-white/[0.08] bg-[var(--panel-surface-2)] px-3 py-2 text-[14px] text-white outline-none focus:border-[var(--chart-1)] disabled:opacity-40"
              >
                <option value="active">active</option>
                <option value="suspended">suspended</option>
              </select>
            </div>

            <p className="text-[11.5px] leading-relaxed text-white/25">
              Guardar fixa o papel a mão: o próximo login por Discord deixa de o
              reescrever.
              {user.role_source === "manual" && " Já está fixo."}
            </p>

            <button className="w-full rounded-lg bg-[var(--chart-1)] py-2 text-[13px] font-semibold text-[#16082c] transition-opacity hover:opacity-90">
              Guardar
            </button>
          </form>
        </Card>

        <Card title="Atribuir plano" subtitle="Aplica o plano e a duracao configurada. 0 dias = life-time.">
          <form action={assignPlanAction} className="space-y-4">
            <input type="hidden" name="userId" value={user.id} />

            <div>
              <label className="block text-[12px] font-medium text-white/50">Plano</label>
              <select
                name="planId"
                defaultValue={plans.find((p) => p.code === user.tier)?.id ?? plans[0]?.id}
                className="mt-1.5 w-full rounded-lg border border-white/[0.08] bg-[var(--panel-surface-2)] px-3 py-2 text-[14px] text-white outline-none focus:border-[var(--chart-1)]"
              >
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.code}) - {p.days === 0 ? "Life-time" : `${p.days} dias`}
                    {p.support_days === null
                      ? " / sem suporte"
                      : p.support_days === 0
                        ? " / suporte life-time"
                        : ` / ${p.support_days} dias de suporte`}
                    {p.active === 0 ? " - privado" : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                name="mode"
                value="assign"
                className="rounded-lg bg-[var(--chart-1)] px-4 py-2 text-[13px] font-semibold text-[#16082c] transition-opacity hover:opacity-90"
              >
                Atribuir plano
              </button>
              <button
                name="mode"
                value="clear"
                className="rounded-lg border border-[var(--critical)]/30 px-4 py-2 text-[13px] font-semibold text-[var(--critical)] transition-colors hover:bg-[var(--critical)]/10"
              >
                Retirar plano
              </button>
            </div>
          </form>

          <p className="mt-4 text-[11.5px] leading-relaxed text-white/25">
            Para um plano especial, cria-o em Planos como Life-time e deixa-o fora do site.
            Esta pagina exige owner, por isso so o dono consegue atribui-lo.
          </p>
        </Card>

        <Card title="Licenca">
          <div className="mb-5 flex items-center gap-3">
            <span className="text-2xl font-bold text-white">
              {!hasLicense
                ? "Sem licenca"
                : user.expires_at === null
                  ? "Life-time"
                  : daysLeft !== null && daysLeft > 0
                    ? `${daysLeft} dias`
                    : "Expirada"}
            </span>
            {hasLicense && (
              <StatusBadge
                status={
                  user.expires_at === null || (daysLeft ?? 0) > 0 ? "active" : "suspended"
                }
              />
            )}
          </div>

          <form action={setLicenseAction} className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="userId" value={user.id} />
            <div className="flex-1 min-w-[110px]">
              <label className="block text-[12px] font-medium text-white/50">Dias</label>
              <input
                name="days"
                defaultValue="30"
                inputMode="numeric"
                className="mt-1.5 w-full rounded-lg border border-white/[0.08] bg-[var(--panel-surface-2)] px-3 py-2 text-[14px] tabular-nums text-white outline-none focus:border-[var(--chart-1)]"
              />
            </div>
            <button
              name="mode"
              value="add"
              className="rounded-lg border border-white/10 bg-[var(--panel-surface-2)] px-4 py-2 text-[13px] font-semibold text-white/75 transition-colors hover:border-[var(--chart-1)] hover:text-white"
            >
              Acrescentar
            </button>
            <button
              name="mode"
              value="set"
              className="rounded-lg border border-white/10 bg-[var(--panel-surface-2)] px-4 py-2 text-[13px] font-semibold text-white/75 transition-colors hover:border-[var(--chart-1)] hover:text-white"
            >
              Definir
            </button>
            <button
              name="mode"
              value="clear"
              className="rounded-lg border border-[var(--critical)]/30 px-4 py-2 text-[13px] font-semibold text-[var(--critical)] transition-colors hover:bg-[var(--critical)]/10"
            >
              Retirar
            </button>
          </form>

          <p className="mt-4 text-[11.5px] leading-relaxed text-white/25">
            <strong className="text-white/40">Acrescentar</strong> soma ao que resta;{" "}
            <strong className="text-white/40">Definir</strong> conta a partir de hoje;{" "}
            <strong className="text-white/40">Retirar</strong> deixa sem validade.
          </p>
        </Card>

        <Card title="Support Plan">
          <div className="flex items-start justify-between gap-5">
            <div>
              <div className="text-2xl font-bold text-white">
                {!hasSupport
                  ? "Sem suporte"
                  : user.support_lifetime === 1
                    ? "Life-time"
                    : supportActive
                      ? `${supportDaysLeft} dias`
                      : "Expirado"}
              </div>
              {hasSupport && (
                <div className="mt-3">
                  <StatusBadge status={supportActive ? "active" : "suspended"} />
                </div>
              )}
            </div>
            <div className="text-right text-[12px] leading-5 text-white/35">
              {user.support_started_at !== null && (
                <div>Inicio: {dateTime(user.support_started_at)}</div>
              )}
              {user.support_expires_at !== null && (
                <div>Fim: {dateTime(user.support_expires_at)}</div>
              )}
            </div>
          </div>
          <p className="mt-5 text-[11.5px] leading-relaxed text-white/25">
            A contagem inicia quando o plano e atribuido. Reatribuir o plano reinicia o suporte
            segundo a configuracao atual.
          </p>
        </Card>
      </div>

      <Card title="Maquina e credenciais" className="mt-5">
        <p className="mb-5 text-[12.5px] leading-relaxed text-white/35">
          Estas credenciais iniciam sessao no cliente Windows e dao acesso aos optimizers
          permitidos pelo plano desta conta.
        </p>
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <dt className="text-[12px] text-white/35">Utilizador do cliente</dt>
            <dd className="mt-1 break-all font-mono text-[12.5px] text-white/70">
              {user.username}
            </dd>
          </div>
          <div>
            <dt className="text-[12px] text-white/35">Maquina ligada</dt>
            <dd className="mt-1 break-all font-mono text-[12px] text-white/60">
              {user.hwid ?? "nenhuma"}
            </dd>
          </div>
          <div>
            <dt className="text-[12px] text-white/35">Password do cliente</dt>
            <dd className="mt-1 text-[13px] text-white/60">
              {user.password_hash === NO_PASSWORD ? (
                "sem password (so Discord)"
              ) : (
                <PasswordReveal password={user.client_password} />
              )}
            </dd>
          </div>
          <div>
            <dt className="text-[12px] text-white/35">Sessoes ativas</dt>
            <dd className="mt-1 text-[13px] text-white/60">
              {sessions.optimizer ?? 0} optimizer / {sessions.website ?? 0} site
            </dd>
          </div>
        </dl>
      </Card>

      <Card title="Informacao da conta" className="mt-5">
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <dt className="text-[12px] text-white/35">ID interno</dt>
            <dd className="mt-1 font-mono text-[12.5px] text-white/70">{user.id}</dd>
          </div>
          <div>
            <dt className="text-[12px] text-white/35">Email</dt>
            <dd className="mt-1 break-all text-[13px] text-white/70">
              {user.email ?? "nao definido"}
            </dd>
          </div>
          <div>
            <dt className="text-[12px] text-white/35">Discord</dt>
            <dd className="mt-1 break-all text-[13px] text-white/70">
              {user.discord_username ?? "nao ligado"}
            </dd>
          </div>
          <div>
            <dt className="text-[12px] text-white/35">ID do Discord</dt>
            <dd className="mt-1 break-all font-mono text-[12px] text-white/60">
              {user.discord_id ?? "nao ligado"}
            </dd>
          </div>
          <div>
            <dt className="text-[12px] text-white/35">Cargo e origem</dt>
            <dd className="mt-1 text-[13px] text-white/70">
              {user.role} / {user.role_source === "manual" ? "definido pelo owner" : "Discord"}
            </dd>
          </div>
          <div>
            <dt className="text-[12px] text-white/35">Estado</dt>
            <dd className="mt-1"><StatusBadge status={user.status} /></dd>
          </div>
          <div>
            <dt className="text-[12px] text-white/35">Plano</dt>
            <dd className="mt-1 text-[13px] text-white/70">{user.tier ?? "sem plano"}</dd>
          </div>
          <div>
            <dt className="text-[12px] text-white/35">Validade exata</dt>
            <dd className="mt-1 text-[13px] text-white/70">
              {!hasLicense
                ? "sem licenca"
                : user.expires_at === null
                  ? "life-time"
                  : dateTime(user.expires_at)}
            </dd>
          </div>
          <div>
            <dt className="text-[12px] text-white/35">Conta criada</dt>
            <dd className="mt-1 text-[13px] text-white/70">{dateTime(user.created_at)}</dd>
          </div>
          <div>
            <dt className="text-[12px] text-white/35">Ultimo login local</dt>
            <dd className="mt-1 text-[13px] text-white/70">
              {loginStats.last_success ? dateTime(loginStats.last_success) : "sem registo"}
            </dd>
          </div>
          <div>
            <dt className="text-[12px] text-white/35">Logins locais falhados</dt>
            <dd className="mt-1 tabular-nums text-[13px] text-white/70">
              {loginStats.failed_total ?? 0}
            </dd>
          </div>
        </dl>
      </Card>

      <Card title="Compras" className="mt-5">
        {orders.length === 0 ? (
          <p className="py-6 text-center text-[13px] text-white/30">Sem compras.</p>
        ) : (
          <table className="w-full text-[13px]">
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <td className="border-b border-white/[0.04] py-2.5 text-white/45">
                    {dateTime(o.created_at)}
                  </td>
                  <td className="border-b border-white/[0.04] py-2.5 text-white/70">
                    {o.plan_name}
                  </td>
                  <td className="border-b border-white/[0.04] py-2.5 tabular-nums text-white/70">
                    {money(o.amount_cents, o.currency)}
                  </td>
                  <td className="border-b border-white/[0.04] py-2.5">
                    <StatusBadge status={o.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card title="Atividade recente" className="mt-5">
        {activity.length === 0 ? (
          <p className="py-6 text-center text-[13px] text-white/30">Sem atividade registada.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr>
                  {["Data", "Acao", "Detalhe", "IP"].map((heading) => (
                    <th
                      key={heading}
                      className="border-b border-white/[0.06] px-3 py-2.5 text-left text-[10.5px] font-semibold uppercase tracking-wide text-white/35"
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {activity.map((entry) => (
                  <tr key={entry.id}>
                    <td className="whitespace-nowrap border-b border-white/[0.04] px-3 py-2.5 text-white/45">
                      {dateTime(entry.created_at)}
                    </td>
                    <td className="border-b border-white/[0.04] px-3 py-2.5 font-mono text-[12px] text-white/70">
                      {entry.action}
                    </td>
                    <td className="border-b border-white/[0.04] px-3 py-2.5 text-white/50">
                      {entry.detail ?? "-"}
                    </td>
                    <td className="border-b border-white/[0.04] px-3 py-2.5 font-mono text-[12px] text-white/40">
                      {entry.ip ?? "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <DangerZone userId={user.id} username={user.username} isSelf={isSelf} />
    </>
  );
}
