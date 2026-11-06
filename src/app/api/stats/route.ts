import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server/auth";
import { getPersonalStats } from "@/lib/server/services";
import { handleRouteError, jsonError } from "@/lib/server/http";

export const runtime = "nodejs";

/** Thống kê cá nhân của người dùng đăng nhập. */
export async function GET(): Promise<NextResponse> {
  try {
    const user = await getCurrentUser();
    if (!user) return jsonError(401, "Bạn cần đăng nhập để xem thống kê lưu trên máy chủ");
    const stats = await getPersonalStats(user.id);
    return NextResponse.json(stats, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return handleRouteError(error, "stats");
  }
}
