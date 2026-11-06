import "server-only";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import type { ZodType, z } from "zod";
import { formatZodIssues } from "../validation/schemas";
import { ConfigError } from "./env";

export function jsonError(status: number, message: string, details?: string[]): NextResponse {
  return NextResponse.json({ error: message, details: details ?? [] }, { status });
}

/**
 * Chặn CSRF cho các request thay đổi dữ liệu: nếu có header Origin thì phải cùng host.
 * Kết hợp với SameSite=Lax và yêu cầu Content-Type JSON (form đa miền không gửi được JSON không preflight).
 */
export function assertSameOrigin(req: Request): NextResponse | null {
  const origin = req.headers.get("origin");
  if (origin !== null) {
    let originHost: string;
    try {
      originHost = new URL(origin).host;
    } catch {
      return jsonError(403, "Nguồn yêu cầu không hợp lệ");
    }
    if (originHost !== req.headers.get("host")) {
      return jsonError(403, "Yêu cầu từ nguồn không được phép");
    }
  }
  return null;
}

export function requireJsonContentType(req: Request): NextResponse | null {
  const type = req.headers.get("content-type") ?? "";
  if (!type.toLowerCase().includes("application/json")) {
    return jsonError(415, "Yêu cầu phải dùng Content-Type: application/json");
  }
  return null;
}

export type ParseResult<T> = { ok: true; data: T } | { ok: false; response: NextResponse };

/** Đọc và kiểm tra JSON body bằng Zod. Body quá lớn hoặc sai JSON đều trả về lỗi 400/413. */
export async function parseJsonBody<S extends ZodType>(req: Request, schema: S, maxBytes = 16_384): Promise<ParseResult<z.infer<S>>> {
  const contentLength = Number(req.headers.get("content-length") ?? "0");
  if (contentLength > maxBytes) {
    return { ok: false, response: jsonError(413, "Dữ liệu gửi lên quá lớn") };
  }
  let raw: unknown;
  try {
    const text = await req.text();
    if (text.length > maxBytes) {
      return { ok: false, response: jsonError(413, "Dữ liệu gửi lên quá lớn") };
    }
    raw = JSON.parse(text);
  } catch {
    return { ok: false, response: jsonError(400, "Dữ liệu JSON không hợp lệ") };
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, response: jsonError(400, "Dữ liệu không hợp lệ", formatZodIssues(parsed.error)) };
  }
  return { ok: true, data: parsed.data as z.infer<S> };
}

/**
 * Chuyển lỗi bất ngờ thành phản hồi an toàn: ghi log phía server, không lộ stack trace hay chuỗi kết nối.
 */
export function handleRouteError(error: unknown, context: string): NextResponse {
  if (error instanceof ConfigError) {
    console.error(`[${context}] cấu hình máy chủ: ${error.message}`);
    return jsonError(500, "Máy chủ chưa được cấu hình đúng. Vui lòng kiểm tra file .env.");
  }
  if (error instanceof Prisma.PrismaClientInitializationError || error instanceof Prisma.PrismaClientRustPanicError) {
    console.error(`[${context}] không kết nối được cơ sở dữ liệu`);
    return jsonError(503, "Không kết nối được cơ sở dữ liệu. Hãy kiểm tra PostgreSQL đã chạy chưa.");
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    return jsonError(409, "Dữ liệu đã tồn tại");
  }
  console.error(`[${context}] lỗi không mong muốn`, error instanceof Error ? error.name : "unknown");
  return jsonError(500, "Đã xảy ra lỗi máy chủ. Vui lòng thử lại sau.");
}

export function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return req.headers.get("x-real-ip") ?? "unknown";
}
