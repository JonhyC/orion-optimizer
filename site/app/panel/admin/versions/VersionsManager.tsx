"use client";

import { useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import {
  AlertTriangle,
  Boxes,
  Check,
  Clock3,
  GitCompare,
  Globe2,
  History,
  MonitorDown,
  Rocket,
  Search,
  ShieldAlert,
  Sparkles,
  UploadCloud,
  Users,
  X,
} from "lucide-react";
import {
  releaseCurrentVersionForAllPlansAction,
  updatePlanVersionAction,
  updateRoleVersionAction,
} from "../../actions";
import { compareVersions } from "@/lib/version";

type PlanTarget = {
  id: number;
  code: string;
  name: string;
  active: number;
  cover_url: string | null;
  app_version: string | null;
  app_min_supported: string | null;
};

type RoleTarget = {
  id: string;
  label: string;
  app_version: string | null;
  app_min_supported: string | null;
  updated_at: number | null;
};

export type VersionInfo = {
  version: string;
  channel: "Stable" | "Beta" | "Developer" | "Legacy";
  scope: string;
  releasedAt: number | null;
  current: boolean;
  notes: string[];
};

export default function VersionsManager({
  globalVersion,
  globalMinimum,
  releasedAt,
  plans,
  roleTargets,
  versions,
  usage,
  updatedPercent,
}: {
  globalVersion: string;
  globalMinimum: string | null;
  releasedAt: number | null;
  plans: PlanTarget[];
  roleTargets: RoleTarget[];
  versions: VersionInfo[];
  usage: Record<string, number>;
  updatedPercent: number;
}) {
  const [publishOpen, setPublishOpen] = useState(false);
  const staff = roleTargets.filter((target) => target.id === "role:staff" || target.id === "role:developer");
  const latest = versions[0]?.version ?? globalVersion;

  return (
    <>
      <VersionsHeader
        globalVersion={globalVersion}
        globalMinimum={globalMinimum}
        totalPlans={plans.length}
        totalRoles={staff.length}
        latest={latest}
        releasedAt={releasedAt}
        onPublish={() => setPublishOpen(true)}
      />

      <VersionsStats
        globalVersion={globalVersion}
        globalMinimum={globalMinimum}
        updatedPercent={updatedPercent}
        releasedAt={releasedAt}
      />

      <div className="mt-6 grid gap-5 xl:grid-cols-[1fr_360px]">
        <section className="space-y-5">
          <VersionCards
            title="Cargos internos"
            subtitle="Staff e Developer podem receber versões diferentes da global."
          >
            <div className="grid gap-4 lg:grid-cols-2">
              {staff.map((target) => (
                <RoleAssignment
                  key={target.id}
                  target={target}
                  globalVersion={globalVersion}
                  globalMinimum={globalMinimum}
                  versions={versions}
                  usage={usage}
                />
              ))}
            </div>
          </VersionCards>

          <VersionCards
            title="Planos"
            subtitle="Cada plano funciona como um painel de gestão da release atribuída."
          >
            <div className="grid gap-4">
              {plans.map((plan) => (
                <PlanAssignment
                  key={plan.id}
                  plan={plan}
                  globalVersion={globalVersion}
                  globalMinimum={globalMinimum}
                  versions={versions}
                  usage={usage}
                />
              ))}
            </div>
          </VersionCards>
        </section>

        <aside className="space-y-5 xl:sticky xl:top-24 xl:self-start">
          <VersionStatus versions={versions} usage={usage} />
          <VersionsTimeline globalVersion={globalVersion} plans={plans} roleTargets={staff} />
        </aside>
      </div>

      {publishOpen && (
        <ReleasePublish
          version={globalVersion}
          plans={plans}
          roleTargets={staff}
          estimatedClients={Object.values(usage).reduce((sum, count) => sum + count, 0)}
          onClose={() => setPublishOpen(false)}
        />
      )}
    </>
  );
}

function VersionsHeader({
  globalVersion,
  globalMinimum,
  totalPlans,
  totalRoles,
  latest,
  releasedAt,
  onPublish,
}: {
  globalVersion: string;
  globalMinimum: string | null;
  totalPlans: number;
  totalRoles: number;
  latest: string;
  releasedAt: number | null;
  onPublish: () => void;
}) {
  return (
    <section className="rounded-2xl border border-white/[0.07] bg-[var(--panel-surface)] p-6">
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--warning)]">
            Release management
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-white">Versoes da aplicacao</h1>
          <p className="mt-1.5 max-w-2xl text-[14px] leading-6 text-white/42">
            Gere a versão global, mínima, cargos internos e planos sem sair deste painel.
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-[11.5px]">
            <Pill label={`Global ${globalVersion}`} tone="gold" />
            <Pill label={`Minima ${globalMinimum ?? "sem minimo"}`} />
            <Pill label={`${totalPlans} planos`} />
            <Pill label={`${totalRoles} cargos internos`} />
            <Pill label={`Ultima ${latest}`} />
            <Pill label={releasedAt ? dateText(releasedAt) : "sem data"} />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onPublish}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-[var(--chart-1)] px-4 text-[13px] font-semibold text-[#16082c] transition hover:-translate-y-0.5 hover:opacity-95"
          >
            <UploadCloud size={15} />
            Publicar versao global
          </button>
          <HeaderButton icon={<Rocket size={15} />} label="Nova Release" />
          <HeaderButton icon={<History size={15} />} label="Ver Historico" />
        </div>
      </div>
    </section>
  );
}

function VersionsStats({
  globalVersion,
  globalMinimum,
  updatedPercent,
  releasedAt,
}: {
  globalVersion: string;
  globalMinimum: string | null;
  updatedPercent: number;
  releasedAt: number | null;
}) {
  return (
    <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Metric icon={<Rocket size={17} />} label="Versao Global" value={globalVersion} />
      <Metric icon={<ShieldAlert size={17} />} label="Versao Minima" value={globalMinimum ?? "sem minimo"} />
      <Metric icon={<Users size={17} />} label="Clientes Atualizados" value={`${updatedPercent}%`} />
      <Metric icon={<Clock3 size={17} />} label="Ultima Release" value={releasedAt ? dateText(releasedAt) : "sem data"} />
    </div>
  );
}

function VersionCards({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-white/[0.07] bg-[var(--panel-surface)] p-5">
      <header className="mb-5">
        <h2 className="text-[16px] font-semibold text-white">{title}</h2>
        <p className="mt-1 text-[12.5px] text-white/35">{subtitle}</p>
      </header>
      {children}
    </section>
  );
}

function RoleAssignment({
  target,
  globalVersion,
  globalMinimum,
  versions,
  usage,
}: {
  target: RoleTarget;
  globalVersion: string;
  globalMinimum: string | null;
  versions: VersionInfo[];
  usage: Record<string, number>;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [appVersion, setAppVersion] = useState(target.app_version ?? "");
  const [minVersion, setMinVersion] = useState(target.app_min_supported ?? "");
  const [saving, setSaving] = useState(false);
  const [isPending, startTransition] = useTransition();
  const effective = appVersion || globalVersion;
  const minimum = minVersion || globalMinimum;
  const developer = target.id === "role:developer";

  function submit() {
    setSaving(true);
    window.setTimeout(() => setSaving(false), 650);
    startTransition(() => formRef.current?.requestSubmit());
  }

  return (
    <form ref={formRef} action={updateRoleVersionAction} className="rounded-2xl border border-white/[0.07] bg-black/20 p-4">
      <input type="hidden" name="target" value={target.id} />
      <input type="hidden" name="appVersion" value={appVersion} />
      <input type="hidden" name="appMinSupported" value={minVersion} />
      {developer && (
        <>
          <input type="hidden" name="confirmDeveloper" value="1" />
          <input type="hidden" name="confirmDeveloperAgain" value="1" />
        </>
      )}
      <AssignmentTop
        title={target.label}
        subtitle="Cargo interno"
        version={effective}
        minimum={minimum}
        channel={developer ? "Developer" : "Stable"}
        status={isPending || saving ? "A guardar..." : "Guardado"}
      />
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <ReleaseBrowser
          label="Versao atual"
          value={appVersion}
          fallback={globalVersion}
          emptyLabel="Usar global"
          versions={versions}
          usage={usage}
          globalMinimum={globalMinimum}
          onSelect={(value) => {
            setAppVersion(value);
            window.setTimeout(submit, 0);
          }}
        />
        <ReleaseBrowser
          label="Versao minima"
          value={minVersion}
          fallback={globalMinimum ?? "sem minimo global"}
          emptyLabel="Usar minima global"
          versions={versions}
          usage={usage}
          globalMinimum={globalMinimum}
          onSelect={(value) => {
            setMinVersion(value);
            window.setTimeout(submit, 0);
          }}
        />
      </div>
      {developer && (
        <div className="mt-3 rounded-xl border border-[var(--warning)]/20 bg-[var(--warning)]/[0.06] p-3 text-[11.5px] text-white/50">
          Developer usa dupla confirmação automática neste painel para manter a proteção da action.
        </div>
      )}
    </form>
  );
}

function PlanAssignment({
  plan,
  globalVersion,
  globalMinimum,
  versions,
  usage,
}: {
  plan: PlanTarget;
  globalVersion: string;
  globalMinimum: string | null;
  versions: VersionInfo[];
  usage: Record<string, number>;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [appVersion, setAppVersion] = useState(plan.app_version ?? "");
  const [minVersion, setMinVersion] = useState(plan.app_min_supported ?? "");
  const [saving, setSaving] = useState(false);
  const [isPending, startTransition] = useTransition();
  const effective = appVersion || globalVersion;
  const minimum = minVersion || globalMinimum;

  function submit() {
    setSaving(true);
    window.setTimeout(() => setSaving(false), 650);
    startTransition(() => formRef.current?.requestSubmit());
  }

  return (
    <form ref={formRef} action={updatePlanVersionAction} className="rounded-2xl border border-white/[0.07] bg-black/20 p-4">
      <input type="hidden" name="planId" value={plan.id} />
      <input type="hidden" name="appVersion" value={appVersion} />
      <input type="hidden" name="appMinSupported" value={minVersion} />
      <div className="grid gap-4 lg:grid-cols-[190px_minmax(0,1fr)_220px_220px] lg:items-center">
        <div className="aspect-[16/9] overflow-hidden rounded-xl border border-white/[0.08] bg-[var(--panel-surface-2)]">
          {plan.cover_url ? (
            <img src={plan.cover_url} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="grid h-full place-items-center">
              <Boxes size={24} className="text-white/18" />
            </div>
          )}
        </div>
        <AssignmentTop
          title={plan.name}
          subtitle={plan.code}
          version={effective}
          minimum={minimum}
          channel={plan.active === 1 ? "Stable" : "Legacy"}
          status={isPending || saving ? "A guardar..." : "Guardado"}
        />
        <ReleaseBrowser
          label="Versao atribuida"
          value={appVersion}
          fallback={globalVersion}
          emptyLabel="Usar global"
          versions={versions}
          usage={usage}
          globalMinimum={globalMinimum}
          onSelect={(value) => {
            setAppVersion(value);
            window.setTimeout(submit, 0);
          }}
        />
        <ReleaseBrowser
          label="Versao minima"
          value={minVersion}
          fallback={globalMinimum ?? "sem minimo global"}
          emptyLabel="Usar minima global"
          versions={versions}
          usage={usage}
          globalMinimum={globalMinimum}
          onSelect={(value) => {
            setMinVersion(value);
            window.setTimeout(submit, 0);
          }}
        />
      </div>
    </form>
  );
}

function AssignmentTop({
  title,
  subtitle,
  version,
  minimum,
  channel,
  status,
}: {
  title: string;
  subtitle: string;
  version: string;
  minimum: string | null;
  channel: string;
  status: string;
}) {
  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="truncate text-[16px] font-semibold text-white">{title}</h3>
        <Badge label={channel} />
        <Badge label={status} muted={status === "Guardado"} />
      </div>
      <p className="mt-1 text-[12px] text-white/30">{subtitle}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Pill label={`Versao ${version}`} tone="gold" />
        <Pill label={`Minima ${minimum ?? "sem minimo"}`} />
        <Pill label="Ultima alteracao preparada" />
      </div>
    </div>
  );
}

function ReleaseBrowser({
  label,
  value,
  fallback,
  emptyLabel,
  versions,
  usage,
  globalMinimum,
  onSelect,
}: {
  label: string;
  value: string;
  fallback: string;
  emptyLabel: string;
  versions: VersionInfo[];
  usage: Record<string, number>;
  globalMinimum: string | null;
  onSelect: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = value || fallback;

  return (
    <div>
      <span className="mb-2 block text-[11.5px] font-semibold text-white/45">{label}</span>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-11 w-full items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/25 px-3 text-left transition hover:border-[var(--chart-1)]"
      >
        <span className={`truncate font-mono text-[13px] ${value ? "text-white" : "text-white/35"}`}>
          {value || `${emptyLabel} (${fallback})`}
        </span>
        <MonitorDown size={15} className="shrink-0 text-[var(--chart-1)]" />
      </button>
      {open && (
        <ReleaseBrowserModal
          selected={selected}
          emptyLabel={emptyLabel}
          fallback={fallback}
          versions={versions}
          usage={usage}
          globalMinimum={globalMinimum}
          onClose={() => setOpen(false)}
          onSelect={(next) => {
            onSelect(next);
            setOpen(false);
          }}
        />
      )}
    </div>
  );
}

function ReleaseBrowserModal({
  selected,
  emptyLabel,
  fallback,
  versions,
  usage,
  globalMinimum,
  onClose,
  onSelect,
}: {
  selected: string;
  emptyLabel: string;
  fallback: string;
  versions: VersionInfo[];
  usage: Record<string, number>;
  globalMinimum: string | null;
  onClose: () => void;
  onSelect: (value: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [detail, setDetail] = useState<VersionInfo>(versions.find((v) => v.version === selected) ?? versions[0]);
  const filtered = versions.filter((version) => {
    const haystack = [version.version, version.channel, version.scope, ...version.notes].join(" ").toLocaleLowerCase("pt");
    const matchesQuery = !query || haystack.includes(query.toLocaleLowerCase("pt"));
    const matchesFilter =
      filter === "all" ||
      (filter === "recent" ? true : filter === "old" ? true : version.channel.toLocaleLowerCase("pt") === filter);
    return matchesQuery && matchesFilter;
  });
  const sorted = filter === "old" ? [...filtered].reverse() : filtered;

  return (
    <div className="fixed inset-0 z-[95] grid place-items-center overflow-hidden bg-black/80 px-4 backdrop-blur-sm">
      <section role="dialog" aria-modal="true" className="flex max-h-[86dvh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-[var(--chart-1)]/25 bg-[var(--panel-surface)] shadow-2xl shadow-black/60">
        <header className="flex items-start justify-between gap-4 border-b border-white/[0.07] bg-black/20 px-5 py-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--chart-1)]">Browser de Releases</p>
            <h2 className="mt-1 text-[17px] font-bold text-white">Selecionar versao</h2>
            <p className="mt-1 text-[12.5px] text-white/35">Pesquisa, filtra, compara e escolhe uma release publicada.</p>
          </div>
          <button type="button" onClick={onClose} className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-white/45 transition-colors hover:bg-white/[0.06] hover:text-white" aria-label="Fechar">
            <X size={16} />
          </button>
        </header>

        <div className="grid min-h-0 flex-1 grid-cols-[260px_minmax(0,1fr)_330px] gap-4 p-4 max-lg:grid-cols-1">
          <aside className="space-y-3">
            <label className="relative block">
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/28" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Pesquisar versao..." className="h-10 w-full rounded-xl border border-white/[0.08] bg-[var(--panel-surface-2)] pl-9 pr-3 text-[12.5px] text-white outline-none placeholder:text-white/25 focus:border-[var(--chart-1)]" />
            </label>
            <div className="grid gap-1 rounded-xl border border-white/[0.07] bg-black/20 p-2">
              {[
                ["all", "Todas"],
                ["stable", "Stable"],
                ["beta", "Beta"],
                ["developer", "Developer"],
                ["legacy", "Legacy"],
                ["recent", "Mais recentes"],
                ["old", "Mais antigas"],
              ].map(([key, label]) => (
                <button key={key} type="button" onClick={() => setFilter(key)} className={`rounded-lg px-3 py-2 text-left text-[12px] font-semibold transition ${filter === key ? "bg-[var(--chart-1)]/10 text-[var(--chart-1)]" : "text-white/42 hover:bg-white/[0.04] hover:text-white"}`}>
                  {label}
                </button>
              ))}
            </div>
            <button type="button" onClick={() => onSelect("")} className="flex w-full items-center gap-3 rounded-xl border border-white/[0.07] bg-black/20 p-3 text-left transition hover:border-[var(--chart-1)]/35">
              <MonitorDown size={16} className="text-[var(--chart-1)]" />
              <span>
                <strong className="block text-[12.5px] text-white">{emptyLabel}</strong>
                <span className="text-[11px] text-white/32">Segue {fallback}</span>
              </span>
            </button>
          </aside>

          <div className="min-h-0 overflow-y-auto pr-1 [scrollbar-color:rgba(214,167,91,.55)_rgba(255,255,255,.04)]">
            <div className="space-y-2">
              {sorted.map((version) => (
                <ReleaseCard
                  key={version.version}
                  info={version}
                  active={selected === version.version}
                  clients={usage[version.version] ?? 0}
                  globalMinimum={globalMinimum}
                  onInspect={() => setDetail(version)}
                  onSelect={() => onSelect(version.version)}
                />
              ))}
            </div>
          </div>

          <ReleaseDetails info={detail} clients={usage[detail?.version] ?? 0} globalMinimum={globalMinimum} />
        </div>
      </section>
    </div>
  );
}

function ReleaseCard({
  info,
  active,
  clients,
  globalMinimum,
  onInspect,
  onSelect,
}: {
  info: VersionInfo;
  active: boolean;
  clients: number;
  globalMinimum: string | null;
  onInspect: () => void;
  onSelect: () => void;
}) {
  const incompatible = globalMinimum ? compareVersions(info.version, globalMinimum) < 0 : false;
  return (
    <article onMouseEnter={onInspect} className={`rounded-xl border p-3 transition hover:border-[var(--chart-1)]/35 ${active ? "border-[var(--chart-1)]/45 bg-[var(--chart-1)]/10" : "border-white/[0.07] bg-black/20"}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-mono text-[16px] font-bold text-white">{info.version}</div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Badge label={info.channel} />
            <Badge label={info.scope} muted />
            {info.current && <Badge label="Atual" />}
            {incompatible && <Badge label="Abaixo da minima" warning />}
          </div>
        </div>
        <button type="button" onClick={onSelect} className="rounded-lg bg-[var(--chart-1)] px-3 py-2 text-[11.5px] font-bold text-[#16082c]">
          Selecionar
        </button>
      </div>
      <div className="mt-3 flex items-center justify-between text-[11.5px] text-white/35">
        <span>{info.releasedAt ? dateText(info.releasedAt) : "data local"}</span>
        <span>{clients} clientes</span>
      </div>
    </article>
  );
}

function ReleaseDetails({ info, clients, globalMinimum }: { info?: VersionInfo; clients: number; globalMinimum: string | null }) {
  if (!info) return null;
  const incompatible = globalMinimum ? compareVersions(info.version, globalMinimum) < 0 : false;
  return (
    <aside className="min-h-0 overflow-y-auto rounded-xl border border-white/[0.07] bg-black/20 p-4">
      <div className="font-mono text-2xl font-bold text-white">{info.version}</div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <Badge label={info.channel} />
        <Badge label={info.scope} muted />
        <Badge label={`${clients} clientes`} />
      </div>
      <div className="mt-5 space-y-2 text-[12px] text-white/42">
        <InfoRow label="Build" value={info.version} />
        <InfoRow label="Data" value={info.releasedAt ? dateText(info.releasedAt) : "local"} />
        <InfoRow label="Compatibilidade" value={incompatible ? "Abaixo da minima global" : "Compatível"} />
        <InfoRow label="Windows" value={info.channel === "Legacy" ? "Windows 10" : "Windows 10 / 11"} />
        <InfoRow label="Estado" value={info.current ? "Atual" : info.channel} />
      </div>
      {incompatible && (
        <div className="mt-4 rounded-xl border border-[var(--warning)]/25 bg-[var(--warning)]/[0.06] p-3 text-[12px] text-[var(--warning)]">
          Esta versao e inferior a versao minima global.
        </div>
      )}
      <ReleaseNotes notes={info.notes} />
      <ReleaseCompare current={info.version} />
    </aside>
  );
}

function ReleaseNotes({ notes }: { notes: string[] }) {
  return (
    <section className="mt-5">
      <h3 className="text-[13px] font-semibold text-white">Release notes</h3>
      <ul className="mt-3 space-y-2">
        {(notes.length ? notes : ["Melhorias de estabilidade", "Atualizacao do motor Orion", "Correcoes internas"]).map((note) => (
          <li key={note} className="flex items-start gap-2 text-[12.5px] text-white/48">
            <Check size={13} className="mt-0.5 text-[var(--chart-1)]" />
            {note}
          </li>
        ))}
      </ul>
    </section>
  );
}

function ReleaseCompare({ current }: { current: string }) {
  return (
    <section className="mt-5 rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
      <div className="flex items-center gap-2 text-[12.5px] font-semibold text-white">
        <GitCompare size={14} className="text-[var(--chart-1)]" />
        Comparar versoes
      </div>
      <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <input value={current} readOnly className="h-9 rounded-lg border border-white/[0.08] bg-black/20 px-3 font-mono text-[12px] text-white/50" />
        <span className="text-white/25">→</span>
        <input value={current} readOnly className="h-9 rounded-lg border border-white/[0.08] bg-black/20 px-3 font-mono text-[12px] text-white/50" />
      </div>
      <p className="mt-2 text-[11.5px] text-white/30">Diferenças preparadas para changelog estruturado.</p>
    </section>
  );
}

function VersionStatus({ versions, usage }: { versions: VersionInfo[]; usage: Record<string, number> }) {
  const rows = versions.slice(0, 7);
  const max = Math.max(...rows.map((version) => usage[version.version] ?? 0), 1);
  return (
    <section className="rounded-2xl border border-white/[0.07] bg-[var(--panel-surface)] p-5">
      <h2 className="text-[15px] font-semibold text-white">Estado das releases</h2>
      <p className="mt-1 text-[12.5px] text-white/35">Clientes por versão instalada.</p>
      <div className="mt-5 space-y-4">
        {rows.map((version) => {
          const count = usage[version.version] ?? 0;
          return (
            <div key={version.version}>
              <div className="mb-1 flex items-center justify-between text-[12px]">
                <span className="font-mono text-white">{version.version}</span>
                <span className="text-white/38">{count} clientes</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white/[0.05]">
                <div className="h-full rounded-full bg-[var(--chart-1)]" style={{ width: `${Math.max(4, (count / max) * 100)}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function VersionsTimeline({ globalVersion, plans, roleTargets }: { globalVersion: string; plans: PlanTarget[]; roleTargets: RoleTarget[] }) {
  const rows = [
    ["Hoje", `Versao global ${globalVersion}`],
    ["Planos", `${plans.length} planos configuraveis`],
    ["Interno", `${roleTargets.length} cargos internos preparados`],
    ["Historico", "Auditoria gravada nas actions atuais"],
  ];
  return (
    <section className="rounded-2xl border border-white/[0.07] bg-[var(--panel-surface)] p-5">
      <h2 className="text-[15px] font-semibold text-white">Historico</h2>
      <div className="mt-5 space-y-4">
        {rows.map(([time, text]) => (
          <div key={`${time}-${text}`} className="relative pl-5">
            <span className="absolute left-0 top-1.5 h-2 w-2 rounded-full bg-[var(--chart-1)]" />
            <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/28">{time}</div>
            <div className="mt-0.5 text-[12.5px] text-white/55">{text}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function ReleasePublish({ version, plans, roleTargets, estimatedClients, onClose }: { version: string; plans: PlanTarget[]; roleTargets: RoleTarget[]; estimatedClients: number; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-black/80 p-4 backdrop-blur-sm">
      <section className="w-full max-w-2xl rounded-2xl border border-[var(--chart-1)]/25 bg-[var(--panel-surface)] p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--chart-1)]">Publicacao</p>
            <h2 className="mt-1 text-xl font-bold text-white">Libertar versao atualizada para todos</h2>
          </div>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg text-white/45 hover:bg-white/[0.06] hover:text-white" aria-label="Fechar">
            <X size={16} />
          </button>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <Metric icon={<Rocket size={16} />} label="Versao" value={version} compact />
          <Metric icon={<Boxes size={16} />} label="Planos afetados" value={String(plans.length)} compact />
          <Metric icon={<Users size={16} />} label="Clientes estimados" value={String(estimatedClients)} compact />
        </div>
        <div className="mt-5 rounded-xl border border-white/[0.07] bg-black/20 p-4">
          <div className="mb-2 text-[12px] font-semibold text-white">Afetados</div>
          <div className="flex flex-wrap gap-2">
            {plans.map((plan) => <Pill key={plan.id} label={plan.name} />)}
            {roleTargets.map((target) => <Pill key={target.id} label={target.label} tone="gold" />)}
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg px-4 py-2.5 text-[12.5px] font-bold text-white/45 hover:text-white">Cancelar</button>
          <form action={releaseCurrentVersionForAllPlansAction}>
            <button className="rounded-lg bg-[var(--chart-1)] px-4 py-2.5 text-[12.5px] font-bold text-[#16082c]">Publicar</button>
          </form>
        </div>
      </section>
    </div>
  );
}

function Metric({ icon, label, value, compact }: { icon: ReactNode; label: string; value: string; compact?: boolean }) {
  return (
    <div className={`rounded-2xl border border-white/[0.07] bg-[var(--panel-surface)] ${compact ? "p-3" : "p-5"}`}>
      <div className="flex items-center gap-2 text-[var(--chart-1)]">
        {icon}
        <span className="text-[10.5px] font-bold uppercase tracking-wide">{label}</span>
      </div>
      <p className="mt-3 font-mono text-[22px] font-bold text-white">{value}</p>
    </div>
  );
}

function HeaderButton({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <button type="button" className="inline-flex h-10 items-center gap-2 rounded-lg border border-white/10 px-4 text-[13px] font-semibold text-white/60 transition hover:-translate-y-0.5 hover:border-[var(--chart-1)] hover:text-white">
      {icon}
      {label}
    </button>
  );
}

function Pill({ label, tone }: { label: string; tone?: "gold" }) {
  return (
    <span className={`rounded-full border px-2.5 py-1 font-semibold ${tone === "gold" ? "border-[var(--chart-1)]/35 bg-[var(--chart-1)]/10 text-[var(--chart-1)]" : "border-white/[0.08] bg-white/[0.035] text-white/45"}`}>
      {label}
    </span>
  );
}

function Badge({ label, muted, warning }: { label: string; muted?: boolean; warning?: boolean }) {
  const cls = warning
    ? "bg-[var(--warning)]/10 text-[var(--warning)]"
    : muted
      ? "bg-white/[0.06] text-white/45"
      : "bg-[var(--chart-1)]/10 text-[var(--chart-1)]";
  return <span className={`rounded-md px-2 py-1 text-[10px] font-bold uppercase ${cls}`}>{label}</span>;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-white/[0.05] pb-2 last:border-b-0">
      <span className="text-white/30">{label}</span>
      <span className="max-w-[58%] text-right text-white/62">{value}</span>
    </div>
  );
}

function dateText(seconds: number): string {
  return new Intl.DateTimeFormat("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(seconds * 1000));
}
