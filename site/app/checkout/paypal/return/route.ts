import { NextRequest, NextResponse } from "next/server";
import { capturePaypalOrder } from "@/lib/checkout";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const orderId = Number(req.nextUrl.searchParams.get("order"));
  const token = req.nextUrl.searchParams.get("token");
  const ok = Number.isFinite(orderId) && await capturePaypalOrder(orderId, token);
  return NextResponse.redirect(new URL(ok ? `/checkout/success?order=${orderId}` : "/checkout/cancel", req.url));
}
