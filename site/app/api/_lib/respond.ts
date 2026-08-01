import { NextResponse } from "next/server";

const HEADERS = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
};

export function ok(payload: Record<string, unknown>) {
  return NextResponse.json({ ok: true, ...payload }, { headers: HEADERS });
}

export function fail(error: string, status = 400, code = "error") {
  return NextResponse.json({ ok: false, code, error }, { status, headers: HEADERS });
}

/** Le o corpo JSON sem rebentar se vier vazio ou malformado. */
export async function body(req: Request): Promise<Record<string, unknown>> {
  try {
    const data = await req.json();
    return data && typeof data === "object" ? (data as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}
