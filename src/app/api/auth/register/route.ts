import { NextResponse } from "next/server";
import { hashPassword, sessionCookieOptions, signSessionToken, SESSION_COOKIE } from "@/lib/server/auth";
import { getDb } from "@/lib/server/db";
import { assertSameOrigin, clientIp, handleRouteError, jsonError, parseJsonBody, requireJsonContentType } from "@/lib/server/http";
import { rateLimit } from "@/lib/server/rate-limit";
import { registerSchema } from "@/lib/validation/schemas";

export const runtime = "nodejs";

export async function POST(req: Request): Promise<NextResponse> {
  const originError = assertSameOrigin(req);
  if (originError) return originError;
  const typeError = requireJsonContentType(req);
  if (typeError) return typeError;

  const limit = rateLimit(`register:${clientIp(req)}`, 10, 60 * 60 * 1000);
  if (!limit.allowed) {
    return jsonError(429, `Quá nhiều lần đăng ký. Thử lại sau ${limit.retryAfterSec} giây.`);
  }

  const parsed = await parseJsonBody(req, registerSchema);
  if (!parsed.ok) return parsed.response;
  const { email, password, displayName } = parsed.data;

  try {
    const db = getDb();
    const existing = await db.user.findUnique({ where: { email }, select: { id: true } });
    if (existing) return jsonError(409, "Email này đã được đăng ký. Hãy đăng nhập.");

    const passwordHash = await hashPassword(password);
    const user = await db.user.create({
      data: { email, displayName, passwordHash, settings: { create: {} } },
      select: { id: true, email: true, displayName: true },
    });

    const token = await signSessionToken(user.id);
    const res = NextResponse.json({ user }, { status: 201 });
    res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
    return res;
  } catch (error) {
    return handleRouteError(error, "auth/register");
  }
}
