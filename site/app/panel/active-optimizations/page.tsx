import Link from "next/link";
import { Activity, Cpu, HardDrive, MonitorCog, RotateCcw, ShieldCheck } from "lucide-react";
import { requireUser } from "@/lib/session";
import { listActiveOptimizations } from "@/lib/repo/active-optimizations";

export const dynamic = "force-dynamic";

function dateTime(value: number | null | undefined) {
  if (!value) return "Sem data";
  return new Intl.DateTimeFormat("pt-PT", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value * 1000));
}

function machineLabel(value: string | null) {
  if (!value) return "PC nao identificado";
  return value.length > 28 ? `${value.slice(0, 28)}...` : value;
}

export default async function ActiveOptimizationsPage() {
  const user = await requireUser();
  const active = await listActiveOptimizations(user.id);
  const latest = active[0] ?? null;
  const machines = Array.from(new Set(active.map((item) => item.machine_hwid).filter(Boolean)));

  return (
    <div>
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--chart-1)]">
            Area pessoal
          </p>
          <h1 className="mt-2 text-3xl font-bold text-white">Otimizacoes Ativas</h1>
          <p className="mt-2 max-w-2xl text-[13.5px] leading-relaxed text-white/45">
            Otimizacoes que a app Orion Optimizer 2.0 marcou como aplicadas neste cliente.
          </p>
        </div>
        <Link
          href="/panel/dashboard"
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-4 text-[13px] font-semibold text-white/70 transition-colors hover:border-[var(--chart-1)]/35 hover:text-white"
        >
          <Activity size={15} />
          Voltar ao dashboard
        </Link>
      </div>

      <section className="mt-8 grid gap-3 md:grid-cols-4">
        <Stat icon={<ShieldCheck size={17} />} label="Ativas" value={String(active.length)} />
        <Stat icon={<HardDrive size={17} />} label="PCs" value={String(machines.length || (user.hwid ? 1 : 0))} />
        <Stat icon={<MonitorCog size={17} />} label="Ultima app" value={user.client_version ?? "Sem versao"} />
        <Stat icon={<Cpu size={17} />} label="Ultima atividade" value={dateTime(latest?.applied_at ?? user.client_seen_at)} />
      </section>

      {active.length === 0 ? (
        <section className="mt-8 rounded-xl border border-white/[0.07] bg-[var(--panel-surface)] p-10 text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-lg border border-[var(--chart-1)]/20 bg-[var(--chart-1)]/[0.08] text-[var(--chart-1)]">
            <ShieldCheck size={20} />
          </div>
          <h2 className="mt-5 text-lg font-semibold text-white">Ainda nao existem otimizacoes ativas</h2>
          <p className="mx-auto mt-2 max-w-lg text-[13px] leading-relaxed text-white/40">
            Abre a app desktop, aplica uma otimizacao e volta a esta pagina. A app sincroniza a data,
            o tweak aplicado e a informacao do computador.
          </p>
        </section>
      ) : (
        <section className="mt-8 grid gap-3">
          {active.map((item) => (
            <article
              key={item.id}
              className="grid gap-4 rounded-xl border border-white/[0.07] bg-[var(--panel-surface)] p-5 md:grid-cols-[minmax(0,1fr)_minmax(260px,0.55fr)]"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--good)]/20 bg-[var(--good)]/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--good)]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[var(--good)]" />
                    Ativa
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] font-semibold text-white/40">
                    {item.category}
                  </span>
                  {item.requires_reboot === 1 && (
                    <span className="rounded-full border border-[var(--warning)]/20 bg-[var(--warning)]/10 px-2.5 py-1 text-[11px] font-semibold text-[var(--warning)]">
                      Reinicio recomendado
                    </span>
                  )}
                </div>
                <h2 className="mt-3 truncate text-[17px] font-semibold text-white">{item.name}</h2>
                <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-white/40">
                  {item.description ?? item.tweak_id}
                </p>
                <div className="mt-4 flex flex-wrap gap-2 text-[11.5px] text-white/35">
                  <span>Ativada em {dateTime(item.applied_at)}</span>
                  <span>Session {item.session_id ? item.session_id.slice(0, 8) : "sem id"}</span>
                  <span>{item.mode}</span>
                </div>
              </div>

              <div className="rounded-lg border border-white/[0.06] bg-black/25 p-4">
                <h3 className="text-[12px] font-bold uppercase tracking-[0.16em] text-[var(--chart-1)]">
                  Informacao do PC
                </h3>
                <dl className="mt-3 grid gap-2 text-[12px]">
                  <Info label="HWID" value={machineLabel(item.machine_hwid)} />
                  <Info label="Tipo" value={item.machine_chassis ?? "Nao enviado"} />
                  <Info label="GPU" value={item.machine_gpu ?? "Nao enviada"} />
                  <Info label="RAM" value={item.machine_ram_gb ? `${item.machine_ram_gb} GB` : "Nao enviada"} />
                  <Info label="App" value={item.client_version ?? "Sem versao"} />
                </dl>
              </div>
            </article>
          ))}
        </section>
      )}

      <div className="mt-6 rounded-xl border border-[var(--chart-1)]/15 bg-[var(--chart-1)]/[0.05] p-4 text-[12.5px] leading-relaxed text-white/45">
        <span className="inline-flex items-center gap-2 font-semibold text-[var(--chart-1)]">
          <RotateCcw size={14} />
          Reversao
        </span>
        <p className="mt-1">
          Quando uma sessao e revertida no historico da app desktop, a otimizacao sai automaticamente desta lista.
        </p>
      </div>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-white/[0.07] bg-[var(--panel-surface)] p-4">
      <div className="flex items-center gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-[var(--chart-1)]/20 bg-[var(--chart-1)]/[0.08] text-[var(--chart-1)]">
          {icon}
        </span>
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/30">{label}</p>
          <p className="mt-1 truncate text-[13px] font-semibold text-white">{value}</p>
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-3 border-b border-white/[0.06] pb-2 last:border-b-0 last:pb-0">
      <dt className="shrink-0 text-white/30">{label}</dt>
      <dd className="min-w-0 truncate text-right font-semibold text-white/65" title={value}>{value}</dd>
    </div>
  );
}
