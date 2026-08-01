"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { UserPlus, X } from "lucide-react";
import { createUserAction } from "../../actions";

type Result = { error?: string; ok?: boolean; username?: string; password?: string } | null;

export default function CreateUser({
  plans,
}: {
  plans: Array<{ code: string; name: string }>;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(createUserAction, null as Result);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-lg bg-[var(--chart-1)] px-4 py-2.5 text-[13px] font-semibold text-[#16082c] transition-opacity hover:opacity-90"
      >
        <UserPlus size={15} />
        Nova conta
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-[var(--panel-surface)] p-6">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-[15px] font-semibold text-white">Nova conta</h2>
        <button
          onClick={() => setOpen(false)}
          className="grid h-7 w-7 place-items-center rounded-lg text-white/40 hover:text-white"
          aria-label="Fechar"
        >
          <X size={15} />
        </button>
      </div>

      {state?.ok ? (
        <div className="rounded-xl border border-[var(--good)]/30 bg-[var(--good)]/[0.07] p-4">
          <p className="text-[12px] font-semibold uppercase tracking-wide text-[var(--good)]">
            Criada — copia agora, nao volta a aparecer
          </p>
          <dl className="mt-3 space-y-2 font-mono text-[13px]">
            <div className="flex gap-3">
              <dt className="w-20 shrink-0 text-white/35">utilizador</dt>
              <dd className="break-all text-white">{state.username}</dd>
            </div>
            <div className="flex gap-3">
              <dt className="w-20 shrink-0 text-white/35">password</dt>
              <dd className="break-all text-white">{state.password}</dd>
            </div>
          </dl>
        </div>
      ) : (
        <form action={formAction} className="grid gap-4 sm:grid-cols-2">
          {state?.error && (
            <div className="sm:col-span-2 rounded-xl border border-[var(--critical)]/35 bg-[var(--critical)]/10 px-4 py-3 text-[13px] text-[#ff9a9a]">
              {state.error}
            </div>
          )}

          <Field label="Utilizador">
            <input
              name="username"
              autoFocus
              className="w-full rounded-lg border border-white/[0.08] bg-[var(--panel-surface-2)] px-3 py-2 text-[14px] text-white outline-none focus:border-[var(--chart-1)]"
            />
          </Field>

          <Field label="Password" hint="Vazio gera uma automaticamente">
            <input
              name="password"
              className="w-full rounded-lg border border-white/[0.08] bg-[var(--panel-surface-2)] px-3 py-2 text-[14px] text-white outline-none focus:border-[var(--chart-1)]"
            />
          </Field>

          <Field label="Papel">
            <select
              name="role"
              defaultValue="member"
              className="w-full rounded-lg border border-white/[0.08] bg-[var(--panel-surface-2)] px-3 py-2 text-[14px] text-white outline-none focus:border-[var(--chart-1)]"
            >
              <option value="member">member</option>
              <option value="client">client</option>
              <option value="staff">staff</option>
              <option value="developer">developer</option>
              <option value="owner">owner</option>
            </select>
          </Field>

          <Field label="Plano">
            <select
              name="tier"
              defaultValue=""
              className="w-full rounded-lg border border-white/[0.08] bg-[var(--panel-surface-2)] px-3 py-2 text-[14px] text-white outline-none focus:border-[var(--chart-1)]"
            >
              <option value="">sem plano</option>
              {plans.map((plan) => (
                <option key={plan.code} value={plan.code}>
                  {plan.name} ({plan.code})
                </option>
              ))}
            </select>
          </Field>

          <Field label="Licenca (dias)" hint="0 = sem licenca">
            <input
              name="days"
              defaultValue="0"
              inputMode="numeric"
              className="w-full rounded-lg border border-white/[0.08] bg-[var(--panel-surface-2)] px-3 py-2 text-[14px] tabular-nums text-white outline-none focus:border-[var(--chart-1)]"
            />
          </Field>

          <div className="flex items-end sm:col-span-2">
            <Submit />
          </div>
        </form>
      )}
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-[12px] font-medium text-white/50">{label}</label>
      <div className="mt-1.5">{children}</div>
      {hint && <p className="mt-1 text-[11px] text-white/25">{hint}</p>}
    </div>
  );
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      disabled={pending}
      className="rounded-lg bg-[var(--chart-1)] px-5 py-2.5 text-[13px] font-semibold text-[#16082c] transition-opacity hover:opacity-90 disabled:opacity-50"
    >
      {pending ? "A criar…" : "Criar conta"}
    </button>
  );
}
