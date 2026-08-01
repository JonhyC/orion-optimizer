"use client";

import { useMemo, useState } from "react";
import { Filter, Pencil, Plus, Search, Trash2 } from "lucide-react";
import TweakEditor from "./TweakEditor";
import { deleteTweakAction } from "../../catalog-actions";
import type { Tweak } from "@/lib/catalog";

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

  const filteredTweaks = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("pt");
    return tweaks.filter((tweak) => {
      const vendors = tweak.conditions?.gpuVendor;
      const types = tweak.conditions?.gpuType;
      const matchesQuery =
        !normalizedQuery ||
        `${tweak.name} ${tweak.id} ${tweak.description}`
          .toLocaleLowerCase("pt")
          .includes(normalizedQuery);
      const matchesVendor =
        gpuVendor === "all" || !vendors?.length || vendors.includes(gpuVendor as never);
      const matchesType = gpuType === "all" || !types?.length || types.includes(gpuType as never);
      return matchesQuery && matchesVendor && matchesType;
    });
  }, [gpuType, gpuVendor, query, tweaks]);

  return (
    <>
      <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-[15px] font-semibold text-white">
          {tweaks.length} tweaks no catalogo
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

      <div className="mt-5 grid gap-3 rounded-xl border border-white/[0.06] bg-[var(--panel-surface)] p-4 md:grid-cols-[minmax(220px,1fr)_180px_200px]">
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
      </div>

      {editing && (
        <div className="mt-5">
          <TweakEditor
            tweak={editing === "new" ? undefined : editing}
            onClose={() => setEditing(null)}
          />
        </div>
      )}

      <div className="mt-5 space-y-3">
        {filteredTweaks.map((t) => (
          <article
            key={t.id}
            className="rounded-xl border border-white/[0.06] bg-[var(--panel-surface)] p-5"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-[14.5px] font-semibold text-white">{t.name}</h3>
                <code className="mt-0.5 block font-mono text-[11.5px] text-white/25">{t.id}</code>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-[11px]">
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

                <button
                  onClick={() => setEditing(t)}
                  className="ml-1 grid h-7 w-7 place-items-center rounded-lg border border-white/10 text-white/45 transition-colors hover:border-[var(--chart-1)] hover:text-white"
                  aria-label="Editar"
                >
                  <Pencil size={12} />
                </button>

                {confirming === t.id ? (
                  <form action={deleteTweakAction} className="flex items-center gap-1.5">
                    <input type="hidden" name="id" value={t.id} />
                    <button className="rounded-md bg-[var(--critical)] px-2.5 py-1 text-[11px] font-semibold text-white">
                      Apagar
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirming(null)}
                      className="text-[11px] text-white/35 hover:text-white"
                    >
                      cancelar
                    </button>
                  </form>
                ) : (
                  <button
                    onClick={() => setConfirming(t.id)}
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

function Chip({ label, tone }: { label: string; tone?: "good" | "warning" }) {
  const cls =
    tone === "good"
      ? "text-[var(--good)] bg-[var(--good)]/10"
      : tone === "warning"
        ? "text-[var(--warning)] bg-[var(--warning)]/10"
        : "text-white/45 bg-white/[0.05]";
  return <span className={`rounded-full px-2.5 py-1 font-medium ${cls}`}>{label}</span>;
}
