"use client";

import { useMemo, useState } from "react";
import { TrendingDown, TrendingUp } from "lucide-react";
import AreaChart from "@/components/panel/AreaChart";
import { TableView } from "@/components/panel/Pieces";
import { PERIODOS, recortar, tendencia, totalDaSerie, variacao, type PeriodoId } from "@/lib/admin-dashboard";
// O `money` vem de lib/format e nao de lib/stats de proposito: stats importa
// os repositorios, que importam o firebase-admin, que precisa de `net` e
// `http` do Node. Num componente de cliente isso arrasta o SDK inteiro para
// o bundle do browser e o build rebenta.
import { money } from "@/lib/format";
import type { Point } from "@/lib/stats";

/**
 * Grafico de receita com selector de periodo.
 *
 * Antes havia quatro etiquetas - Hoje, 7 dias, 30 dias, 12 meses - que
 * eram <span> e nao faziam nada: o grafico mostrava sempre 30 dias
 * independentemente da que estivesse destacada.
 *
 * Agora sao botoes a serio. A serie completa vem do servidor uma unica
 * vez e os periodos mais curtos sao fatias dela, calculadas aqui - trocar
 * de periodo nao vai ao servidor e por isso e instantaneo.
 */
export default function RevenueChart({
  serie,
  dinheiro,
}: {
  /** Serie completa, do periodo mais longo. */
  serie: Point[];
  /** Owner ve receita; o resto ve numero de compras. */
  dinheiro: boolean;
}) {
  const [periodo, setPeriodo] = useState<PeriodoId>("30");

  const dias = PERIODOS.find((p) => p.id === periodo)?.dias ?? 30;
  const pontos = useMemo(() => recortar(serie, dias), [serie, dias]);
  const total = useMemo(() => totalDaSerie(pontos), [pontos]);
  const evolucao = useMemo(() => tendencia(pontos), [pontos]);

  const subiu = evolucao !== null && evolucao > 0;
  const desceu = evolucao !== null && evolucao < 0;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {PERIODOS.map((p) => {
            const activo = p.id === periodo;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setPeriodo(p.id)}
                aria-pressed={activo}
                className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition-colors ${
                  activo
                    ? "border-[var(--chart-1)]/35 bg-[var(--chart-1)]/10 text-[var(--chart-1)]"
                    : "border-white/[0.08] text-white/38 hover:border-white/20 hover:text-white/70"
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>

        <div className="flex items-baseline gap-3">
          <span className="text-[19px] font-bold tabular-nums text-white">
            {dinheiro ? money(total) : total}
          </span>
          {evolucao !== null && (
            <span
              title="Comparação entre a primeira e a segunda metade do período"
              className={`inline-flex items-center gap-1 text-[12px] font-semibold ${
                subiu ? "text-[var(--good)]" : desceu ? "text-[var(--critical)]" : "text-white/35"
              }`}
            >
              {subiu ? <TrendingUp size={13} /> : desceu ? <TrendingDown size={13} /> : null}
              {variacao(evolucao)}
            </span>
          )}
        </div>
      </div>

      <AreaChart
        points={pontos}
        format={dinheiro ? "money" : "number"}
        emptyLabel={
          dinheiro ? "Ainda não há receita registada." : "Ainda não há compras registadas."
        }
      />

      <TableView
        headers={["Dia", dinheiro ? "Receita" : "Compras"]}
        rows={pontos
          .filter((p) => p.value > 0)
          .map((p) => [p.label, dinheiro ? money(p.value) : String(p.value)])}
      />
    </div>
  );
}
