import Link from "next/link";
import { MessageSquareWarning, Star } from "lucide-react";
import { Card, StatTile, StatusBadge } from "@/components/panel/Pieces";
import { requireRole } from "@/lib/session";
import { dateTime } from "@/lib/stats";
import { listAllSupportTickets } from "@/lib/repo/support";

export const dynamic = "force-dynamic";

export default async function AdminSupportPage() {
  await requireRole("staff");
  const tickets = await listAllSupportTickets();
  const open = tickets.filter((ticket) => ticket.status !== "closed");
  const unread = tickets.filter((ticket) => ticket.unread_for_staff === 1);
  const rated = tickets.filter((ticket) => ticket.rating !== null);
  const average = rated.length ? rated.reduce((sum, ticket) => sum + Number(ticket.rating), 0) / rated.length : 0;

  return (
    <>
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--chart-1)]">Suporte</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-white">Fila de suporte</h1>
        <p className="mt-1.5 text-[14px] text-white/40">Pedidos recebidos pelo site e enviados para o Discord da equipa.</p>
      </div>

      <div className="mt-7 grid gap-4 sm:grid-cols-3">
        <StatTile label="Abertos" value={String(open.length)} foot="a aguardar conclusao" />
        <StatTile label="Por ler" value={String(unread.length)} foot="novas mensagens de clientes" />
        <StatTile label="Avaliacao media" value={rated.length ? average.toFixed(1) : "N/D"} foot={`${rated.length} avaliacoes`} />
      </div>

      <Card className="mt-6" title="Tickets recentes">
        {tickets.length === 0 ? (
          <div className="py-10 text-center">
            <MessageSquareWarning className="mx-auto text-white/20" />
            <p className="mt-3 text-[13px] text-white/35">Ainda nao ha pedidos de suporte.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr>
                  {["Ticket", "Cliente", "Prioridade", "Atualizado", "Estado", "Avaliacao"].map((h) => (
                    <th key={h} className="border-b border-white/[0.06] px-2.5 py-2 text-left text-[10.5px] font-semibold uppercase tracking-wide text-white/35">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tickets.map((ticket) => (
                  <tr key={ticket.id}>
                    <td className="border-b border-white/[0.04] px-2.5 py-3">
                      <Link href={`/panel/admin/support/${ticket.id}`} className="font-semibold text-white hover:text-[var(--chart-1)]">
                        {ticket.unread_for_staff === 1 && <span className="mr-2 inline-block h-2 w-2 rounded-full bg-[var(--chart-1)]" />}
                        #{ticket.id} · {ticket.subject}
                      </Link>
                    </td>
                    <td className="border-b border-white/[0.04] px-2.5 py-3 text-white/55">{ticket.discord_username ?? ticket.username}</td>
                    <td className="border-b border-white/[0.04] px-2.5 py-3 text-white/45">{ticket.priority === "urgent" ? "Urgente" : "Normal"}</td>
                    <td className="border-b border-white/[0.04] px-2.5 py-3 tabular-nums text-white/45">{dateTime(ticket.updated_at)}</td>
                    <td className="border-b border-white/[0.04] px-2.5 py-3"><StatusBadge status={ticket.status} /></td>
                    <td className="border-b border-white/[0.04] px-2.5 py-3 text-white/50">
                      {ticket.rating ? <span className="inline-flex items-center gap-1 text-[var(--chart-1)]"><Star size={13} />{ticket.rating}/5</span> : "sem avaliacao"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
