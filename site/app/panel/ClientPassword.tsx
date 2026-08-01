"use client";

import { useState, useTransition } from "react";
import { KeyRound } from "lucide-react";
import { generateClientPasswordAction } from "./actions";

/**
 * Credenciais para o cliente PowerShell.
 *
 * Quem entrou por Discord nao tem password - um terminal nao faz OAuth. A
 * password aparece uma unica vez, aqui: em disco fica so o hash, e nem eu
 * consigo voltar a mostra-la.
 */
export default function ClientPassword({ hasPassword }: { hasPassword: boolean }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ username: string; password: string } | null>(null);

  return (
    <div>
      {result ? (
        <>
          <div className="rounded-xl border border-[var(--good)]/30 bg-[var(--good)]/[0.07] p-4">
            <p className="text-[12px] font-semibold uppercase tracking-wide text-[var(--good)]">
              Copia agora — não volta a aparecer
            </p>
            <dl className="mt-3 space-y-2 font-mono text-[13px]">
              <div className="flex gap-3">
                <dt className="w-20 shrink-0 text-white/35">utilizador</dt>
                <dd className="break-all text-white">{result.username}</dd>
              </div>
              <div className="flex gap-3">
                <dt className="w-20 shrink-0 text-white/35">password</dt>
                <dd className="break-all text-white">{result.password}</dd>
              </div>
            </dl>
          </div>

          <p className="mt-3 text-[12px] leading-relaxed text-white/30">
            Guardamos apenas o hash. Se a perderes, gera outra — a anterior deixa
            de funcionar.
          </p>
        </>
      ) : (
        <>
          <p className="text-[13px] leading-relaxed text-white/45">
            {hasPassword
              ? "Já tens credenciais para o cliente Windows. Gera novas se as perdeste — as antigas deixam de funcionar."
              : "Entraste por Discord, por isso ainda não tens password. O cliente Windows precisa de uma: um terminal não consegue fazer login por Discord."}
          </p>

          <button
            type="button"
            disabled={pending}
            onClick={() =>
              start(async () => {
                setResult(await generateClientPasswordAction());
              })
            }
            className="mt-5 inline-flex items-center gap-2 rounded-lg border border-white/10 bg-[var(--panel-surface-2)] px-4 py-2.5 text-[13px] font-semibold text-white/75 transition-colors hover:border-[var(--chart-1)] hover:text-white disabled:opacity-50"
          >
            <KeyRound size={14} />
            {pending ? "A gerar…" : hasPassword ? "Gerar nova password" : "Gerar password"}
          </button>
        </>
      )}
    </div>
  );
}
