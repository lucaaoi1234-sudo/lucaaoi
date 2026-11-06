import "server-only";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { jwtVerify, SignJWT } from "jose";
import { getDb } from "./db";
import { getServerEnv } from "./env";

/**
 * Xác thực tự xây dựng (tương đương an toàn với Auth.js credentials):
 * - Mật khẩu băm bằng bcrypt (cost 12). Không bao giờ trả về hash.
 * - Phiên là JWT HS256 ký bằng AUTH_SECRET, lưu trong cookie httpOnly + SameSite=Lax (+ Secure ở production).
 * - Mỗi request đều đối chiếu người dùng trong DB, nên tài khoản bị xoá sẽ mất quyền ngay.
 */

export const SESSION_COOKIE = "aimforge_session";
const ISSUER = "aimforge";
const BCRYPT_COST = 12;

export interface CurrentUser {
  id: string;
  email: string;
  displayName: string;
}

function signingKey(): Uint8Array {
  return new TextEncoder().encode(getServerEnv().authSecret);
}

export async function signSessionToken(userId: string): Promise<string> {
  const { sessionTtlSeconds } = getServerEnv();
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(userId)
    .setIssuer(ISSUER)
    .setIssuedAt()
    .setExpirationTime(`${sessionTtlSeconds}s`)
    .sign(signingKey());
}

export async function verifySessionToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, signingKey(), {
      algorithms: ["HS256"],
      issuer: ISSUER,
    });
    return typeof payload.sub === "string" && payload.sub.length > 0 ? payload.sub : null;
  } catch {
    // Token hết hạn, sai chữ ký hoặc sai định dạng: coi như chưa đăng nhập.
    return null;
  }
}

export function sessionCookieOptions(): {
  httpOnly: true;
  sameSite: "lax";
  secure: boolean;
  path: "/";
  maxAge: number;
} {
  const { sessionTtlSeconds, cookieSecure } = getServerEnv();
  return { httpOnly: true, sameSite: "lax", secure: cookieSecure, path: "/", maxAge: sessionTtlSeconds };
}

/** Người dùng hiện tại theo cookie phiên. Trả về null nếu khách hoặc phiên không hợp lệ. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const userId = await verifySessionToken(token);
  if (!userId) return null;
  const user = await getDb().user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, displayName: true },
  });
  return user;
}

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_COST);
}

let dummyHashPromise: Promise<string> | null = null;

/**
 * So khớp mật khẩu. Khi không tìm thấy email vẫn chạy bcrypt với hash giả
 * để thời gian phản hồi không tiết lộ email có tồn tại hay không.
 */
export async function verifyPassword(password: string, hash: string | null): Promise<boolean> {
  if (hash === null) {
    dummyHashPromise ??= bcrypt.hash("aimforge-dummy-password", BCRYPT_COST);
    await bcrypt.compare(password, await dummyHashPromise);
    return false;
  }
  return bcrypt.compare(password, hash);
}
