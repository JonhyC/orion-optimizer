"use client";

import { useActionState, useState } from "react";
import { KeyRound, Trash2 } from "lucide-react";
import { deleteUserAction, resetUserPasswordAction } from "../../../actions";

/**
 * Operacoes destrutivas, separadas do resto.
 *
 * Apagar exige escrever o nome da conta. Um dialogo de confirmacao normal
 * clica-se por reflexo; escrever o nome obriga a olhar para o que se esta a
 * apagar.
 */
export default function DangerZone({
  userId,
  username,
  isSelf,
}: {
  userId: number;
  username: string;
  isSelf: boolean;
}) {
  const [confirmText, setConfirmText] = useState("");
  const [pwState, resetPassword] = useActionState(
    resetUserPasswordAction,
    null as { password?: string } | null,
  );

  return (
    <section className="mt-8 rounded-2xl border border-[var(--critical)]/25 bg-[var(--critical)]/[0.03] p-6">
      <h2 className="text-[15px] font-semibold text-[var(--critical)]">Zona perigosa</h2>

      <div className="mt-5 flex flex-wrap items-start justify-between gap-6 border-b border-white/[0.06] pb-6">
        <div className="max-w-md">
          <h3 className="text-[13.5px] font-semibold text-white/80">Repor password</h3>
          <p className="mt-1 text-[12.5px] leading-relaxed text-white/35">
            Gera uma nova para o cliente Windows e termina todas as sessões desta
            conta.
          </p>
          {pwState?.password && (
            <p className="mt-3 rounded-lg border border-[var(--good)]/30 bg-[var(--good)]/[0.07] px-3 py-2 font-mono text-[13px] text-white">
              {pwState.password}
            </p>
          )}
        </div>
        <form action={resetPassword}>
          <input type="hidden" name="userId" value={userId} />
          <button className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-4 py-2 text-[13px] font-semibold text-white/70 transition-colors hover:border-white/35 hover:text-white">
            <KeyRound size={14} />
            Repor
          </button>
        </form>
      </div>

      <div className="mt-6">
        <h3 className="text-[13.5px] font-semibold text-white/80">Apagar conta</h3>
        <p className="mt-1 max-w-md text-[12.5px] leading-relaxed text-white/35">
          {isSelf
            ? "Não podes apagar a tua própria conta."
            : "Apaga a conta, as sessões e as encomendas associadas. Não há como desfazer."}
        </p>

        {!isSelf && (
          <form action={deleteUserAction} className="mt-4 flex flex-wrap items-end gap-3">
            <input type="hidden" name="userId" value={userId} />
            <div>
              <label className="block text-[12px] text-white/40">
                Escreve <code className="text-white/70">{username}</code> para confirmar
              </label>
              <input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                className="mt-1.5 rounded-lg border border-white/[0.08] bg-[var(--panel-surface-2)] px-3 py-2 text-[14px] text-white outline-none focus:border-[var(--critical)]"
              />
            </div>
            <button
              disabled={confirmText !== username}
              className="inline-flex items-center gap-2 rounded-lg bg-[var(--critical)] px-4 py-2 text-[13px] font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-30"
            >
              <Trash2 size={14} />
              Apagar
            </button>
          </form>
        )}
      </div>
    </section>
  );
}
