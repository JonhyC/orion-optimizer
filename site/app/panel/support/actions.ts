"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { audit } from "@/lib/db";
import { roleAtLeast, requireRole, requireUser } from "@/lib/session";
import {
  addSupportMessage,
  closeSupportTicket,
  createSupportTicket,
  findSupportTicket,
  rateSupportTicket,
} from "@/lib/repo/support";
import { notifySupportDiscord } from "@/lib/support-discord";
import type { SupportTicketPriority } from "@/lib/repo/types";

type State = { error?: string; ok?: boolean } | null;

function text(formData: FormData, key: string, max: number) {
  return String(formData.get(key) ?? "").trim().slice(0, max);
}

function validPriority(value: string): SupportTicketPriority {
  return value === "urgent" ? "urgent" : "normal";
}

export async function createTicketAction(_prev: State, formData: FormData): Promise<State> {
  const user = await requireUser();
  const subject = text(formData, "subject", 120);
  const category = text(formData, "category", 40) || "general";
  const priority = validPriority(text(formData, "priority", 20));
  const body = text(formData, "body", 4000);
  if (subject.length < 4) return { error: "Escreve um assunto mais claro." };
  if (body.length < 10) return { error: "Descreve o problema com mais detalhe." };

  const { ticket } = await createSupportTicket({ user, subject, category, priority, body });
  audit(user.id, "support_ticket_created", `#${ticket.id}`);
  await notifySupportDiscord("created", ticket, user, body);
  revalidatePath("/panel/support");
  revalidatePath("/panel/admin/support");
  redirect(`/panel/support/${ticket.id}`);
}

export async function replyTicketAction(_prev: State, formData: FormData): Promise<State> {
  const user = await requireUser();
  const ticketId = Number(formData.get("ticketId"));
  const body = text(formData, "body", 4000);
  if (!Number.isFinite(ticketId)) return { error: "Ticket invalido." };
  if (body.length < 2) return { error: "Escreve uma resposta." };
  const ticket = await findSupportTicket(ticketId);
  if (!ticket) return { error: "Ticket nao encontrado." };
  const staff = roleAtLeast(user, "staff");
  if (!staff && ticket.user_id !== user.id) return { error: "Sem acesso a este ticket." };
  if (ticket.status === "closed") return { error: "Este suporte ja foi terminado." };

  await addSupportMessage({ ticket, actor: user, body, authorRole: staff ? "staff" : "user" });
  audit(user.id, staff ? "support_staff_replied" : "support_user_replied", `#${ticket.id}`);
  await notifySupportDiscord("reply", { ...ticket, status: staff ? "answered" : "open" }, user, body);
  revalidatePath(`/panel/support/${ticket.id}`);
  revalidatePath(`/panel/admin/support/${ticket.id}`);
  revalidatePath("/panel/support");
  revalidatePath("/panel/admin/support");
  return { ok: true };
}

export async function closeTicketAction(formData: FormData): Promise<void> {
  const actor = await requireRole("staff");
  const ticketId = Number(formData.get("ticketId"));
  const ticket = Number.isFinite(ticketId) ? await findSupportTicket(ticketId) : null;
  if (!ticket) return;
  await closeSupportTicket(ticket, actor);
  audit(actor.id, "support_ticket_closed", `#${ticket.id}`);
  await notifySupportDiscord("closed", { ...ticket, status: "closed" }, actor);
  revalidatePath(`/panel/support/${ticket.id}`);
  revalidatePath(`/panel/admin/support/${ticket.id}`);
  revalidatePath("/panel/support");
  revalidatePath("/panel/admin/support");
}

export async function rateTicketAction(_prev: State, formData: FormData): Promise<State> {
  const user = await requireUser();
  const ticketId = Number(formData.get("ticketId"));
  const rating = Math.max(1, Math.min(5, Number(formData.get("rating")) || 0));
  const comment = text(formData, "comment", 1200);
  const ticket = Number.isFinite(ticketId) ? await findSupportTicket(ticketId) : null;
  if (!ticket || ticket.user_id !== user.id) return { error: "Sem acesso a este ticket." };
  if (ticket.status !== "closed") return { error: "So podes avaliar depois do suporte terminar." };
  if (!rating) return { error: "Escolhe uma avaliacao." };
  await rateSupportTicket(ticket, rating, comment);
  audit(user.id, "support_ticket_rated", `#${ticket.id} ${rating}/5`);
  await notifySupportDiscord("rated", ticket, user, `${rating}/5${comment ? ` - ${comment}` : ""}`);
  revalidatePath(`/panel/support/${ticket.id}`);
  revalidatePath(`/panel/admin/support/${ticket.id}`);
  return { ok: true };
}
