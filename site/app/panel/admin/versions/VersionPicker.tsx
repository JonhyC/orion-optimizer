"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, MonitorDown, X } from "lucide-react";

export default function VersionPicker({
  name,
  label,
  value,
  fallback,
  versions,
  emptyLabel,
}: {
  name: string;
  label: string;
  value: string | null;
  fallback: string;
  versions: string[];
  emptyLabel: string;
}) {
  const [selected, setSelected] = useState(value ?? "");
  const [open, setOpen] = useState(false);
  const groups = useMemo(() => groupVersions(versions), [versions]);
  const display = selected || `${emptyLabel} (${fallback})`;

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  return (
    <div>
      <input type="hidden" name={name} value={selected} />
      <span className="mb-2 block text-[11.5px] font-semibold text-white/45">{label}</span>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-10 w-full items-center justify-between gap-3 rounded-md border border-white/10 bg-black/25 px-3 text-left transition-colors hover:border-[var(--chart-1)]"
      >
        <span className={`truncate font-mono text-[13px] ${selected ? "text-white" : "text-white/35"}`}>
          {display}
        </span>
        <ChevronDown size={15} className="shrink-0 text-[var(--chart-1)]" />
      </button>

      {open && (
        <div className="fixed inset-0 z-[95] grid place-items-center overflow-hidden bg-black/80 px-4 backdrop-blur-sm">
          <section
            role="dialog"
            aria-modal="true"
            aria-label={`Selecionar ${label}`}
            className="flex max-h-[82dvh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-[var(--chart-1)]/25 bg-[var(--panel-surface)] shadow-2xl shadow-black/60"
            onWheel={(event) => event.stopPropagation()}
          >
            <header className="flex items-start justify-between gap-4 border-b border-white/[0.07] bg-black/20 px-5 py-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--chart-1)]">Releases</p>
                <h2 className="mt-1 text-[17px] font-bold text-white">{label}</h2>
                <p className="mt-1 text-[12.5px] text-white/35">Escolhe uma versao ja publicada do Orion Optimizer.</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-white/45 transition-colors hover:bg-white/[0.06] hover:text-white"
                aria-label="Fechar"
              >
                <X size={16} />
              </button>
            </header>

            <div className="grid min-h-0 flex-1 gap-4 p-4 md:grid-cols-[230px_minmax(0,1fr)]">
              <aside className="rounded-lg border border-white/[0.07] bg-black/20 p-3">
                <button
                  type="button"
                  onClick={() => {
                    setSelected("");
                    setOpen(false);
                  }}
                  className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors ${
                    selected === ""
                      ? "border-[var(--chart-1)]/45 bg-[var(--chart-1)]/10"
                      : "border-white/[0.07] bg-black/20 hover:border-white/15"
                  }`}
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-[var(--chart-1)]/10 text-[var(--chart-1)]">
                    <MonitorDown size={16} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <strong className="block text-[13px] text-white">{emptyLabel}</strong>
                    <span className="mt-1 block text-[11.5px] leading-4 text-white/35">Segue a versao global: {fallback}</span>
                  </span>
                  {selected === "" && <Check size={16} className="text-[var(--chart-1)]" />}
                </button>
              </aside>

              <div className="min-h-0 overflow-y-auto pr-1 [scrollbar-color:rgba(214,167,91,.55)_rgba(255,255,255,.04)]">
                <div className="grid gap-4 lg:grid-cols-2">
                  {groups.map((group) => (
                    <section key={group.label} className="min-w-0 rounded-lg border border-white/[0.07] bg-black/20 p-3">
                      <div className="mb-3 flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/30">{group.label}</span>
                        <span className="text-[10px] text-white/20">{group.items.length} versoes</span>
                      </div>
                      <div className="grid gap-2">
                        {group.items.map((version) => {
                          const active = selected === version;
                          return (
                            <button
                              key={version}
                              type="button"
                              onClick={() => {
                                setSelected(version);
                                setOpen(false);
                              }}
                              className={`flex min-h-10 items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors ${
                                active
                                  ? "border-[var(--chart-1)]/45 bg-[var(--chart-1)]/10"
                                  : "border-white/[0.07] bg-black/20 hover:border-white/15"
                              }`}
                            >
                              <span className="min-w-0 flex-1 font-mono text-[13px] text-white">{version}</span>
                              {version === fallback && (
                                <span className="rounded-md bg-[var(--chart-1)]/10 px-2 py-1 text-[10px] font-bold text-[var(--chart-1)]">
                                  global
                                </span>
                              )}
                              {active && <Check size={16} className="text-[var(--chart-1)]" />}
                            </button>
                          );
                        })}
                      </div>
                    </section>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function groupVersions(versions: string[]) {
  const groups = new Map<string, string[]>();
  for (const version of versions) {
    const label = version.startsWith("2.") ? "Orion Optimizer 2.0" : "Legacy Orion 1.x";
    groups.set(label, [...(groups.get(label) ?? []), version]);
  }
  return [...groups.entries()].map(([label, items]) => ({ label, items }));
}
