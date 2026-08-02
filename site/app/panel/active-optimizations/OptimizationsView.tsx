"use client";

import { useDeferredValue, useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Activity, RotateCcw, Search, ShieldCheck, SlidersHorizontal, X } from "lucide-react";
import type { ActiveOptimization } from "@/lib/repo/types";
import {
  ORDENACOES,
  contagemPorCategoria,
  dataHora,
  filtrar,
  haQuanto,
  ordenar,
  pesquisar,
  resumir,
  type FiltroId,
  type OrdenacaoId,
} from "@/lib/optimizations-view";
import OptimizationCard from "./OptimizationCard";
import {
  OptimizationComputer,
  OptimizationSummary,
  OptimizationTimeline,
  OptimizationsCategoryStats,
  OptimizationsStats,
} from "./OptimizationPanels";

/**
 * Central de otimizacoes ativas.
 *
 * Os dados chegam ja carregados do servidor: pesquisa, filtros e ordenacao
 * acontecem sobre a lista em memoria, sem ir buscar nada. Sao dezenas de
 * registos no maximo - paginar ou ir ao servidor a cada tecla seria mais
 * lento, nao mais rapido.
 *
 * O useDeferredValue mantem a escrita fluida: o campo responde a cada
 * tecla, a lista recalcula quando o browser tem folga.
 */
export default function OptimizationsView({
  itens,
  versaoApp,
  ultimaSessao,
  hwidConta,
}: {
  itens: ActiveOptimization[];
  versaoApp: string | null;
  ultimaSessao: number | null;
  hwidConta: string | null;
}) {
  const [termo, setTermo] = useState("");
  const [filtro, setFiltro] = useState<FiltroId>("todas");
  const [ordem, setOrdem] = useState<OrdenacaoId>("recentes");
  const reduzir = useReducedMotion();

  const termoAdiado = useDeferredValue(termo);

  const resumo = useMemo(() => resumir(itens), [itens]);
  const categorias = useMemo(() => contagemPorCategoria(itens), [itens]);

  const visiveis = useMemo(
    () => ordenar(filtrar(pesquisar(itens, termoAdiado), filtro), ordem),
    [itens, termoAdiado, filtro, ordem],
  );

  const filtros: Array<{ id: FiltroId; label: string; total: number }> = [
    { id: "todas", label: "Todas", total: itens.length },
    ...categorias.map((c) => ({ id: c.categoria.id as FiltroId, label: c.categoria.label, total: c.total })),
  ];
  if (resumo.pendentesReinicio > 0) {
    filtros.push({ id: "reinicio", label: "Aguardam reinício", total: resumo.pendentesReinicio });
  }

  const aFiltrar = termo.trim().length > 0 || filtro !== "todas";

  return (
    <div className="pb-4">
      <OptimizationsHeader
        total={itens.length}
        versaoApp={versaoApp}
        ultimaSessao={ultimaSessao}
        ultimaAplicacao={resumo.ultimaAplicacao}
      />

      <div className="mt-8">
        <OptimizationsStats resumo={resumo} versaoApp={versaoApp} ultimaSessao={ultimaSessao} />
      </div>

      {itens.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <div className="mt-6">
            <OptimizationSummary resumo={resumo} />
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="min-w-0">
              <OptimizationsSearch
                termo={termo}
                onTermo={setTermo}
                ordem={ordem}
                onOrdem={setOrdem}
                encontrados={visiveis.length}
                total={itens.length}
                aFiltrar={aFiltrar}
              />

              <OptimizationsFilters filtros={filtros} activo={filtro} onFiltro={setFiltro} />

              <div className="mt-4 grid gap-3">
                <AnimatePresence mode="popLayout" initial={false}>
                  {visiveis.map((item, i) => (
                    <OptimizationCard key={item.id} item={item} indice={i} />
                  ))}
                </AnimatePresence>

                {visiveis.length === 0 && (
                  <motion.div
                    initial={reduzir ? false : { opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="rounded-xl border border-dashed border-white/10 px-5 py-12 text-center"
                  >
                    <Search size={18} className="mx-auto text-white/25" />
                    <p className="mt-3 text-[13.5px] text-white/45">
                      Nenhuma otimização corresponde a estes critérios.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setTermo("");
                        setFiltro("todas");
                      }}
                      className="mt-3 text-[12.5px] text-[var(--chart-1)] hover:underline"
                    >
                      Limpar pesquisa e filtros
                    </button>
                  </motion.div>
                )}
              </div>
            </div>

            <aside className="grid content-start gap-4">
              <OptimizationComputer
                itens={itens}
                hwidConta={hwidConta}
                versaoApp={versaoApp}
                ultimaSessao={ultimaSessao}
              />
              <OptimizationsCategoryStats itens={itens} />
              <OptimizationTimeline itens={itens} />
            </aside>
          </div>
        </>
      )}
    </div>
  );
}

// -------------------------------------------------------------- Cabecalho

function OptimizationsHeader({
  total,
  versaoApp,
  ultimaSessao,
  ultimaAplicacao,
}: {
  total: number;
  versaoApp: string | null;
  ultimaSessao: number | null;
  ultimaAplicacao: number | null;
}) {
  return (
    <header className="flex flex-col gap-5 border-b border-white/[0.06] pb-6 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--chart-1)]">
          Área pessoal
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">Otimizações Ativas</h1>
        <p className="mt-2 max-w-2xl text-[13.5px] leading-relaxed text-white/45">
          {total > 0
            ? "Estado atual do teu computador: o que está aplicado, quando, em que máquina e com que impacto."
            : "Ainda não há otimizações aplicadas neste computador."}
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
        <MetaCabecalho rotulo="Última sincronização" valor={haQuanto(ultimaAplicacao ?? ultimaSessao) ?? "—"} titulo={dataHora(ultimaAplicacao ?? ultimaSessao)} />
        <MetaCabecalho rotulo="Última sessão" valor={haQuanto(ultimaSessao) ?? "—"} titulo={dataHora(ultimaSessao)} />
        <MetaCabecalho rotulo="Aplicação" valor={versaoApp ? `v${versaoApp}` : "—"} />
        <Link
          href="/panel/dashboard"
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-4 text-[13px] font-semibold text-white/70 transition-colors hover:border-[var(--chart-1)]/35 hover:text-white"
        >
          <Activity size={15} />
          Dashboard
        </Link>
      </div>
    </header>
  );
}

function MetaCabecalho({
  rotulo,
  valor,
  titulo,
}: {
  rotulo: string;
  valor: string;
  titulo?: string;
}) {
  return (
    <div className="min-w-0" title={titulo}>
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/25">{rotulo}</p>
      <p className="mt-0.5 truncate text-[13px] font-semibold text-white/75">{valor}</p>
    </div>
  );
}

// ---------------------------------------------------------------- Pesquisa

function OptimizationsSearch({
  termo,
  onTermo,
  ordem,
  onOrdem,
  encontrados,
  total,
  aFiltrar,
}: {
  termo: string;
  onTermo: (v: string) => void;
  ordem: OrdenacaoId;
  onOrdem: (v: OrdenacaoId) => void;
  encontrados: number;
  total: number;
  aFiltrar: boolean;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <label className="relative min-w-0 flex-1">
        <span className="sr-only">Pesquisar otimizações</span>
        <Search
          size={15}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/30"
        />
        <input
          value={termo}
          onChange={(e) => onTermo(e.target.value)}
          placeholder="Pesquisar por nome, categoria, sessão ou computador"
          className="h-10 w-full rounded-lg border border-white/[0.08] bg-[var(--panel-surface-2,rgba(255,255,255,0.02))] pl-9 pr-9 text-[13px] text-white outline-none transition-colors placeholder:text-white/25 focus:border-[var(--chart-1)]"
        />
        {termo && (
          <button
            type="button"
            onClick={() => onTermo("")}
            aria-label="Limpar pesquisa"
            className="absolute right-2.5 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded text-white/30 transition-colors hover:text-white"
          >
            <X size={14} />
          </button>
        )}
      </label>

      <label className="relative shrink-0">
        <span className="sr-only">Ordenar</span>
        <SlidersHorizontal
          size={14}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/30"
        />
        <select
          value={ordem}
          onChange={(e) => onOrdem(e.target.value as OrdenacaoId)}
          className="h-10 w-full appearance-none rounded-lg border border-white/[0.08] bg-[var(--panel-surface-2,rgba(255,255,255,0.02))] pl-9 pr-8 text-[13px] text-white outline-none transition-colors focus:border-[var(--chart-1)] sm:w-[190px]"
        >
          {ORDENACOES.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
      </label>

      {aFiltrar && (
        <span className="shrink-0 text-[12px] tabular-nums text-white/35">
          {encontrados} de {total}
        </span>
      )}
    </div>
  );
}

// ----------------------------------------------------------------- Filtros

function OptimizationsFilters({
  filtros,
  activo,
  onFiltro,
}: {
  filtros: Array<{ id: FiltroId; label: string; total: number }>;
  activo: FiltroId;
  onFiltro: (v: FiltroId) => void;
}) {
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {filtros.map((f) => {
        const seleccionado = f.id === activo;
        return (
          <button
            key={f.id}
            type="button"
            onClick={() => onFiltro(f.id)}
            aria-pressed={seleccionado}
            className={`relative inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors ${
              seleccionado
                ? "border-[var(--chart-1)]/40 bg-[var(--chart-1)]/12 text-[var(--chart-1)]"
                : "border-white/[0.08] bg-white/[0.02] text-white/50 hover:border-white/20 hover:text-white/75"
            }`}
          >
            {f.label}
            <span
              className={`tabular-nums ${seleccionado ? "text-[var(--chart-1)]/70" : "text-white/25"}`}
            >
              {f.total}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ------------------------------------------------------------ Estado vazio

function EmptyState() {
  return (
    <section className="mt-8 rounded-xl border border-white/[0.07] bg-[var(--panel-surface)] px-6 py-16 text-center">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-[var(--chart-1)]/20 bg-[var(--chart-1)]/[0.07] text-[var(--chart-1)]">
        <ShieldCheck size={24} />
      </div>
      <h2 className="mt-5 text-lg font-semibold text-white">
        Ainda não existem otimizações aplicadas
      </h2>
      <p className="mx-auto mt-2 max-w-md text-[13px] leading-relaxed text-white/40">
        Abre a aplicação Orion Optimizer, aplica uma otimização e volta aqui.
        A aplicação sincroniza sozinha o que foi aplicado, quando e em que computador.
      </p>
      <p className="mx-auto mt-4 inline-flex items-center gap-2 text-[12px] text-white/30">
        <RotateCcw size={13} />
        Tudo o que aplicares fica reversível.
      </p>
    </section>
  );
}
