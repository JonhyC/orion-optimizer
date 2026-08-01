"use client";

import { useMemo, useRef, useState } from "react";
import type { Point } from "@/lib/stats";

/**
 * Serie unica ao longo do tempo.
 *
 * Uma serie so, logo sem legenda - o titulo do cartao nomeia-a. Um unico eixo
 * y (nunca dois: comparar duas escalas no mesmo grafico e a forma mais rapida
 * de mentir com dados). Grelha recessiva, rotulo direto so no ultimo ponto em
 * vez de um numero em cada um, e vista de tabela sempre disponivel por baixo.
 */

const W = 760;
const H = 220;
const PAD = { l: 58, r: 18, t: 16, b: 28 };

export default function AreaChart({
  points,
  format = "number",
  emptyLabel = "Ainda sem dados.",
}: {
  points: Point[];
  format?: "number" | "money";
  emptyLabel?: string;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<number | null>(null);

  const fmt = useMemo(
    () => (v: number) =>
      format === "money"
        ? new Intl.NumberFormat("pt-PT", {
            style: "currency",
            currency: "EUR",
            maximumFractionDigits: 0,
          }).format(v / 100)
        : String(Math.round(v)),
    [format],
  );

  const geom = useMemo(() => {
    if (points.length < 2) return null;

    const values = points.map((p) => p.value);
    const rawMax = Math.max(...values, 1);
    // Arredonda o topo para um numero legivel, senao os rotulos do eixo
    // ficam com casas decimais aleatorias.
    const mag = 10 ** Math.floor(Math.log10(rawMax));
    const max = Math.ceil(rawMax / mag) * mag;

    const plotW = W - PAD.l - PAD.r;
    const plotH = H - PAD.t - PAD.b;

    const x = (i: number) => PAD.l + (plotW * i) / (points.length - 1);
    const y = (v: number) => PAD.t + plotH - (v / max) * plotH;

    const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)} ${y(p.value).toFixed(1)}`).join(" ");
    const base = y(0);
    const area = `${line} L${x(points.length - 1).toFixed(1)} ${base.toFixed(1)} L${x(0).toFixed(1)} ${base.toFixed(1)} Z`;

    return { x, y, max, base, line, area, plotW };
  }, [points]);

  if (!geom) {
    return <p className="py-14 text-center text-[13px] text-white/30">{emptyLabel}</p>;
  }

  const { x, y, max, base, line, area } = geom;
  const last = points.length - 1;

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = svgRef.current!.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const ratio = (px - PAD.l) / (W - PAD.l - PAD.r);
    const i = Math.round(ratio * (points.length - 1));
    setHover(i >= 0 && i <= last ? i : null);
  };

  const active = hover ?? null;

  return (
    <figure className="relative m-0">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full overflow-visible"
        role="img"
        aria-label="Evolucao ao longo do tempo"
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id="pa-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--chart-1)" stopOpacity="0.26" />
            <stop offset="100%" stopColor="var(--chart-1)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {[0, 1, 2, 3, 4].map((t) => {
          const v = (max * t) / 4;
          const yy = y(v);
          return (
            <g key={t}>
              <line x1={PAD.l} x2={W - PAD.r} y1={yy} y2={yy} stroke="var(--chart-grid)" strokeWidth="1" />
              <text x={PAD.l - 10} y={yy + 4} textAnchor="end" className="fill-[var(--chart-axis)] text-[11px] tabular-nums">
                {fmt(v)}
              </text>
            </g>
          );
        })}

        <path d={area} fill="url(#pa-fill)" />
        <path d={line} fill="none" stroke="var(--chart-1)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        <line x1={PAD.l} x2={W - PAD.r} y1={base} y2={base} stroke="var(--chart-baseline)" strokeWidth="1" />

        {/* rotulo direto: so o ultimo ponto */}
        <circle cx={x(last)} cy={y(points[last].value)} r="4.5" fill="var(--chart-1)" stroke="var(--panel-surface)" strokeWidth="2" />

        {[0, Math.floor(last / 2), last].map((i, n) => (
          <text
            key={i}
            x={x(i)}
            y={H - 8}
            textAnchor={n === 0 ? "start" : n === 2 ? "end" : "middle"}
            className="fill-[var(--chart-axis)] text-[11px]"
          >
            {points[i].label}
          </text>
        ))}

        {active !== null && (
          <g>
            <line
              x1={x(active)} x2={x(active)} y1={PAD.t} y2={base}
              stroke="var(--chart-1)" strokeOpacity="0.5" strokeWidth="1" strokeDasharray="3 3"
            />
            <circle cx={x(active)} cy={y(points[active].value)} r="5" fill="var(--chart-1)" stroke="var(--panel-surface)" strokeWidth="2" />
          </g>
        )}
      </svg>

      {active !== null && (
        <div
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-full rounded-lg border border-white/10 bg-ink-800 px-3 py-2 text-[12px] shadow-xl"
          style={{
            left: `${(x(active) / W) * 100}%`,
            top: `${(y(points[active].value) / H) * 100}%`,
          }}
        >
          <div className="font-semibold tabular-nums text-white">{fmt(points[active].value)}</div>
          <div className="text-white/40">{points[active].label}</div>
        </div>
      )}
    </figure>
  );
}
