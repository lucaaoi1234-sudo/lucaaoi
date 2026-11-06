import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server/auth";
import { getOrCreateSettings, updateSettings } from "@/lib/server/services";
import { assertSameOrigin, handleRouteError, jsonError, parseJsonBody, requireJsonContentType } from "@/lib/server/http";
import { DEFAULT_SETTINGS, settingsSchema } from "@/lib/validation/schemas";

export const runtime = "nodejs";

export async function GET(): Promise<NextResponse> {
  try {
    const user = await getCurrentUser();
    if (!user) return jsonError(401, "Bạn cần đăng nhập để đồng bộ cài đặt");
    const settings = await getOrCreateSettings(user.id, DEFAULT_SETTINGS);
    return NextResponse.json({ settings }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return handleRouteError(error, "settings:get");
  }
}

export async function PUT(req: Request): Promise<NextResponse> {
  const originError = assertSameOrigin(req);
  if (originError) return originError;
  const typeError = requireJsonContentType(req);
  if (typeError) return typeError;

  try {
    const user = await getCurrentUser();
    if (!user) return jsonError(401, "Bạn cần đăng nhập để lưu cài đặt");

    const parsed = await parseJsonBody(req, settingsSchema, 4_096);
    if (!parsed.ok) return parsed.response;

    const settings = await updateSettings(user.id, parsed.data);
    return NextResponse.json({ settings });
  } catch (error) {
    return handleRouteError(error, "settings:update");
  }
}
