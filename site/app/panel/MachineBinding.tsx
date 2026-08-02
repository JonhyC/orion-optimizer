"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CheckCircle2, Laptop, RefreshCcw } from "lucide-react";
import { resetOwnHwidAction } from "./actions";

export default function MachineBinding({
  hasMachine,
  maskedHwid,
}: {
  hasMachine: boolean;
  maskedHwid?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  if (!hasMachine) {
    return (
      <div className="flex items-start gap-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-[var(--good)]/10 text-[var(--good)]">
          <CheckCircle2 size={17} />
        </div>
        <div>
          <div className="text-[13.5px] font-semibold text-white/70">Pronta para associar</div>
          <p className="mt-1 text-[12.5px] leading-relaxed text-white/35">
            Inicia sessao no Orion Optimizer 2.0 no computador novo. A licenca fica ligada automaticamente a esse PC.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-[13px] font-semibold text-white/65">
            <Laptop size={15} className="text-[var(--chart-1)]" />
            Computador atualmente associado
          </div>
          <code className="mt-3 block break-all rounded-lg bg-[var(--panel-surface-2)] p-3 font-mono text-[11.5px] text-white/45">
            {maskedHwid}
          </code>
        </div>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            const confirmed = window.confirm(
              "Trocar de computador? As sessoes abertas no cliente Windows serao terminadas. No proximo login, a licenca fica ligada ao novo PC.",
            );
            if (!confirmed) return;
            setResult(null);
            startTransition(async () => {
              const response = await resetOwnHwidAction();
              setResult(response);
              if (response.ok) router.refresh();
            });
          }}
          className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-[var(--warning)]/30 bg-[var(--warning)]/[0.06] px-4 py-2.5 text-[12.5px] font-semibold text-[var(--warning)] transition-colors hover:bg-[var(--warning)]/10 disabled:cursor-wait disabled:opacity-50"
        >
          <RefreshCcw size={14} className={pending ? "animate-spin" : ""} />
          {pending ? "A remover..." : "Trocar de computador"}
        </button>
      </div>

      <p className="mt-3 text-[12px] leading-relaxed text-white/30">
        Esta operacao nao altera o plano, Discord ou password. Por seguranca, so pode ser feita uma vez a cada 24 horas.
      </p>

      {result && !result.ok && (
        <div className="mt-3 rounded-md border border-[var(--critical)]/20 bg-[var(--critical)]/[0.06] px-3 py-2 text-[12px] text-[var(--critical)]">
          {result.message}
        </div>
      )}
    </div>
  );
}
