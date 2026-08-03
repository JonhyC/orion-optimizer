import Link from "next/link";
import { AlertTriangle, RefreshCw } from "lucide-react";

/**
 * Ecra mostrado quando a base de dados nao responde.
 *
 * Substitui o "Application error: a server-side exception has occurred"
 * do Next, que e um ecra branco com um numero e nao diz nada a ninguem.
 */
export default function PainelIndisponivel({ titulo, detalhe }: { titulo: string; detalhe: string }) {
  return (
    <div className="grid min-h-screen place-items-center bg-[var(--panel-bg)] px-6">
      <div className="w-full max-w-[440px] rounded-2xl border border-[var(--warning)]/25 bg-[var(--panel-surface)] p-7 text-center">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-warning/10 text-[var(--warning)]">
          <AlertTriangle size={22} />
        </span>
        <h1 className="mt-4 text-[17px] font-bold text-white">{titulo}</h1>
        <p className="mt-2 text-[13.5px] leading-relaxed text-white/45">{detalhe}</p>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
          {/* Um <a> e nao um <Link>: queremos um pedido novo ao servidor,
              nao uma navegacao do lado do cliente que reaproveitaria o
              mesmo estado partido. */}
          <a
            href="/panel"
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--chart-1)] px-4 py-2.5 text-[13px] font-semibold text-[#16082c]"
          >
            <RefreshCw size={14} />
            Tentar de novo
          </a>
          <Link
            href="/"
            className="rounded-lg border border-white/10 px-4 py-2.5 text-[13px] font-semibold text-white/55 transition-colors hover:border-white/25 hover:text-white"
          >
            Voltar ao site
          </Link>
        </div>
      </div>
    </div>
  );
}
