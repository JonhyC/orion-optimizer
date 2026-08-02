"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Plus } from "lucide-react";
import { createCouponAction } from "../../actions";

type State = { error?: string; ok?: boolean } | null;

export default function CouponCreator() {
  const [state, formAction] = useActionState(createCouponAction, null as State);

  return (
    <form action={formAction} className="grid gap-3 rounded-lg border border-white/[0.08] bg-[var(--panel-surface)] p-5 md:grid-cols-6">
      {state?.error && <div className="md:col-span-6 text-[13px] text-[var(--critical)]">{state.error}</div>}
      <input name="code" placeholder="CODIGO" className="rounded-lg border border-white/[0.08] bg-[var(--panel-surface-2)] px-3 py-2 text-[13px] uppercase text-white outline-none md:col-span-1" />
      <input name="description" placeholder="Descricao interna" className="rounded-lg border border-white/[0.08] bg-[var(--panel-surface-2)] px-3 py-2 text-[13px] text-white outline-none md:col-span-2" />
      <select name="type" className="rounded-lg border border-white/[0.08] bg-[var(--panel-surface-2)] px-3 py-2 text-[13px] text-white outline-none">
        <option value="percent">Percentagem</option>
        <option value="amount">Valor EUR</option>
      </select>
      <input name="value" placeholder="Valor" inputMode="decimal" className="rounded-lg border border-white/[0.08] bg-[var(--panel-surface-2)] px-3 py-2 text-[13px] text-white outline-none" />
      <Submit />
      <input name="maxRedemptions" placeholder="Usos max." inputMode="numeric" className="rounded-lg border border-white/[0.08] bg-[var(--panel-surface-2)] px-3 py-2 text-[13px] text-white outline-none md:col-span-2" />
      <input name="expiresAt" type="date" className="rounded-lg border border-white/[0.08] bg-[var(--panel-surface-2)] px-3 py-2 text-[13px] text-white outline-none md:col-span-2" />
      {state?.ok && <div className="md:col-span-2 self-center text-[12px] text-[var(--good)]">Cupao criado.</div>}
    </form>
  );
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending} className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--chart-1)] px-4 py-2 text-[13px] font-semibold text-[#16082c] disabled:opacity-60">
      <Plus size={14} />
      Criar
    </button>
  );
}
