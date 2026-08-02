import fs from "node:fs";
import path from "node:path";
import { Crown, Rocket, ShieldAlert, Smartphone, UploadCloud } from "lucide-react";
import { releaseCurrentVersionForAllPlansAction, updatePlanVersionAction, updateRoleVersionAction } from "../../actions";
import { optimizerRelease, releaseForPlan } from "@/lib/optimizer-release";
import { listAppVersionTargets } from "@/lib/repo/app-versions";
import { allPlans } from "@/lib/repo/plans";
import { requireRole } from "@/lib/session";
import { compareVersions, SEMVER } from "@/lib/version";
import VersionPicker from "./VersionPicker";

export const dynamic = "force-dynamic";

export default async function VersionsPage() {
  await requireRole("owner");
  const [plans, globalRelease, roleTargets] = await Promise.all([
    allPlans(),
    Promise.resolve(optimizerRelease()),
    listAppVersionTargets([
      { id: "role:staff", label: "Staff" },
      { id: "role:developer", label: "Developer" },
    ]),
  ]);
  const versions = availableVersions(globalRelease.version);

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--chart-1)]">
            Owner
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-white">Versoes da aplicacao</h1>
          <p className="mt-1.5 max-w-2xl text-[14px] leading-6 text-white/40">
            Define manualmente que versao do Orion Optimizer 2.0 cada plano deve receber. Campos vazios usam a versao global.
          </p>
        </div>

        <form action={releaseCurrentVersionForAllPlansAction}>
          <button className="inline-flex items-center gap-2 rounded-lg bg-[var(--chart-1)] px-4 py-2.5 text-[13px] font-semibold text-[#16082c] transition-opacity hover:opacity-90">
            <UploadCloud size={16} />
            Liberar versao atualizada para todos
          </button>
        </form>
      </div>

      <section className="mt-7 grid gap-4 md:grid-cols-3">
        <Metric icon={<Rocket size={17} />} label="Versao global" value={globalRelease.version} />
        <Metric icon={<ShieldAlert size={17} />} label="Minima global" value={globalRelease.minSupported ?? "sem minimo"} />
        <Metric icon={<Smartphone size={17} />} label="Planos configuraveis" value={String(plans.length)} />
      </section>

      <section className="mt-7">
        <div className="mb-3 flex items-center gap-2 text-[13px] font-semibold text-white/75">
          <Crown size={15} className="text-[var(--chart-1)]" />
          Cargos internos
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {roleTargets.map((target) => {
            const effective = releaseForPlan(globalRelease, target);
            const developer = target.id === "role:developer";
            return (
              <form key={target.id} action={updateRoleVersionAction} className="rounded-lg border border-white/[0.07] bg-[var(--panel-surface)] p-5">
                <input type="hidden" name="target" value={target.id} />
                <div className="mb-4">
                  <h2 className="text-[16px] font-semibold text-white">{target.label}</h2>
                  <p className="mt-2 text-[12.5px] text-white/35">
                    Efetiva: <strong className="font-mono text-white/70">{effective.version}</strong>
                    {effective.minSupported && <> · minima <strong className="font-mono text-white/70">{effective.minSupported}</strong></>}
                  </p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <VersionPicker name="appVersion" label="Versao liberada" value={target.app_version} fallback={globalRelease.version} versions={versions} emptyLabel="Usar global" />
                  <VersionPicker name="appMinSupported" label="Versao minima" value={target.app_min_supported} fallback={globalRelease.minSupported ?? "sem minimo global"} versions={versions} emptyLabel="Usar minima global" />
                </div>
                {developer && (
                  <div className="mt-4 grid gap-2 rounded-lg border border-[var(--warning)]/20 bg-[var(--warning)]/[0.06] p-3">
                    <label className="flex items-center gap-2 text-[11.5px] font-medium text-white/60">
                      <input type="checkbox" name="confirmDeveloper" value="1" className="h-4 w-4 accent-[var(--chart-1)]" />
                      Confirmo que esta versao vai para Developer
                    </label>
                    <label className="flex items-center gap-2 text-[11.5px] font-medium text-white/60">
                      <input type="checkbox" name="confirmDeveloperAgain" value="1" className="h-4 w-4 accent-[var(--chart-1)]" />
                      Confirmo novamente a liberacao Developer
                    </label>
                  </div>
                )}
                <button className="mt-4 inline-flex h-10 items-center justify-center rounded-md border border-[var(--chart-1)]/35 bg-[var(--chart-1)]/10 px-4 text-[12.5px] font-bold text-[var(--chart-1)] transition-colors hover:bg-[var(--chart-1)] hover:text-[#16082c]">
                  Guardar cargo
                </button>
              </form>
            );
          })}
        </div>
      </section>

      <div className="mt-7 grid gap-4">
        {plans.map((plan) => {
          const effective = releaseForPlan(globalRelease, plan);
          return (
            <form
              key={plan.id}
              action={updatePlanVersionAction}
              className="rounded-lg border border-white/[0.07] bg-[var(--panel-surface)] p-5"
            >
              <input type="hidden" name="planId" value={plan.id} />
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px_220px_auto] lg:items-end">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="truncate text-[16px] font-semibold text-white">{plan.name}</h2>
                    <span className="rounded-md border border-white/10 px-2 py-1 font-mono text-[10px] text-white/35">
                      {plan.code}
                    </span>
                    {plan.active === 1 && (
                      <span className="rounded-md bg-[var(--good)]/10 px-2 py-1 text-[10px] font-bold text-[var(--good)]">
                        no site
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-[12.5px] text-white/35">
                    Efetiva: <strong className="font-mono text-white/70">{effective.version}</strong>
                    {effective.minSupported && (
                      <> · minima <strong className="font-mono text-white/70">{effective.minSupported}</strong></>
                    )}
                  </p>
                </div>

                <VersionPicker
                    name="appVersion"
                  label="Versao liberada"
                  value={plan.app_version}
                  fallback={globalRelease.version}
                  versions={versions}
                  emptyLabel="Usar global"
                />

                <VersionPicker
                    name="appMinSupported"
                  label="Versao minima"
                  value={plan.app_min_supported}
                  fallback={globalRelease.minSupported ?? "sem minimo global"}
                  versions={versions}
                  emptyLabel="Usar minima global"
                />

                <button className="inline-flex h-10 items-center justify-center rounded-md border border-[var(--chart-1)]/35 bg-[var(--chart-1)]/10 px-4 text-[12.5px] font-bold text-[var(--chart-1)] transition-colors hover:bg-[var(--chart-1)] hover:text-[#16082c]">
                  Guardar
                </button>
              </div>
            </form>
          );
        })}
      </div>
    </div>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/[0.07] bg-[var(--panel-surface)] p-4">
      <div className="flex items-center gap-2 text-[var(--chart-1)]">{icon}<span className="text-[11px] font-bold uppercase tracking-wide">{label}</span></div>
      <p className="mt-3 font-mono text-[20px] font-bold text-white">{value}</p>
    </div>
  );
}

function availableVersions(current: string): string[] {
  const dir = path.join(process.cwd(), "public", "downloads", "windows");
  const versions = new Set<string>([current]);
  try {
    for (const name of fs.readdirSync(dir)) {
      const match = name.match(/(?:^| )(\d+\.\d+\.\d+)\.exe$/i);
      if (match && SEMVER.test(match[1])) versions.add(match[1]);
    }
  } catch {
    // A pagina continua funcional mesmo sem pasta local de releases.
  }
  return [...versions].sort((a, b) => compareVersions(b, a));
}
