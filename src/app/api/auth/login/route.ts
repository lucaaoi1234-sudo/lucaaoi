import { NextResponse } from "next/server";
import { sessionCookieOptions, signSessionToken, SESSION_COOKIE, verifyPassword } from "@/lib/server/auth";
import { getDb } from "@/lib/server/db";
import { assertSameOrigin, clientIp, handleRouteError, jsonError, parseJsonBody, requireJsonContentType } from "@/lib/server/http";
import { rateLimit } from "@/lib/server/rate-limit";
import { loginSchema } from "@/lib/validation/schemas";

export const runtime = "nodejs";

const FIFTEEN_MINUTES = 15 * 60 * 1000;

export async function POST(req: Request): Promise<NextResponse> {
  const originError = assertSameOrigin(req);
  if (originError) return originError;
  const typeError = requireJsonContentType(req);
  if (typeError) return typeError;

  const ip = clientIp(req);
  const ipLimit = rateLimit(`login-ip:${ip}`, 30, FIFTEEN_MINUTES);
  if (!ipLimit.allowed) {
    return jsonError(429, `Quá nhiều lần đăng nhập. Thử lại sau ${ipLimit.retryAfterSec} giây.`);
  }

  const parsed = await parseJsonBody(req, loginSchema);
  if (!parsed.ok) return parsed.response;
  const { email, password } = parsed.data;

  const accountLimit = rateLimit(`login-account:${email}`, 10, FIFTEEN_MINUTES);
  if (!accountLimit.allowed) {
    return jsonError(429, `Tài khoản này bị khóa tạm thời. Thử lại sau ${accountLimit.retryAfterSec} giây.`);
  }

  try {
    const user = await getDb().user.findUnique({
      where: { email },
      select: { id: true, email: true, displayName: true, passwordHash: true },
    });
    const ok = await verifyPassword(password, user?.passwordHash ?? null);
    if (!user || !ok) {
      // Thông báo chung để không tiết lộ email nào đã đăng ký.
      return jsonError(401, "Email hoặc mật khẩu không đúng");
    }

    const token = await signSessionToken(user.id);
    const res = NextResponse.json({ user: { id: user.id, email: user.email, displayName: user.displayName } });
    res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
    return res;
  } catch (error) {
    return handleRouteError(error, "auth/login");
  }
}
