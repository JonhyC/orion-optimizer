"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ChevronDown,
  Cpu,
  FlaskConical,
  Gauge,
  HardDrive,
  Hash,
  MonitorCog,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";
import type { ActiveOptimization } from "@/lib/repo/types";
import { categoriaDe, dataHora, haQuanto } from "@/lib/optimizations-view";

/**
 * Cartao de uma otimizacao aplicada.
 *
 * Fechado mostra o que se precisa para decidir se interessa: nome,
 * categoria, impacto e quando foi. Aberto mostra o resto - sessao,
 * maquina, versao da app.
 *
 * O detalhe so e MONTADO quando abre. Com dezenas de cartoes na pagina,
 * manter o conteudo escondido montado multiplicaria os nos do DOM sem
 * ninguem os ver.
 */

const TOM: Record<string, string> = {
  "chart-1": "border-[var(--chart-1)]/25 bg-[var(--chart-1)]/10 text-[var(--chart-1)]",
  good: "border-[var(--good)]/25 bg-[var(--good)]/10 text-[var(--good)]",
  warning: "border-[var(--warning)]/25 bg-[var(--warning)]/10 text-[var(--warning)]",
  cyan: "border-[var(--chart-2,var(--chart-1))]/25 bg-[var(--chart-2,var(--chart-1))]/10 text-[var(--chart-2,var(--chart-1))]",
  neutro: "border-white/10 bg-white/[0.04] text-white/50",
};

export function Badge({
  children,
  tone = "neutro",
  title,
}: {
  children: React.ReactNode;
  tone?: keyof typeof TOM | string;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
        TOM[tone] ?? TOM.neutro
      }`}
    >
      {children}
    </span>
  );
}

export default function OptimizationCard({
  item,
  indice,
}: {
  item: ActiveOptimization;
  indice: number;
}) {
  const [aberto, setAberto] = useState(false);
  const reduzir = useReducedMotion();
  const categoria = categoriaDe(item);
  const simulacao = item.mode !== "Real";

  return (
    <motion.article
      initial={reduzir ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      // Escalonar a entrada, mas com tecto: com 40 cartoes, um atraso
      // proporcional deixava os ultimos a aparecer segundos depois.
      transition={{ duration: 0.28, delay: Math.min(indice * 0.03, 0.24) }}
      className="overflow-hidden rounded-xl border border-white/[0.07] bg-[var(--panel-surface)] transition-colors hover:border-[var(--chart-1)]/25"
    >
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        className="flex w-full items-start gap-4 p-5 text-left"
      >
        <span
          className={`mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-lg border ${
            TOM[categoria.tone] ?? TOM.neutro
          }`}
        >
          <Gauge size={18} />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="good" title="Aplicada e ativa neste computador">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--good)]" />
              Ativa
            </Badge>
            <Badge tone={categoria.tone}>{categoria.label}</Badge>
            {item.impact && (
              <Badge title="Impacto estimado, segundo o catálogo">
                Impacto: {item.impact}
              </Badge>
            )}
            {item.requires_reboot === 1 && (
              <Badge tone="warning" title="Só tem efeito completo depois de reiniciar">
                <RotateCcw size={11} />
                Reinício
              </Badge>
            )}
            {simulacao && (
              <Badge tone="warning" title="Aplicada em modo de simulação: não alterou o sistema">
                <FlaskConical size={11} />
                Simulação
              </Badge>
            )}
          </div>

          <h3 className="mt-3 truncate text-[16px] font-semibold text-white">{item.name}</h3>
          <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-white/40">
            {item.description ?? item.tweak_id}
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] text-white/30">
            <span title={dataHora(item.applied_at)}>{haQuanto(item.applied_at) ?? "Sem data"}</span>
            {item.machine_hwid && (
              <span className="inline-flex items-center gap-1.5">
                <HardDrive size={11} />
                {item.machine_hwid.slice(0, 12)}
              </span>
            )}
            {item.client_version && (
              <span className="inline-flex items-center gap-1.5">
                <MonitorCog size={11} />v{item.client_version}
              </span>
            )}
          </div>
        </div>

        <motion.span
          animate={{ rotate: aberto ? 180 : 0 }}
          transition={{ duration: reduzir ? 0 : 0.2 }}
          className="mt-1 shrink-0 text-white/30"
        >
          <ChevronDown size={18} />
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {aberto && (
          <motion.div
            initial={reduzir ? false : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: reduzir ? 0 : 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <Detalhes item={item} />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.article>
  );
}

function Detalhes({ item }: { item: ActiveOptimization }) {
  return (
    <div className="border-t border-white/[0.06] bg-black/20 p-5">
      <div className="grid gap-5 md:grid-cols-2">
        <div>
          <Titulo>Descrição</Titulo>
          <p className="mt-2 text-[13px] leading-relaxed text-white/50">
            {item.description ?? "A aplicação não enviou descrição para esta otimização."}
          </p>

          <Titulo className="mt-5">Identificação</Titulo>
          <dl className="mt-2 space-y-2">
            <Linha icone={<Hash size={12} />} rotulo="Tweak" valor={item.tweak_id} />
            <Linha
              icone={<Hash size={12} />}
              rotulo="Sessão"
              valor={item.session_id ?? "Sem identificador"}
            />
            <Linha
              icone={<Cpu size={12} />}
              rotulo="Modo"
              valor={item.mode === "Real" ? "Real — alterou o sistema" : "Simulação — não alterou nada"}
            />
            <Linha
              icone={<ShieldCheck size={12} />}
              rotulo="Aplicada"
              valor={dataHora(item.applied_at)}
            />
          </dl>
        </div>

        <div>
          <Titulo>Computador</Titulo>
          <dl className="mt-2 space-y-2">
            <Linha rotulo="Identificador" valor={item.machine_hwid ?? "Não enviado"} />
            <Linha rotulo="Tipo" valor={item.machine_chassis ?? "Não enviado"} />
            <Linha rotulo="Gráficos" valor={item.machine_gpu ?? "Não enviado"} />
            <Linha
              rotulo="Memória"
              valor={item.machine_ram_gb ? `${item.machine_ram_gb} GB` : "Não enviada"}
            />
            <Linha rotulo="Versão da app" valor={item.client_version ?? "Não enviada"} />
          </dl>

          <div className="mt-5 rounded-lg border border-[var(--chart-1)]/15 bg-[var(--chart-1)]/[0.05] p-3">
            <p className="inline-flex items-center gap-2 text-[12px] font-semibold text-[var(--chart-1)]">
              <RotateCcw size={13} />
              Reversível
            </p>
            <p className="mt-1 text-[12px] leading-relaxed text-white/45">
              O valor original ficou guardado antes da alteração. Reverter a sessão
              no histórico da aplicação remove esta otimização desta lista.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Titulo({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <h4
      className={`text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--chart-1)] ${className}`}
    >
      {children}
    </h4>
  );
}

function Linha({
  icone,
  rotulo,
  valor,
}: {
  icone?: React.ReactNode;
  rotulo: string;
  valor: string;
}) {
  return (
    <div className="flex min-w-0 items-start justify-between gap-4 border-b border-white/[0.05] pb-2 last:border-b-0 last:pb-0">
      <dt className="inline-flex shrink-0 items-center gap-1.5 text-[12px] text-white/30">
        {icone}
        {rotulo}
      </dt>
      <dd
        className="min-w-0 break-all text-right font-mono text-[11.5px] text-white/60"
        title={valor}
      >
        {valor}
      </dd>
    </div>
  );
}
