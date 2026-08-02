import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Lock } from "lucide-react";
import { Card, StatusBadge } from "@/components/panel/Pieces";
import { requireRole } from "@/lib/session";
import { dateTime } from "@/lib/stats";
import { findSupportTicket, listSupportMessages, markTicketRead } from "@/lib/repo/support";
import { closeTicketAction } from "@/app/panel/support/actions";
import { ReplyForm } from "@/app/panel/support/SupportForms";

export const dynamic = "force-dynamic";

export default async function AdminSupportTicketPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole("staff");
  const { id } = await params;
  const ticket = await findSupportTicket(Number(id));
  if (!ticket) notFound();
  if (ticket.unread_for_staff === 1) await markTicketRead(ticket, "staff");
  const messages = await listSupportMessages(ticket.id);

  return (
    <>
      <Link href="/panel/admin/support" className="inline-flex items-center gap-2 text-[13px] text-white/35 hover:text-white">
        <ArrowLeft size={14} /> Voltar a fila
      </Link>

      <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--chart-1)]">Suporte interno</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-white">#{ticket.id} · {ticket.subject}</h1>
          <p className="mt-1.5 text-[13px] text-white/40">
            {ticket.discord_username ?? ticket.username} · {ticket.category} · criado {dateTime(ticket.created_at)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={ticket.status} />
          {ticket.status !== "closed" && (
            <form action={closeTicketAction}>
              <input type="hidden" name="ticketId" value={ticket.id} />
              <button className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-[12.5px] font-semibold text-white/55 hover:border-[var(--chart-1)]/35 hover:text-white">
                <Lock size={14} /> Terminar
              </button>
            </form>
          )}
        </div>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_280px]">
        <Card>
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

        <aside className="space-y-4">
          <Card title="Cliente">
            <div className="space-y-2 text-[13px] text-white/45">
              <div>Utilizador: <span className="text-white/70">{ticket.username}</span></div>
              <div>Discord: <span className="text-white/70">{ticket.discord_username ?? ticket.discord_id ?? "nao ligado"}</span></div>
              <div>Prioridade: <span className="text-white/70">{ticket.priority === "urgent" ? "Urgente" : "Normal"}</span></div>
              <div>Responsavel: <span className="text-white/70">{ticket.assigned_name ?? "por atribuir"}</span></div>
            </div>
          </Card>
          {ticket.rating && (
            <Card title="Avaliacao">
              <div className="text-2xl font-bold text-[var(--chart-1)]">{ticket.rating}/5</div>
              {ticket.rating_comment && <p className="mt-2 text-[13px] leading-relaxed text-white/45">{ticket.rating_comment}</p>}
            </Card>
          )}
        </aside>
      </div>

      {ticket.status !== "closed" && <ReplyForm ticketId={ticket.id} />}
    </>
  );
}
