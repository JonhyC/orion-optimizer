import Link from "next/link";
import { requireUser, roleAtLeast } from "@/lib/session";
import { dateTime, money, ordersForUser } from "@/lib/stats";
import { nowSeconds, NO_PASSWORD } from "@/lib/db";
import { Card, StatusBadge } from "@/components/panel/Pieces";
import { estadoDaLicenca, estadoDoSuporte, totalGasto } from "@/lib/personal-dashboard";
import { findPlanByCode } from "@/lib/repo/plans";
import ClientPassword from "./ClientPassword";
import MachineBinding from "./MachineBinding";
import OptimizerActions from "./OptimizerActions";
import { DISCORD_URL } from "@/lib/data";
import { optimizerRelease } from "@/lib/optimizer-release";
import { MonitorCog, ShieldCheck } from "lucide-react";

export const dynamic = "force-dynamic";

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

  // O nome do plano vem da base de dados e nao de um mapa escrito a mao.
  // O mapa que estava aqui tinha basic/pro/ultimate e nunca chegou a
  // conhecer o Special: quem o comprasse via "special" em minusculas.
  const plano = user.tier ? await findPlanByCode(user.tier) : null;
  const nomeDoPlano = plano?.name ?? user.tier;

  // Mesma logica da Area Pessoal, para as duas paginas nao darem versoes
  // diferentes do mesmo estado.
  //
  // `acessoInterno` vai a false de proposito: aqui ja estamos dentro do
  // ramo `hasLicense`, portanto existe mesmo uma licenca comprada e o
  // ramo de acesso por cargo tornaria a data de validade invisivel.
  const licenca = estadoDaLicenca({
    tier: user.tier,
    expiresAt: user.expires_at,
    agora: now,
    acessoInterno: false,
    contaSuspensa: user.status === "suspended",
  });
  const active = hasLicense && licenca.badge === "active";

  const hasSupport =
    user.support_lifetime === 1 ||
    user.support_started_at !== null ||
    user.support_expires_at !== null;
  const suporte = estadoDoSuporte({
    supportLifetime: user.support_lifetime,
    supportExpiresAt: user.support_expires_at,
    agora: now,
  });

  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight text-white">A minha conta</h1>
      <p className="mt-1.5 text-[14px] text-white/40">
        {hasLicense
          ? "Estado da licença e histórico de compras."
          : "Os teus dados. Ainda não tens nenhum plano ativo."}
      </p>

      {!hasLicense && (
        <Card className="mt-8">
          <div className="flex flex-wrap items-center justify-between gap-6">
            <div className="max-w-lg">
              <h2 className="text-[16px] font-semibold text-white">Sem plano ativo</h2>
              <p className="mt-2 text-[13.5px] leading-relaxed text-white/45">
                {roleAtLeast(user, "staff")
                  ? "Nunca compraste nenhum pacote — o teu acesso ao painel vem do cargo que tens no Discord, não de uma licença."
                  : "A tua conta está ligada ao Discord e funciona, mas ainda não tens nenhum pacote."}
              </p>
            </div>
            <Link
              href="/#packages"
              className="shrink-0 rounded-lg bg-[var(--chart-1)] px-5 py-2.5 text-[13.5px] font-semibold text-[#16082c] transition-transform duration-200 hover:scale-[1.02]"
            >
              Ver planos
            </Link>
          </div>
        </Card>
      )}

      <div className={`mt-5 grid gap-5 ${hasLicense ? "lg:grid-cols-[1.1fr_1fr]" : ""}`}>
        {hasLicense && (
          <Card title="Licença">
            <div className="flex items-start justify-between gap-6">
              <div>
                <div className="text-3xl font-bold tracking-tight text-white">{licenca.texto}</div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <StatusBadge status={licenca.badge} />
                  {nomeDoPlano && (
                    <span className="rounded-full border border-neon/25 bg-neon/10 px-2.5 py-1 text-[11.5px] font-semibold text-[var(--chart-1)]">
                      {nomeDoPlano}
                    </span>
                  )}
                </div>
                {user.expires_at !== null && (
                  <div className="mt-3 text-[13px] text-white/35">
                    {active ? "Válida até" : "Expirou em"} {dateTime(user.expires_at)}
                  </div>
                )}
              </div>

              {/* Botao so quando ha mesmo algo a fazer. */}
              {licenca.urgente && (
                <Link
                  href={licenca.badge === "suspended" ? DISCORD_URL : "/#packages"}
                  className="shrink-0 rounded-lg bg-[var(--chart-1)] px-4 py-2 text-[13px] font-semibold text-[#16082c] transition-transform duration-200 hover:scale-[1.03]"
                >
                  {licenca.badge === "suspended" ? "Falar com a equipa" : "Renovar"}
                </Link>
              )}
            </div>
          </Card>
        )}

        {hasLicense && (
          <Card title="Support Plan">
            <div className="flex items-start justify-between gap-5">
              <div>
                <div className="text-3xl font-bold tracking-tight text-white">{suporte.texto}</div>
                {hasSupport && (
                  <div className="mt-2">
                    <StatusBadge status={suporte.ativo ? "active" : "expired"} />
                  </div>
                )}
              </div>
              <div className="text-right text-[12px] leading-5 text-white/35">
                {user.support_started_at !== null && (
                  <div>Início: {dateTime(user.support_started_at)}</div>
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
                Cargo: <span className="text-white/60">{user.role}</span>
                {user.role_source === "manual" && (
                  <span className="ml-1.5 text-[11px] uppercase tracking-wide text-white/25">
                    fixo
                  </span>
                )}
              </div>
            </div>
          </div>

          <p className="mt-5 text-[12.5px] leading-relaxed text-white/30">
            O cargo vem dos teus cargos no{" "}
            <a href={DISCORD_URL} className="text-[var(--chart-1)] hover:underline">
              servidor Discord
            </a>{" "}
            e é reavaliado sempre que entras.
          </p>
        </Card>
      </div>

      {needsClientAccess && (
        <>
          <Card title="Máquina ligada" className="mt-5">
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
                  ? "Credenciais para o otimizador em si"
                  : "Acesso pelo teu cargo, para testar e dar apoio"
              }
              className="mt-5"
            >
            <div className="flex flex-wrap items-center justify-between gap-5">
              <div className="flex min-w-0 items-center gap-4">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-lg border border-neon/20 bg-neon/10 text-[var(--chart-1)]">
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

          <Card
            title="Compras"
            subtitle={
              orders.some((o) => o.status === "paid")
                ? `${totalGasto(orders)} em compras concluídas`
                : undefined
            }
            className="mt-5"
          >
            {orders.length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-[13px] text-white/30">Ainda não há compras nesta conta.</p>
                {!hasLicense && (
                  <Link
                    href="/#packages"
                    className="mt-3 inline-block text-[12.5px] font-semibold text-[var(--chart-1)] hover:underline"
                  >
                    Ver planos disponíveis
                  </Link>
                )}
              </div>
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
