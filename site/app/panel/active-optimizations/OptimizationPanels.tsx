"use client";

import { motion, useReducedMotion } from "framer-motion";
import {
  Activity,
  CheckCircle2,
  Clock,
  HardDrive,
  Layers,
  MonitorCog,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";
import type { ActiveOptimization } from "@/lib/repo/types";
import {
  agruparPorDia,
  categoriaDe,
  contagemPorCategoria,
  dataHora,
  haQuanto,
  type Resumo,
} from "@/lib/optimizations-view";

/**
 * Paineis laterais e de topo da pagina de Otimizacoes Ativas.
 *
 * Juntos num ficheiro por serem pequenos e sempre usados em conjunto -
 * cinco ficheiros de trinta linhas espalhariam a mesma coisa sem ganho.
 * Continuam a ser componentes distintos e com o nome que lhes pertence.
 */

const TOM: Record<string, string> = {
  "chart-1": "border-[var(--chart-1)]/25 bg-[var(--chart-1)]/10 text-[var(--chart-1)]",
  good: "border-[var(--good)]/25 bg-[var(--good)]/10 text-[var(--good)]",
  warning: "border-[var(--warning)]/25 bg-[var(--warning)]/10 text-[var(--warning)]",
  cyan: "border-[var(--chart-1)]/20 bg-[var(--chart-1)]/[0.07] text-[var(--chart-1)]",
  neutro: "border-white/10 bg-white/[0.04] text-white/50",
};

// ------------------------------------------------------------------ KPIs

export function OptimizationsStats({
  resumo,
  versaoApp,
  ultimaSessao,
}: {
  resumo: Resumo;
  versaoApp: string | null;
  ultimaSessao: number | null;
}) {
  const cartoes = [
    {
      icone: <ShieldCheck size={17} />,
      rotulo: "Otimizações ativas",
      valor: String(resumo.total),
      nota: resumo.categorias
        ? `em ${resumo.categorias} ${resumo.categorias === 1 ? "categoria" : "categorias"}`
        : "nenhuma aplicada",
      tone: "good",
    },
    {
      icone: <HardDrive size={17} />,
      rotulo: "Computadores",
      valor: String(resumo.maquinas),
      nota: resumo.maquinas === 1 ? "um PC associado" : "PCs com otimizações",
      tone: "chart-1",
    },
    {
      icone: <MonitorCog size={17} />,
      rotulo: "Versão da aplicação",
      valor: versaoApp ? `v${versaoApp}` : "—",
      nota: versaoApp ? "reportada pelo cliente" : "ainda não reportada",
      tone: "neutro",
    },
    {
      icone: <Clock size={17} />,
      rotulo: "Última atividade",
      valor: haQuanto(resumo.ultimaAplicacao ?? ultimaSessao) ?? "—",
      nota: dataHora(resumo.ultimaAplicacao ?? ultimaSessao),
      tone: "neutro",
    },
    {
      icone: <RotateCcw size={17} />,
      rotulo: "Aguardam reinício",
      valor: String(resumo.pendentesReinicio),
      nota: resumo.pendentesReinicio ? "efeito ainda parcial" : "nenhuma pendente",
      tone: resumo.pendentesReinicio ? "warning" : "neutro",
    },
    {
      icone: <CheckCircle2 size={17} />,
      rotulo: "Reversão",
      valor: resumo.total ? "Disponível" : "—",
      nota: resumo.total ? "pelo histórico da app" : "nada para reverter",
      tone: resumo.total ? "good" : "neutro",
    },
  ];

  return (
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {cartoes.map((c) => (
        <div
          key={c.rotulo}
          className="min-w-0 rounded-xl border border-white/[0.07] bg-[var(--panel-surface)] p-4 transition-colors hover:border-[var(--chart-1)]/20"
        >
          <span
            className={`grid h-9 w-9 place-items-center rounded-lg border ${TOM[c.tone] ?? TOM.neutro}`}
          >
            {c.icone}
          </span>
          <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.15em] text-white/30">
            {c.rotulo}
          </p>
          <p className="mt-1 truncate text-[18px] font-bold text-white" title={c.valor}>
            {c.valor}
          </p>
          <p className="mt-0.5 truncate text-[11.5px] text-white/30" title={c.nota}>
            {c.nota}
          </p>
        </div>
      ))}
    </section>
  );
}

// --------------------------------------------------------------- Resumo

export function OptimizationSummary({ resumo }: { resumo: Resumo }) {
  if (!resumo.linhas.length) return null;

  return (
    <section className="rounded-xl border border-[var(--chart-1)]/15 bg-[var(--chart-1)]/[0.04] p-5">
      <h2 className="inline-flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.16em] text-[var(--chart-1)]">
        <Activity size={14} />
        Estado
      </h2>
      <ul className="mt-3 space-y-1.5">
        {resumo.linhas.map((linha) => (
          <li key={linha} className="flex gap-2 text-[13px] leading-relaxed text-white/55">
            <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-[var(--chart-1)]/70" />
            {linha}
          </li>
        ))}
      </ul>
    </section>
  );
}

// --------------------------------------------------- Estatisticas por categoria

export function OptimizationsCategoryStats({ itens }: { itens: ActiveOptimization[] }) {
  const reduzir = useReducedMotion();
  const contagens = contagemPorCategoria(itens);
  if (!contagens.length) return null;

  const maximo = Math.max(...contagens.map((c) => c.total));

  return (
    <section className="rounded-xl border border-white/[0.07] bg-[var(--panel-surface)] p-5">
      <h2 className="inline-flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.16em] text-[var(--chart-1)]">
        <Layers size={14} />
        Por categoria
      </h2>
      <ul className="mt-4 space-y-3">
        {contagens.map(({ categoria, total }, i) => (
          <li key={categoria.id}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="truncate text-[12.5px] text-white/60">{categoria.label}</span>
              <span className="shrink-0 text-[12.5px] font-semibold tabular-nums text-white">
                {total}
              </span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[0.05]">
              <motion.div
                initial={reduzir ? false : { width: 0 }}
                animate={{ width: `${(total / maximo) * 100}%` }}
                transition={{ duration: reduzir ? 0 : 0.5, delay: i * 0.05, ease: [0.22, 1, 0.36, 1] }}
                className="h-full rounded-full bg-[var(--chart-1)]/70"
              />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ------------------------------------------------------------- Computador

export function OptimizationComputer({
  itens,
  hwidConta,
  versaoApp,
  ultimaSessao,
}: {
  itens: ActiveOptimization[];
  hwidConta: string | null;
  versaoApp: string | null;
  ultimaSessao: number | null;
}) {
  // O ultimo registo e o que tem a informacao mais fresca da maquina.
  const recente = itens[0] ?? null;
  const hwid = recente?.machine_hwid ?? hwidConta;

  const campos = [
    { rotulo: "Identificador", valor: hwid ?? "Não associado" },
    { rotulo: "Tipo", valor: recente?.machine_chassis ?? "Não enviado" },
    { rotulo: "Gráficos", valor: recente?.machine_gpu ?? "Não enviado" },
    { rotulo: "Memória", valor: recente?.machine_ram_gb ? `${recente.machine_ram_gb} GB` : "Não enviada" },
    { rotulo: "Versão Orion", valor: versaoApp ? `v${versaoApp}` : "Não reportada" },
    { rotulo: "Última sincronização", valor: dataHora(recente?.applied_at ?? ultimaSessao) },
  ];

  return (
    <section className="rounded-xl border border-white/[0.07] bg-[var(--panel-surface)] p-5">
      <div className="flex items-center gap-3">
        <span className={`grid h-9 w-9 place-items-center rounded-lg border ${TOM["chart-1"]}`}>
          <HardDrive size={17} />
        </span>
        <div className="min-w-0">
          <h2 className="text-[14px] font-semibold text-white">Computador</h2>
          <p className="text-[11.5px] text-white/30">
            {hwid ? "Associado a esta licença" : "Ainda sem PC associado"}
          </p>
        </div>
      </div>

      <dl className="mt-4 space-y-2">
        {campos.map((c) => (
          <div
            key={c.rotulo}
            className="flex min-w-0 items-start justify-between gap-3 border-b border-white/[0.05] pb-2 last:border-b-0 last:pb-0"
          >
            <dt className="shrink-0 text-[12px] text-white/30">{c.rotulo}</dt>
            <dd
              className="min-w-0 break-all text-right text-[12px] font-medium text-white/65"
              title={c.valor}
            >
              {c.valor}
            </dd>
          </div>
        ))}
      </dl>

      {/* O CPU e a versao do Windows nao sao enviados pela aplicacao. Dizer
          isso e melhor do que deixar campos vazios sem explicacao. */}
      <p className="mt-4 text-[11px] leading-relaxed text-white/25">
        O processador e a versão do Windows ainda não são enviados pela aplicação.
      </p>
    </section>
  );
}

// --------------------------------------------------------------- Timeline

export function OptimizationTimeline({ itens }: { itens: ActiveOptimization[] }) {
  const reduzir = useReducedMotion();
  const grupos = agruparPorDia(itens);
  if (!grupos.length) return null;

  return (
    <section className="rounded-xl border border-white/[0.07] bg-[var(--panel-surface)] p-5">
      <h2 className="inline-flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.16em] text-[var(--chart-1)]">
        <Clock size={14} />
        Cronologia
      </h2>

      <div className="mt-4 space-y-5">
        {grupos.map((grupo, gi) => (
          <div key={grupo.titulo}>
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/35">
              {grupo.titulo}
            </p>
            <ul className="mt-2.5 space-y-0">
              {grupo.itens.map((item, i) => (
                <motion.li
                  key={item.id}
                  initial={reduzir ? false : { opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: Math.min((gi * 3 + i) * 0.04, 0.4) }}
                  className="relative flex gap-3 pb-4 last:pb-0"
                >
                  {/* Linha vertical entre pontos, menos no ultimo. */}
                  <span className="relative flex flex-col items-center">
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[var(--chart-1)]" />
                    <span className="mt-1 w-px flex-1 bg-white/[0.08] last:hidden" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] text-white/70">{item.name}</p>
                    <p className="text-[11px] text-white/25">
                      {categoriaDe(item).label} · {dataHora(item.applied_at)}
                    </p>
                  </div>
                </motion.li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
