"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { MessageSquarePlus, Send, Star } from "lucide-react";
import { createTicketAction, rateTicketAction, replyTicketAction } from "./actions";

type State = { error?: string; ok?: boolean } | null;

const inputClass = "rounded-lg border border-white/[0.08] bg-[var(--panel-surface-2)] px-3 py-2 text-[13px] text-white outline-none placeholder:text-white/20 focus:border-[var(--chart-1)]/45";

export function NewTicketForm() {
  const [state, formAction] = useActionState(createTicketAction, null as State);
  return (
    <form action={formAction} className="grid gap-3 rounded-2xl border border-white/[0.07] bg-[var(--panel-surface)] p-5 md:grid-cols-4">
      {state?.error && <div className="md:col-span-4 text-[13px] text-[var(--critical)]">{state.error}</div>}
      <input name="subject" placeholder="Assunto" className={`${inputClass} md:col-span-2`} />
      <select name="category" className={inputClass} defaultValue="technical">
        <option value="technical">Problema tecnico</option>
        <option value="billing">Pagamento/licenca</option>
        <option value="optimizer">Optimizer desktop</option>
        <option value="other">Outro</option>
      </select>
      <select name="priority" className={inputClass} defaultValue="normal">
        <option value="normal">Normal</option>
        <option value="urgent">Urgente</option>
      </select>
      <textarea name="body" rows={5} placeholder="Explica o que aconteceu, o jogo/app, erro e o que ja tentaste." className={`${inputClass} resize-y md:col-span-4`} />
      <Submit className="md:col-span-4"><MessageSquarePlus size={14} />Abrir suporte</Submit>
    </form>
  );
}

export function ReplyForm({ ticketId }: { ticketId: number }) {
  const [state, formAction] = useActionState(replyTicketAction, null as State);
  return (
    <form action={formAction} className="mt-5 rounded-2xl border border-white/[0.07] bg-[var(--panel-surface)] p-5">
      <input type="hidden" name="ticketId" value={ticketId} />
      {state?.error && <div className="mb-3 text-[13px] text-[var(--critical)]">{state.error}</div>}
      {state?.ok && <div className="mb-3 text-[13px] text-[var(--good)]">Resposta enviada.</div>}
      <textarea name="body" rows={5} placeholder="Escreve a resposta..." className={`${inputClass} w-full resize-y`} />
      <div className="mt-3 flex justify-end"><Submit><Send size={14} />Responder</Submit></div>
    </form>
  );
}

export function RatingForm({ ticketId }: { ticketId: number }) {
  const [state, formAction] = useActionState(rateTicketAction, null as State);
  return (
    <form action={formAction} className="mt-5 grid gap-3 rounded-2xl border border-[var(--chart-1)]/20 bg-[var(--chart-1)]/[0.05] p-5 md:grid-cols-[160px_1fr_auto]">
      <input type="hidden" name="ticketId" value={ticketId} />
      {state?.error && <div className="md:col-span-3 text-[13px] text-[var(--critical)]">{state.error}</div>}
      {state?.ok && <div className="md:col-span-3 text-[13px] text-[var(--good)]">Obrigado pela avaliacao.</div>}
      <select name="rating" className={inputClass} defaultValue="5">
        <option value="5">5 estrelas</option>
        <option value="4">4 estrelas</option>
        <option value="3">3 estrelas</option>
        <option value="2">2 estrelas</option>
        <option value="1">1 estrela</option>
      </select>
      <input name="comment" placeholder="Comentario opcional" className={inputClass} />
      <Submit><Star size={14} />Avaliar</Submit>
    </form>
  );
}

function Submit({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending} className={`inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--chart-1)] px-4 py-2.5 text-[13px] font-semibold text-black transition-opacity disabled:cursor-wait disabled:opacity-60 ${className}`}>
      {pending ? "A enviar..." : children}
    </button>
  );
}
