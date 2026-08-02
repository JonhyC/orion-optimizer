import { firestore } from "../firebase-admin.ts";
import { cached, invalidateCache } from "../cache.ts";
import { allocateId } from "./ids.ts";
import {
  COLLECTIONS,
  type SupportMessage,
  type SupportTicket,
  type SupportTicketPriority,
  type SupportTicketStatus,
  type User,
} from "./types.ts";

function ticketsCol() {
  return firestore().collection(COLLECTIONS.supportTickets);
}

function messagesCol() {
  return firestore().collection(COLLECTIONS.supportMessages);
}

function invalidateSupportCounters(userId?: number): void {
  invalidateCache("support:unread:staff");
  if (userId !== undefined) invalidateCache(`support:unread:user:${userId}`);
}

function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

function normalizeTicket(data: Partial<SupportTicket>, id: number): SupportTicket {
  return {
    id,
    user_id: Number(data.user_id),
    username: data.username ?? "",
    discord_id: data.discord_id ?? null,
    discord_username: data.discord_username ?? null,
    subject: data.subject ?? "",
    category: data.category ?? "general",
    priority: (data.priority ?? "normal") as SupportTicketPriority,
    status: (data.status ?? "open") as SupportTicketStatus,
    assigned_to: data.assigned_to ?? null,
    assigned_name: data.assigned_name ?? null,
    rating: data.rating ?? null,
    rating_comment: data.rating_comment ?? null,
    unread_for_user: Number(data.unread_for_user ?? 0),
    unread_for_staff: Number(data.unread_for_staff ?? 0),
    created_at: Number(data.created_at ?? nowSeconds()),
    updated_at: Number(data.updated_at ?? nowSeconds()),
    closed_at: data.closed_at ?? null,
  };
}

function normalizeMessage(data: Partial<SupportMessage>, id: number): SupportMessage {
  return {
    id,
    ticket_id: Number(data.ticket_id),
    user_id: Number(data.user_id),
    username: data.username ?? "",
    author_role: data.author_role ?? "user",
    body: data.body ?? "",
    created_at: Number(data.created_at ?? nowSeconds()),
  };
}

function ticketFromDoc(doc: FirebaseFirestore.DocumentSnapshot): SupportTicket {
  return normalizeTicket(doc.data() as Partial<SupportTicket>, Number(doc.id));
}

function messageFromDoc(doc: FirebaseFirestore.DocumentSnapshot): SupportMessage {
  return normalizeMessage(doc.data() as Partial<SupportMessage>, Number(doc.id));
}

export async function createSupportTicket(params: {
  user: User;
  subject: string;
  category: string;
  priority: SupportTicketPriority;
  body: string;
}): Promise<{ ticket: SupportTicket; message: SupportMessage }> {
  const created = nowSeconds();
  const ticketId = await allocateId(COLLECTIONS.supportTickets);
  const messageId = await allocateId(COLLECTIONS.supportMessages);
  const ticket = normalizeTicket({
    id: ticketId,
    user_id: params.user.id,
    username: params.user.username,
    discord_id: params.user.discord_id,
    discord_username: params.user.discord_username,
    subject: params.subject,
    category: params.category,
    priority: params.priority,
    status: "open",
    unread_for_user: 0,
    unread_for_staff: 1,
    created_at: created,
    updated_at: created,
  }, ticketId);
  const message = normalizeMessage({
    id: messageId,
    ticket_id: ticketId,
    user_id: params.user.id,
    username: params.user.discord_username ?? params.user.username,
    author_role: "user",
    body: params.body,
    created_at: created,
  }, messageId);

  const batch = firestore().batch();
  batch.set(ticketsCol().doc(String(ticketId)), ticket);
  batch.set(messagesCol().doc(String(messageId)), message);
  await batch.commit();
  invalidateSupportCounters(params.user.id);
  return { ticket, message };
}

export async function addSupportMessage(params: {
  ticket: SupportTicket;
  actor: User;
  body: string;
  authorRole: "user" | "staff";
}): Promise<SupportMessage> {
  const created = nowSeconds();
  const messageId = await allocateId(COLLECTIONS.supportMessages);
  const message = normalizeMessage({
    id: messageId,
    ticket_id: params.ticket.id,
    user_id: params.actor.id,
    username: params.actor.discord_username ?? params.actor.username,
    author_role: params.authorRole,
    body: params.body,
    created_at: created,
  }, messageId);

  const status: SupportTicketStatus = params.authorRole === "staff" ? "answered" : "open";
  const patch: Partial<SupportTicket> = {
    status: params.ticket.status === "closed" ? "closed" : status,
    updated_at: created,
    unread_for_user: params.authorRole === "staff" ? 1 : params.ticket.unread_for_user,
    unread_for_staff: params.authorRole === "user" ? 1 : 0,
    assigned_to: params.authorRole === "staff" ? params.actor.id : params.ticket.assigned_to,
    assigned_name: params.authorRole === "staff" ? params.actor.username : params.ticket.assigned_name,
  };

  const batch = firestore().batch();
  batch.set(messagesCol().doc(String(messageId)), message);
  batch.set(ticketsCol().doc(String(params.ticket.id)), patch, { merge: true });
  await batch.commit();
  invalidateSupportCounters(params.ticket.user_id);
  return message;
}

export async function closeSupportTicket(ticket: SupportTicket, actor: User): Promise<void> {
  const closed = nowSeconds();
  await ticketsCol().doc(String(ticket.id)).set({
    status: "closed",
    assigned_to: actor.id,
    assigned_name: actor.username,
    unread_for_user: 1,
    unread_for_staff: 0,
    updated_at: closed,
    closed_at: closed,
  } satisfies Partial<SupportTicket>, { merge: true });
  invalidateSupportCounters(ticket.user_id);
}

export async function rateSupportTicket(ticket: SupportTicket, rating: number, comment: string): Promise<void> {
  await ticketsCol().doc(String(ticket.id)).set({
    rating,
    rating_comment: comment || null,
    unread_for_staff: 1,
    updated_at: nowSeconds(),
  } satisfies Partial<SupportTicket>, { merge: true });
  invalidateSupportCounters(ticket.user_id);
}

export async function markTicketRead(ticket: SupportTicket, reader: "user" | "staff"): Promise<void> {
  await ticketsCol().doc(String(ticket.id)).set({
    [reader === "user" ? "unread_for_user" : "unread_for_staff"]: 0,
  }, { merge: true });
  invalidateSupportCounters(ticket.user_id);
}

export async function findSupportTicket(id: number): Promise<SupportTicket | null> {
  const doc = await ticketsCol().doc(String(id)).get();
  return doc.exists ? ticketFromDoc(doc) : null;
}

export async function listSupportTicketsForUser(userId: number): Promise<SupportTicket[]> {
  const snap = await ticketsCol().where("user_id", "==", userId).get();
  return snap.docs.map(ticketFromDoc).sort((a, b) => b.updated_at - a.updated_at);
}

export async function listAllSupportTickets(limit = 150): Promise<SupportTicket[]> {
  const snap = await ticketsCol().orderBy("updated_at", "desc").limit(Math.max(1, Math.min(300, limit))).get();
  return snap.docs.map(ticketFromDoc);
}

export async function listSupportMessages(ticketId: number): Promise<SupportMessage[]> {
  const snap = await messagesCol().where("ticket_id", "==", ticketId).get();
  return snap.docs.map(messageFromDoc).sort((a, b) => a.created_at - b.created_at);
}

export async function countUnreadSupport(user: User): Promise<{ mine: number; staff: number }> {
  const staffRole = ["staff", "developer", "owner"].includes(user.role);
  const [mineSnap, staffSnap] = await Promise.all([
    cached(`support:unread:user:${user.id}`, 5_000, () =>
      ticketsCol().where("user_id", "==", user.id).get()
    ),
    staffRole
      ? cached("support:unread:staff", 5_000, () =>
          ticketsCol().where("unread_for_staff", "==", 1).count().get()
        )
      : Promise.resolve(null),
  ]);
  return {
    mine: mineSnap.docs.filter((doc) => Number(doc.get("unread_for_user") ?? 0) === 1).length,
    staff: staffSnap?.data().count ?? 0,
  };
}
