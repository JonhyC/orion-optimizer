"use client";

import { useMemo, useState } from "react";
import { Copy, Filter, Pencil, Plus, Power, Search, Trash2 } from "lucide-react";
import TweakEditor from "./TweakEditor";
import { cloneTweakAction, deleteTweakAction, toggleTweakAction } from "../../catalog-actions";
import {
  TIER_LABELS,
  groupTweaksByTier,
  isTweakEnabled,
  minimumTierForTweak,
  type OptimizerTier,
} from "@/lib/optimizer-access";
import type { Tweak } from "@/lib/catalog";

/**
 * Nota sobre o import acima: optimizer-access.ts so tem imports de tipo,
 * portanto nao arrasta o node:fs do catalog.ts para o bundle do cliente.
 */
const TIER_HINTS: Record<OptimizerTier, string> = {
  basic: "Todos os planos veem estas.",
  pro: "Pro, Ultimate e Special.",
  ultimate: "Ultimate e Special.",
  special: "So planos personalizados atribuidos pelo Owner.",
};

export default function CatalogManager({
  tweaks,
  rules,
}: {
  tweaks: Tweak[];
  rules: Array<{ pattern: string; reason: string }>;
}) {
  const [editing, setEditing] = useState<Tweak | "new" | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [gpuVendor, setGpuVendor] = useState("all");
  const [gpuType, setGpuType] = useState("all");
  const [tier, setTier] = useState("all");
  const [status, setStatus] = useState("all");

  const filteredTweaks = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("pt");
    return tweaks.filter((tweak) => {
      const vendors = tweak.conditions?.gpuVendor;
      const types = tweak.conditions?.gpuType;
      // A pesquisa cobre os caminhos do registry: e assim que se descobre
      // que dois tweaks escrevem na mesma chave e vao entrar em conflito.
      const haystack = [
        tweak.name,
        tweak.id,
        tweak.description,
        ...tweak.actions.map((a) => `${a.hive}\\${a.key} ${a.name}`),
      ]
        .join(" ")
        .toLocaleLowerCase("pt");
      const matchesQuery = !normalizedQuery || haystack.includes(normalizedQuery);
      const matchesVendor =
        gpuVendor === "all" || !vendors?.length || vendors.includes(gpuVendor as never);
      const matchesType = gpuType === "all" || !types?.length || types.includes(gpuType as never);
      const matchesTier = tier === "all" || minimumTierForTweak(tweak) === tier;
      const matchesStatus =
        status === "all" ||
        (status === "enabled" ? isTweakEnabled(tweak) : !isTweakEnabled(tweak));
      return matchesQuery && matchesVendor && matchesType && matchesTier && matchesStatus;
    });
  }, [gpuType, gpuVendor, query, status, tier, tweaks]);

  const suspended = useMemo(() => tweaks.filter((t) => !isTweakEnabled(t)).length, [tweaks]);

  /**
   * Chaves escritas por mais do que um tweak. Duas optimizacoes no mesmo
   * valor sobrepoem-se pela ordem de aplicacao, e o journal so guarda o
   * estado anterior a primeira - o rollback fica correcto, o resultado
   * final e que passa a depender da ordem.
   */
  const conflicts = useMemo(() => {
    const seen = new Map<string, string[]>();
    for (const t of tweaks) {
      if (!isTweakEnabled(t)) continue;
      for (const a of t.actions) {
        const key = `${a.hive}\\${a.key}\\${a.name}`.toLocaleLowerCase("pt");
        seen.set(key, [...(seen.get(key) ?? []), t.id]);
      }
    }
    return [...seen.entries()]
      .filter(([, ids]) => new Set(ids).size > 1)
      .map(([key, ids]) => ({ key, ids: [...new Set(ids)] }));
  }, [tweaks]);

  const groups = useMemo(
    () => groupTweaksByTier(filteredTweaks).filter((g) => g.tweaks.length > 0),
    [filteredTweaks],
  );

  return (
    <>
      <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-[15px] font-semibold text-white">
          {tweaks.length} tweaks no catalogo
          {suspended > 0 && (
            <span className="ml-2 text-[13px] font-normal text-[var(--warning)]">
              {suspended} suspenso{suspended === 1 ? "" : "s"}
            </span>
          )}
        </h2>
        {!editing && (
          <button
            onClick={() => setEditing("new")}
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--chart-1)] px-4 py-2.5 text-[13px] font-semibold text-[#16082c] transition-opacity hover:opacity-90"
          >
            <Plus size={15} />
            Novo tweak
          </button>
        )}
      </div>

      <div className="mt-5 grid gap-3 rounded-xl border border-white/[0.06] bg-[var(--panel-surface)] p-4 md:grid-cols-2 xl:grid-cols-[minmax(190px,1fr)_160px_170px_180px_170px]">
        <label className="relative">
          <span className="sr-only">Pesquisar no catalogo</span>
          <Search
            size={15}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/30"
          />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Pesquisar optimizacao"
            className="h-10 w-full rounded-lg border border-white/[0.08] bg-[var(--panel-surface-2)] pl-9 pr-3 text-[13px] text-white outline-none placeholder:text-white/25 focus:border-[var(--chart-1)]"
          />
        </label>
        <FilterSelect label="Fabricante" value={gpuVendor} onChange={setGpuVendor}>
          <option value="all">Todas as GPUs</option>
          <option value="NVIDIA">NVIDIA</option>
          <option value="AMD">AMD</option>
          <option value="Intel">Intel</option>
        </FilterSelect>
        <FilterSelect label="Tipo" value={gpuType} onChange={setGpuType}>
          <option value="all">Todos os tipos</option>
          <option value="integrated">Graficos integrados</option>
          <option value="dedicated">GPU dedicada</option>
        </FilterSelect>
        <FilterSelect label="Plano minimo" value={tier} onChange={setTier}>
          <option value="all">Todos os planos</option>
          <option value="basic">Basic</option>
          <option value="pro">Pro</option>
          <option value="ultimate">Ultimate</option>
          <option value="special">Special</option>
        </FilterSelect>
        <FilterSelect label="Estado" value={status} onChange={setStatus}>
          <option value="all">Activos e suspensos</option>
          <option value="enabled">So activos</option>
          <option value="disabled">So suspensos</option>
        </FilterSelect>
      </div>

      {conflicts.length > 0 && (
        <section className="mt-4 rounded-xl border border-[var(--warning)]/30 bg-[var(--warning)]/[0.07] p-4">
          <h3 className="text-[13px] font-semibold text-[var(--warning)]">
            {conflicts.length} valor{conflicts.length === 1 ? "" : "es"} escrito
            {conflicts.length === 1 ? "" : "s"} por mais do que um tweak
          </h3>
          <p className="mt-1 text-[12px] leading-relaxed text-white/40">
            O rollback continua correcto — o journal guarda o estado anterior à
            primeira escrita. O que fica por definir é o resultado final, que
            passa a depender da ordem de aplicação.
          </p>
          <ul className="mt-2.5 space-y-1">
            {conflicts.map((c) => (
              <li key={c.key} className="font-mono text-[11.5px] text-white/45">
                {c.key}
                <span className="text-white/25"> — {c.ids.join(", ")}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {editing && (
        <div className="mt-5">
          <TweakEditor
            tweak={editing === "new" ? undefined : editing}
            onClose={() => setEditing(null)}
          />
        </div>
      )}

      <div className="mt-5 space-y-8">
        {groups.map((group) => (
          <section key={group.tier}>
            <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-white/[0.07] pb-2.5">
              <h3 className="text-[13.5px] font-semibold text-white">
                {TIER_LABELS[group.tier]}
              </h3>
              <span className="text-[12px] text-white/30">
                {group.tweaks.length}{" "}
                {group.tweaks.length === 1 ? "optimizacao" : "optimizacoes"}
              </span>
              <span className="text-[12px] text-white/25">{TIER_HINTS[group.tier]}</span>
            </header>

            <div className="mt-3 space-y-3">
              {group.tweaks.map((t) => (
                <TweakCard
                  key={t.id}
                  tweak={t}
                  confirming={confirming === t.id}
                  onEdit={() => setEditing(t)}
                  onAskDelete={() => setConfirming(t.id)}
                  onCancelDelete={() => setConfirming(null)}
                />
              ))}
            </div>
          </section>
        ))}
        {filteredTweaks.length === 0 && (
          <div className="rounded-xl border border-dashed border-white/10 px-5 py-10 text-center">
            <Filter size={18} className="mx-auto text-white/25" />
            <p className="mt-2 text-[13px] text-white/40">
              Nenhuma optimizacao corresponde a estes filtros.
            </p>
          </div>
        )}
      </div>

      <section className="mt-8 rounded-2xl border border-white/[0.07] bg-[var(--panel-surface)] p-6">
        <h2 className="text-[14px] font-semibold text-white">Caminhos bloqueados</h2>
        <p className="mt-1.5 max-w-2xl text-[12.5px] leading-relaxed text-white/35">
          Estas barreiras correm no servidor a cada gravação e não têm
          interruptor — nem para o owner. Cada uma corresponde a uma forma
          conhecida de partir um Windows, não a uma preferência de desenho.
        </p>
        <ul className="mt-4 space-y-2.5">
          {rules.map((r) => (
            <li key={r.pattern} className="text-[12px] leading-relaxed">
              <code className="text-[var(--warning)]">{r.pattern}</code>
              <span className="text-white/30"> — {r.reason}</span>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

function TweakCard({
  tweak: t,
  confirming,
  onEdit,
  onAskDelete,
  onCancelDelete,
}: {
  tweak: Tweak;
  confirming: boolean;
  onEdit: () => void;
  onAskDelete: () => void;
  onCancelDelete: () => void;
}) {
  const live = isTweakEnabled(t);

  return (
    <article
      className={`rounded-xl border p-5 transition-opacity ${
        live
          ? "border-white/[0.06] bg-[var(--panel-surface)]"
          : "border-dashed border-[var(--warning)]/25 bg-[var(--panel-surface)]/40 opacity-60"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[14.5px] font-semibold text-white">{t.name}</h3>
          <code className="mt-0.5 block font-mono text-[11.5px] text-white/25">{t.id}</code>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          {!live && <Chip label="suspenso" tone="warning" />}
          <Chip label={TIER_LABELS[minimumTierForTweak(t)]} tone="tier" />
          <Chip label={`camada ${t.layer}`} tone={t.layer === 0 ? "good" : "warning"} />
          <Chip label={`impacto: ${t.impact}`} />
          <Chip label={`risco: ${t.risk}`} />
          {t.conditions?.gpuVendor?.map((vendor) => (
            <Chip key={vendor} label={vendor} />
          ))}
          {t.conditions?.gpuType?.map((type) => (
            <Chip
              key={type}
              label={type === "integrated" ? "graficos integrados" : "GPU dedicada"}
            />
          ))}
          {t.requiresReboot && <Chip label="reinicio" tone="warning" />}

          <form action={toggleTweakAction} className="ml-1 flex">
            <input type="hidden" name="id" value={t.id} />
            <button
              className={`grid h-7 w-7 place-items-center rounded-lg border transition-colors ${
                live
                  ? "border-white/10 text-white/45 hover:border-[var(--warning)] hover:text-[var(--warning)]"
                  : "border-[var(--good)]/40 text-[var(--good)] hover:border-[var(--good)]"
              }`}
              aria-label={live ? "Suspender" : "Reactivar"}
              title={live ? "Suspender: deixa de ser servido" : "Reactivar"}
            >
              <Power size={12} />
            </button>
          </form>

          <form action={cloneTweakAction} className="flex">
            <input type="hidden" name="id" value={t.id} />
            <button
              className="grid h-7 w-7 place-items-center rounded-lg border border-white/10 text-white/45 transition-colors hover:border-[var(--chart-1)] hover:text-white"
              aria-label="Clonar"
              title="Clonar: cria uma copia suspensa"
            >
              <Copy size={12} />
            </button>
          </form>

          <button
            onClick={onEdit}
            className="grid h-7 w-7 place-items-center rounded-lg border border-white/10 text-white/45 transition-colors hover:border-[var(--chart-1)] hover:text-white"
            aria-label="Editar"
          >
            <Pencil size={12} />
          </button>

          {confirming ? (
            <form action={deleteTweakAction} className="flex items-center gap-1.5">
              <input type="hidden" name="id" value={t.id} />
              <button className="rounded-md bg-[var(--critical)] px-2.5 py-1 text-[11px] font-semibold text-white">
                Apagar
              </button>
              <button
                type="button"
                onClick={onCancelDelete}
                className="text-[11px] text-white/35 hover:text-white"
              >
                cancelar
              </button>
            </form>
          ) : (
            <button
              onClick={onAskDelete}
              className="grid h-7 w-7 place-items-center rounded-lg border border-white/10 text-white/45 transition-colors hover:border-[var(--critical)] hover:text-[var(--critical)]"
              aria-label="Apagar"
            >
              <Trash2 size={12} />
            </button>
          )}
        </div>
      </div>

      <p className="mt-3 text-[13px] leading-relaxed text-white/45">{t.description}</p>

      <details className="mt-3">
        <summary className="cursor-pointer text-[12px] text-white/30 hover:text-white/60">
          {t.actions.length} {t.actions.length === 1 ? "alteracao" : "alteracoes"}
        </summary>
        <ul className="mt-2.5 space-y-1.5">
          {t.actions.map((a, i) => (
            <li key={i} className="font-mono text-[11.5px] text-white/40">
              <span className="text-white/25">{a.hive}\</span>
              {a.key}
              <span className="text-white/25"> → </span>
              <span className="text-[var(--chart-1)]">{a.name}</span>
              <span className="text-white/25"> = </span>
              {String(a.value)}
            </li>
          ))}
        </ul>
      </details>
    </article>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="relative">
      <span className="sr-only">{label}</span>
      <Filter
        size={14}
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/30"
      />
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full appearance-none rounded-lg border border-white/[0.08] bg-[var(--panel-surface-2)] pl-9 pr-3 text-[13px] text-white outline-none focus:border-[var(--chart-1)]"
      >
        {children}
      </select>
    </label>
  );
}

function Chip({ label, tone }: { label: string; tone?: "good" | "warning" | "tier" }) {
  const cls =
    tone === "good"
      ? "text-[var(--good)] bg-[var(--good)]/10"
      : tone === "warning"
        ? "text-[var(--warning)] bg-[var(--warning)]/10"
        : tone === "tier"
          ? "text-[var(--chart-1)] bg-[var(--chart-1)]/12 ring-1 ring-[var(--chart-1)]/25"
          : "text-white/45 bg-white/[0.05]";
  return <span className={`rounded-full px-2.5 py-1 font-medium ${cls}`}>{label}</span>;
}
