import { applicationUrl, discordConfig } from "./discord.ts";
import type { SupportTicket, User } from "./repo/types.ts";

type SupportEvent = "created" | "reply" | "closed" | "rated";

const TITLES: Record<SupportEvent, string> = {
  created: "Novo pedido de suporte",
  reply: "Nova resposta no suporte",
  closed: "Suporte terminado",
  rated: "Suporte avaliado",
};

export async function notifySupportDiscord(event: SupportEvent, ticket: SupportTicket, actor: Pick<User, "username" | "role">, detail = ""): Promise<void> {
  const webhook = process.env.DISCORD_SUPPORT_WEBHOOK_URL?.trim();
  const channelId = process.env.DISCORD_SUPPORT_CHANNEL_ID?.trim();
  const cfg = discordConfig();
  if (!webhook && (!channelId || !cfg?.botToken)) return;

  const url = `${applicationUrl()}/panel/admin/support/${ticket.id}`;
  const payload = {
    embeds: [{
      title: TITLES[event],
      url,
      color: ticket.priority === "urgent" ? 0xd9534f : 0xd6a75b,
      fields: [
        { name: "Ticket", value: `#${ticket.id} - ${ticket.subject}`.slice(0, 1024), inline: false },
        { name: "Cliente", value: `${ticket.discord_username ?? ticket.username}`.slice(0, 1024), inline: true },
        { name: "Estado", value: ticket.status, inline: true },
        { name: "Por", value: `${actor.username} (${actor.role})`.slice(0, 1024), inline: true },
        ...(detail ? [{ name: "Detalhe", value: detail.slice(0, 1024), inline: false }] : []),
      ],
      timestamp: new Date().toISOString(),
    }],
  };

  try {
    if (webhook) {
      await fetch(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      return;
    }

    await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bot ${cfg!.botToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    console.warn("[orion] suporte discord falhou:", error);
  }
}
