import type { NextRequest } from "next/server";
import { requireAdminApiSession } from "@/server/auth/api-authorization";
import { apiErrorFromUnknown, apiSuccess } from "@/server/http/api-response";
import { getOperationLogsData } from "@/server/services/admin-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireAdminApiSession(request);
  if ("response" in auth) return auth.response;
  try {
    const page = Number(request.nextUrl.searchParams.get("page") ?? "1");
    const search = request.nextUrl.searchParams.get("search") ?? "";
    const category = request.nextUrl.searchParams.get("category") ?? undefined;
    return apiSuccess(await getOperationLogsData(Number.isFinite(page) ? page : 1, search, category));
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
