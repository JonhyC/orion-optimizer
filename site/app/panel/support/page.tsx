import Link from "next/link";
import { MessageSquare, Star } from "lucide-react";
import { Card, StatusBadge } from "@/components/panel/Pieces";
import { requireUser } from "@/lib/session";
import { dateTime } from "@/lib/stats";
import { listSupportTicketsForUser } from "@/lib/repo/support";
import { NewTicketForm } from "./SupportForms";

export const dynamic = "force-dynamic";

export default async function SupportPage() {
  const user = await requireUser();
  const tickets = await listSupportTicketsForUser(user.id);

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--chart-1)]">Suporte Orion</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-white">Pedidos de suporte</h1>
          <p className="mt-1.5 text-[14px] text-white/40">Abre tickets, acompanha respostas e avalia o atendimento quando terminar.</p>
        </div>
        <div className="rounded-lg border border-white/[0.08] bg-white/[0.025] px-4 py-2 text-[12.5px] text-white/45">
          {tickets.filter((ticket) => ticket.unread_for_user === 1).length} notificacoes
        </div>
      </div>

      <div className="mt-7">
        <NewTicketForm />
      </div>

      <div className="mt-7 grid gap-4">
        {tickets.length === 0 ? (
          <Card>
            <div className="py-10 text-center">
              <MessageSquare className="mx-auto text-white/20" />
              <p className="mt-3 text-[13px] text-white/35">Ainda nao abriste nenhum pedido.</p>
            </div>
          </Card>
        ) : tickets.map((ticket) => (
          <Link key={ticket.id} href={`/panel/support/${ticket.id}`} className="group rounded-2xl border border-white/[0.07] bg-[var(--panel-surface)] p-5 transition-colors hover:border-[var(--chart-1)]/30">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  {ticket.unread_for_user === 1 && <span className="h-2 w-2 rounded-full bg-[var(--chart-1)]" />}
                  <h2 className="truncate text-[15px] font-semibold text-white">#{ticket.id} · {ticket.subject}</h2>
                </div>
                <p className="mt-1 text-[12.5px] text-white/35">{ticket.category} · atualizado {dateTime(ticket.updated_at)}</p>
              </div>
              <div className="flex items-center gap-2">
                {ticket.rating && <span className="inline-flex items-center gap-1 text-[12px] text-[var(--chart-1)]"><Star size={13} />{ticket.rating}/5</span>}
                <StatusBadge status={ticket.status} />
              </div>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
