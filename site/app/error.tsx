"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

/**
 * Rede de seguranca do site inteiro.
 *
 * Nao existia nenhuma: qualquer excepcao no servidor dava o ecra branco
 * do Next com "Application error: a server-side exception has occurred"
 * e um numero. Nem dizia que tentar, nem oferecia caminho de volta.
 *
 * A mensagem real do erro NAO chega aqui em producao - o Next apaga-a de
 * proposito para nao expor detalhes internos, deixando so o digest. Por
 * isso o texto e generico e o digest e mostrado: e o que permite
 * encontrar a ocorrencia nos registos do servidor.
 */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[orion] erro nao tratado:", error);
  }, [error]);

  return (
    <div className="grid min-h-screen place-items-center bg-[var(--panel-bg)] px-6">
      <div className="w-full max-w-[440px] rounded-2xl border border-white/[0.08] bg-[var(--panel-surface)] p-7 text-center">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-critical/10 text-[var(--critical)]">
          <AlertTriangle size={22} />
        </span>
        <h1 className="mt-4 text-[17px] font-bold text-white">Alguma coisa correu mal</h1>
        <p className="mt-2 text-[13.5px] leading-relaxed text-white/45">
          Não foi possível carregar esta página. Tenta novamente; se continuar, fala com a equipa.
        </p>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--chart-1)] px-4 py-2.5 text-[13px] font-semibold text-[#16082c]"
          >
            <RefreshCw size={14} />
            Tentar de novo
          </button>
          <a
            href="/"
            className="rounded-lg border border-white/10 px-4 py-2.5 text-[13px] font-semibold text-white/55 transition-colors hover:border-white/25 hover:text-white"
          >
            Início
          </a>
        </div>

        {error.digest && (
          <p className="mt-5 font-mono text-[10.5px] text-white/22">Referência: {error.digest}</p>
        )}
      </div>
    </div>
  );
}
