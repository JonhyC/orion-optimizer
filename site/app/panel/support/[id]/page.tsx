import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Card, StatusBadge } from "@/components/panel/Pieces";
import { requireUser } from "@/lib/session";
import { dateTime } from "@/lib/stats";
import { findSupportTicket, listSupportMessages, markTicketRead } from "@/lib/repo/support";
import { RatingForm, ReplyForm } from "../SupportForms";

export const dynamic = "force-dynamic";

export default async function SupportTicketPage({ params }: { params: Promise<{ id: string }> }) {
  const [user, { id }] = await Promise.all([requireUser(), params]);
  const ticket = await findSupportTicket(Number(id));
  if (!ticket) notFound();
  if (ticket.user_id !== user.id && !["staff", "developer", "owner"].includes(user.role)) redirect("/panel/support");
  if (ticket.user_id === user.id && ticket.unread_for_user === 1) await markTicketRead(ticket, "user");
  const messages = await listSupportMessages(ticket.id);

  return (
    <>
      <Link href="/panel/support" className="inline-flex items-center gap-2 text-[13px] text-white/35 hover:text-white">
        <ArrowLeft size={14} /> Voltar ao suporte
      </Link>

      <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--chart-1)]">Ticket #{ticket.id}</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-white">{ticket.subject}</h1>
          <p className="mt-1.5 text-[13px] text-white/40">{ticket.category} · criado {dateTime(ticket.created_at)}</p>
        </div>
        <StatusBadge status={ticket.status} />
      </div>

      <Card className="mt-6">
        <div className="space-y-4">
          {messages.map((message) => (
            <div key={message.id} className={`rounded-xl border p-4 ${message.author_role === "staff" ? "border-[var(--chart-1)]/20 bg-[var(--chart-1)]/[0.055]" : "border-white/[0.06] bg-white/[0.025]"}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <strong className="text-[13px] text-white">{message.username}</strong>
                <span className="text-[11.5px] text-white/30">{message.author_role === "staff" ? "Equipa Orion" : "Cliente"} · {dateTime(message.created_at)}</span>
              </div>
              <p className="mt-3 whitespace-pre-wrap text-[13.5px] leading-relaxed text-white/65">{message.body}</p>
            </div>
          ))}
        </div>
      </Card>

      {ticket.status !== "closed" ? (
        <ReplyForm ticketId={ticket.id} />
      ) : ticket.user_id === user.id && !ticket.rating ? (
        <RatingForm ticketId={ticket.id} />
      ) : ticket.rating ? (
        <div className="mt-5 rounded-2xl border border-[var(--chart-1)]/20 bg-[var(--chart-1)]/[0.05] p-5 text-[13px] text-white/60">
          Avaliacao enviada: <strong className="text-[var(--chart-1)]">{ticket.rating}/5</strong>
          {ticket.rating_comment && <p className="mt-2 text-white/45">{ticket.rating_comment}</p>}
        </div>
      ) : null}
    </>
  );
}
