import { NextResponse } from "next/server";
import { getLeaderboard } from "@/lib/server/services";
import { handleRouteError, jsonError } from "@/lib/server/http";
import { leaderboardQuerySchema } from "@/lib/validation/schemas";

export const runtime = "nodejs";

/** Bảng xếp hạng công khai theo chế độ và thời lượng (chỉ người dùng đã đăng nhập mới có mặt). */
export async function GET(req: Request): Promise<NextResponse> {
  const url = new URL(req.url);
  const parsed = leaderboardQuerySchema.safeParse({
    mode: url.searchParams.get("mode") ?? undefined,
    durationSec: url.searchParams.get("durationSec") ?? undefined,
  });
  if (!parsed.success) return jsonError(400, "Tham số bảng xếp hạng không hợp lệ");

  try {
    const { mode, durationSec } = parsed.data;
    const entries = await getLeaderboard(mode, durationSec === "all" ? null : durationSec);
    return NextResponse.json(
      { mode, durationSec: durationSec === "all" ? null : durationSec, entries },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return handleRouteError(error, "leaderboard");
  }
}
