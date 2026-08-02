import { NextResponse } from "next/server";
import { currentUser } from "@/lib/session";
import { countUnreadSupport } from "@/lib/repo/support";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ ok: false, mine: 0, staff: 0 }, { status: 401 });
  const unread = await countUnreadSupport(user);
  return NextResponse.json({ ok: true, ...unread });
}
