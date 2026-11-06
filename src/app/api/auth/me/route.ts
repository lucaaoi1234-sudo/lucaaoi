import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server/auth";
import { handleRouteError } from "@/lib/server/http";

export const runtime = "nodejs";

export async function GET(): Promise<NextResponse> {
  try {
    const user = await getCurrentUser();
    return NextResponse.json({ user }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return handleRouteError(error, "auth/me");
  }
}
