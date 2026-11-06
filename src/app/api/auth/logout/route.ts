import { NextResponse } from "next/server";
import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/server/auth";
import { assertSameOrigin } from "@/lib/server/http";

export const runtime = "nodejs";

export async function POST(req: Request): Promise<NextResponse> {
  const originError = assertSameOrigin(req);
  if (originError) return originError;

  const res = NextResponse.json({ ok: true });
  // Xoá cookie phiên: maxAge = 0 khiến trình duyệt loại bỏ ngay.
  res.cookies.set(SESSION_COOKIE, "", { ...sessionCookieOptions(), maxAge: 0 });
  return res;
}
