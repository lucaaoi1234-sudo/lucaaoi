import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server/auth";
import { createTrainingSession, listTrainingSessions } from "@/lib/server/services";
import {
  assertSameOrigin,
  handleRouteError,
  jsonError,
  parseJsonBody,
  requireJsonContentType,
} from "@/lib/server/http";
import { rateLimit } from "@/lib/server/rate-limit";
import { sessionListQuerySchema, sessionSubmitSchema } from "@/lib/validation/schemas";

export const runtime = "nodejs";

/** Danh sách buổi tập của người dùng đang đăng nhập. */
export async function GET(req: Request): Promise<NextResponse> {
  try {
    const user = await getCurrentUser();
    if (!user) return jsonError(401, "Bạn cần đăng nhập để xem lịch sử lưu trên máy chủ");

    const query = sessionListQuerySchema.safeParse({
      limit: new URL(req.url).searchParams.get("limit") ?? undefined,
    });
    if (!query.success) return jsonError(400, "Tham số không hợp lệ");

    const sessions = await listTrainingSessions(user.id, query.data.limit);
    return NextResponse.json({ sessions }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return handleRouteError(error, "sessions:list");
  }
}

/** Lưu một buổi tập. `userId` luôn lấy từ phiên đăng nhập, không nhận từ body. */
export async function POST(req: Request): Promise<NextResponse> {
  const originError = assertSameOrigin(req);
  if (originError) return originError;
  const typeError = requireJsonContentType(req);
  if (typeError) return typeError;

  try {
    const user = await getCurrentUser();
    if (!user) return jsonError(401, "Bạn cần đăng nhập để lưu buổi tập");

    const limit = rateLimit(`sessions:${user.id}`, 120, 10 * 60 * 1000);
    if (!limit.allowed) return jsonError(429, "Gửi quá nhiều buổi tập. Thử lại sau ít phút.");

    const parsed = await parseJsonBody(req, sessionSubmitSchema, 8_192);
    if (!parsed.ok) return parsed.response;

    const session = await createTrainingSession(user.id, parsed.data);
    return NextResponse.json({ session }, { status: 201 });
  } catch (error) {
    return handleRouteError(error, "sessions:create");
  }
}
