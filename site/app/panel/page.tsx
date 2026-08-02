import Link from "next/link";
import { requireUser, roleAtLeast } from "@/lib/session";
import { dateTime, money, ordersForUser } from "@/lib/stats";
import { nowSeconds, NO_PASSWORD } from "@/lib/db";
import { Card, StatusBadge } from "@/components/panel/Pieces";
import ClientPassword from "./ClientPassword";
import MachineBinding from "./MachineBinding";
import OptimizerActions from "./OptimizerActions";
import { DISCORD_URL } from "@/lib/data";
import { optimizerRelease } from "@/lib/optimizer-release";
import { MonitorCog, ShieldCheck } from "lucide-react";

export const dynamic = "force-dynamic";

const TIER_LABEL: Record<string, string> = {
  basic: "Basic",
  pro: "Pro",
  ultimate: "Ultimate",
};

export default async function AccountPage() {
  const user = await requireUser();
  const release = optimizerRelease();

  const now = nowSeconds();

  // Ter licenca e ter um plano ou uma validade gravada - NAO e o papel.
  //
  // expires_at a NULL significa "nunca comprou", nao "sem prazo". Tratar as
  // duas coisas como a mesma fazia um owner recem-criado, sem uma unica
  // encomenda, aparecer com licenca permanente.
  const hasLicense = user.tier !== null || user.expires_at !== null;

  // Staff para cima veem as credenciais do cliente mesmo sem terem comprado:
  // precisam delas para testar e para dar apoio.
  const needsClientAccess = hasLicense || roleAtLeast(user, "staff");

  const orders = hasLicense ? await ordersForUser(user.id) : [];
  const active = hasLicense && (user.expires_at === null || user.expires_at > now);
  const daysLeft =
    user.expires_at === null ? null : Math.max(0, Math.ceil((user.expires_at - now) / 86400));
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
      <h1 className="text-2xl font-bold tracking-tight text-white">A minha conta</h1>
      <p className="mt-1.5 text-[14px] text-white/40">
        {hasLicense
          ? "Estado da licenca e historico de compras."
          : "Os teus dados. Ainda nao tens nenhum plano ativo."}
      </p>

      {!hasLicense && (
        <Card className="mt-8">
          <div className="flex flex-wrap items-center justify-between gap-6">
            <div className="max-w-lg">
              <h2 className="text-[16px] font-semibold text-white">Sem plano ativo</h2>
              <p className="mt-2 text-[13.5px] leading-relaxed text-white/45">
                {roleAtLeast(user, "staff")
                  ? "Nunca compraste nenhum pacote — o teu acesso ao painel vem do cargo que tens no Discord, nao de uma licenca."
                  : "A tua conta esta ligada ao Discord e funciona, mas ainda nao tens nenhum pacote."}
              </p>
            </div>
            <Link
              href="/#packages"
              className="shrink-0 rounded-lg bg-[var(--chart-1)] px-5 py-2.5 text-[13.5px] font-semibold text-[#16082c]"
            >
              Ver planos
            </Link>
          </div>
        </Card>
      )}

      <div className={`mt-5 grid gap-5 ${hasLicense ? "lg:grid-cols-[1.1fr_1fr]" : ""}`}>
        {hasLicense && (
          <Card title="Licenca">
            <div className="flex items-start justify-between gap-6">
              <div>
                <div className="text-3xl font-bold tracking-tight text-white">
                  {active ? (daysLeft === null ? "Life-time" : `${daysLeft} dias`) : "Expirada"}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <StatusBadge status={active ? "active" : "suspended"} />
                  {user.tier && (
                    <span className="rounded-full border border-[var(--chart-1)]/25 bg-[var(--chart-1)]/10 px-2.5 py-1 text-[11.5px] font-semibold text-[var(--chart-1)]">
                      {TIER_LABEL[user.tier] ?? user.tier}
                    </span>
                  )}
                </div>
                {user.expires_at !== null && (
                  <div className="mt-3 text-[13px] text-white/35">
                    {active ? "Valida ate" : "Expirou em"} {dateTime(user.expires_at)}
                  </div>
                )}
              </div>

              {!active && (
                <Link
                  href="/#packages"
                  className="shrink-0 rounded-lg bg-[var(--chart-1)] px-4 py-2 text-[13px] font-semibold text-[#16082c]"
                >
                  Renovar
                </Link>
              )}
            </div>
          </Card>
        )}

        {hasLicense && (
          <Card title="Support Plan">
            <div className="flex items-start justify-between gap-5">
              <div>
                <div className="text-3xl font-bold tracking-tight text-white">
                  {!hasSupport
                    ? "Nao incluido"
                    : user.support_lifetime === 1
                      ? "Life-time"
                      : supportActive
                        ? `${supportDaysLeft} dias`
                        : "Expirado"}
                </div>
                {hasSupport && (
                  <div className="mt-2">
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
          </Card>
        )}

        <Card title="Conta Discord">
          <div className="flex items-center gap-4">
            {user.discord_avatar && user.discord_id ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`https://cdn.discordapp.com/avatars/${user.discord_id}/${user.discord_avatar}.png?size=128`}
                alt=""
                className="h-14 w-14 rounded-full"
              />
            ) : (
              <div className="grid h-14 w-14 place-items-center rounded-full bg-[var(--panel-surface-2)] text-lg font-bold text-white/50">
                {user.username.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <div className="truncate text-[15px] font-semibold text-white">
                {user.discord_username ?? user.username}
              </div>
              <div className="mt-0.5 text-[12.5px] text-white/35">
                Papel: <span className="text-white/60">{user.role}</span>
                {user.role_source === "manual" && (
                  <span className="ml-1.5 text-[11px] uppercase tracking-wide text-white/25">
                    fixo
                  </span>
                )}
              </div>
            </div>
          </div>

          <p className="mt-5 text-[12.5px] leading-relaxed text-white/30">
            O papel vem dos teus cargos no{" "}
            <a href={DISCORD_URL} className="text-[var(--chart-1)] hover:underline">
              servidor Discord
            </a>{" "}
            e e reavaliado sempre que entras.
          </p>
        </Card>
      </div>

      {needsClientAccess && (
        <>
          <Card title="Maquina ligada" className="mt-5">
            <MachineBinding
              hasMachine={Boolean(user.hwid)}
              maskedHwid={user.hwid ? `${user.hwid.slice(0, 32)}…` : undefined}
            />
          </Card>

          <div id="credenciais-windows" className="scroll-mt-24">
            <Card
              title="Cliente Windows"
              subtitle={
                hasLicense
                  ? "Credenciais para o optimizador em si"
                  : "Acesso pelo teu cargo, para testar e dar apoio"
              }
              className="mt-5"
            >
            <div className="flex flex-wrap items-center justify-between gap-5">
              <div className="flex min-w-0 items-center gap-4">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-lg border border-[var(--chart-1)]/20 bg-[var(--chart-1)]/10 text-[var(--chart-1)]">
                  <MonitorCog size={22} />
                </div>
                <div>
                  <div className="text-[15px] font-semibold text-white">Orion Optimizer 2.0</div>
                  <div className="mt-1 flex items-center gap-1.5 text-[12px] text-[var(--good)]">
                    <ShieldCheck size={13} />
                    Acesso autorizado para esta conta
                  </div>
                </div>
              </div>

              <OptimizerActions installedVersion={user.client_version} release={release} />
            </div>

            <div className="mt-5 border-t border-white/[0.06] pt-5">
              <ClientPassword hasPassword={user.password_hash !== NO_PASSWORD} />
            </div>
            </Card>
          </div>

          <Card title="Compras" className="mt-5">
            {orders.length === 0 ? (
              <p className="py-8 text-center text-[13px] text-white/30">
                Ainda nao ha compras nesta conta.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[13.5px]">
                  <thead>
                    <tr>
                      {["Data", "Plano", "Valor", "Estado"].map((h) => (
                        <th
                          key={h}
                          className="border-b border-white/[0.06] px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-white/35"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((o) => (
                      <tr key={o.id}>
                        <td className="border-b border-white/[0.04] px-3 py-3 tabular-nums text-white/50">
                          {dateTime(o.created_at)}
                        </td>
                        <td className="border-b border-white/[0.04] px-3 py-3 text-white/70">
                          {o.plan_name}
                        </td>
                        <td className="border-b border-white/[0.04] px-3 py-3 tabular-nums text-white/70">
                          {money(o.amount_cents, o.currency)}
                        </td>
                        <td className="border-b border-white/[0.04] px-3 py-3">
                          <StatusBadge status={o.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </>
  );
}
