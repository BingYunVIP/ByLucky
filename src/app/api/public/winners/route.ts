import type { NextRequest } from "next/server";
import { apiSuccess } from "@/server/http/api-response";
import { getPublicWinners } from "@/server/services/public";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const page = Number(request.nextUrl.searchParams.get("page") ?? "1");
  return apiSuccess(await getPublicWinners({ page: Number.isFinite(page) ? page : 1 }));
}
