import type { ReactNode } from "react";

/** Cartao base do painel. */
export function Card({
  title,
  subtitle,
  children,
  className = "",
}: {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`min-w-0 rounded-2xl border border-white/[0.07] bg-[var(--panel-surface)] p-6 ${className}`}>
      {title && (
        <header className="mb-5">
          <h2 className="text-[15px] font-semibold tracking-tight text-white">{title}</h2>
          {subtitle && <p className="mt-1 text-[12.5px] text-white/35">{subtitle}</p>}
        </header>
      )}
      {children}
    </section>
  );
}

/**
 * Numero em destaque.
 *
 * A variacao vem sempre com seta, numero e a frase do periodo: a cor sozinha
 * nunca carrega o significado.
 */
export function StatTile({
  label,
  value,
  delta,
  foot,
}: {
  label: string;
  value: string;
  delta?: number | null;
  foot?: string;
}) {
  const up = (delta ?? 0) >= 0;

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-[var(--panel-surface)] p-5">
      <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/35">{label}</div>
      <div className="mt-2 text-3xl font-bold tracking-tight tabular-nums text-white">{value}</div>

      {delta !== null && delta !== undefined && (
        <div className={`mt-1.5 text-[12.5px] ${up ? "text-[var(--good)]" : "text-[var(--critical)]"}`}>
          {up ? "▲" : "▼"} {Math.abs(delta).toFixed(1).replace(".", ",")}%
          <span className="text-white/30"> vs 30 dias antes</span>
        </div>
      )}

      {foot && <div className="mt-1.5 text-[12.5px] text-white/30">{foot}</div>}
    </div>
  );
}

/**
 * Comparacao de magnitude: uma cor so, o comprimento transporta o valor.
 * Rotulo direto no fim de cada barra.
 */
export function BarList({
  rows,
  empty = "Ainda sem dados.",
}: {
  rows: Array<{ label: string; value: number; display: string; note?: string }>;
  empty?: string;
}) {
  if (!rows.length) return <p className="py-8 text-center text-[13px] text-white/30">{empty}</p>;

  const max = Math.max(...rows.map((r) => r.value), 1);

  return (
    <div className="flex flex-col gap-4">
      {rows.map((r) => (
        <div key={r.label}>
          <div className="grid grid-cols-[110px_1fr_auto] items-center gap-3">
            <div className="truncate text-[13px] text-white/55">{r.label}</div>
            <div className="h-[22px] overflow-hidden rounded-md bg-white/[0.05]">
              <div
                className="h-full rounded-r-md bg-[var(--chart-1)]"
                style={{ width: `${Math.max((r.value / max) * 100, 1.5)}%` }}
              />
            </div>
            <div className="text-[13px] font-semibold tabular-nums text-white">{r.display}</div>
          </div>
          {r.note && <div className="mt-1 pl-[122px] text-[11.5px] text-white/25">{r.note}</div>}
        </div>
      ))}
    </div>
  );
}

const STATUS: Record<string, { label: string; cls: string }> = {
  paid: { label: "Pago", cls: "text-[var(--good)] bg-[var(--good)]/10" },
  pending: { label: "Pendente", cls: "text-[var(--warning)] bg-[var(--warning)]/10" },
  refunded: { label: "Reembolsado", cls: "text-[var(--serious)] bg-[var(--serious)]/10" },
  failed: { label: "Falhou", cls: "text-[var(--critical)] bg-[var(--critical)]/10" },
  active: { label: "Ativa", cls: "text-[var(--good)] bg-[var(--good)]/10" },
  suspended: { label: "Suspensa", cls: "text-[var(--critical)] bg-[var(--critical)]/10" },
};

/** Estado com ponto + texto: nunca so a cor. */
export function StatusBadge({ status }: { status: string }) {
  const s = STATUS[status] ?? { label: status, cls: "text-white/50 bg-white/[0.06]" };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-semibold ${s.cls}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {s.label}
    </span>
  );
}

/** Vista de tabela que acompanha cada gráfico. */
export function TableView({
  headers,
  rows,
  summary = "Ver dados em tabela",
}: {
  headers: string[];
  rows: (string | number)[][];
  summary?: string;
}) {
  return (
    <details className="mt-5 group">
      <summary className="cursor-pointer select-none text-[12px] text-white/30 transition-colors hover:text-white/60">
        {summary}
      </summary>
      <div className="mt-3 max-h-64 overflow-auto rounded-xl border border-white/[0.06]">
        <table className="w-full text-[12.5px]">
          <thead className="sticky top-0 bg-[var(--panel-surface)]">
            <tr>
              {headers.map((h) => (
                <th key={h} className="border-b border-white/[0.06] px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-white/35">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                {r.map((c, j) => (
                  <td key={j} className="border-b border-white/[0.04] px-3 py-2 tabular-nums text-white/55">
                    {c}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
