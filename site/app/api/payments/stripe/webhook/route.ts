import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { completePaidOrder } from "@/lib/checkout";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  const signature = req.headers.get("stripe-signature") ?? "";
  const payload = await req.text();

  if (secret && !validStripeSignature(payload, signature, secret)) {
    return NextResponse.json({ error: "invalid_signature" }, { status: 400 });
  }

  const event = JSON.parse(payload) as {
    type?: string;
    data?: { object?: { metadata?: { order_id?: string }; client_reference_id?: string } };
  };

  if (event.type === "checkout.session.completed") {
    const session = event.data?.object;
    const orderId = Number(session?.metadata?.order_id ?? session?.client_reference_id);
    if (Number.isFinite(orderId)) await completePaidOrder(orderId);
  }

  return NextResponse.json({ ok: true });
}

function validStripeSignature(payload: string, header: string, secret: string): boolean {
  const parts = Object.fromEntries(header.split(",").map((part) => {
    const [key, value] = part.split("=");
    return [key, value];
  }));
  const timestamp = parts.t;
  const expected = parts.v1;
  if (!timestamp || !expected) return false;

  const signed = `${timestamp}.${payload}`;
  const actual = crypto.createHmac("sha256", secret).update(signed).digest("hex");
  const a = Buffer.from(actual);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
