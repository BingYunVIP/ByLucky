import type { NextRequest } from "next/server";
import { requireAdminApiSession } from "@/server/auth/api-authorization";
import { apiErrorFromUnknown, apiSuccess } from "@/server/http/api-response";
import { getAdminWinnersData } from "@/server/services/admin-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireAdminApiSession(request);
  if ("response" in auth) return auth.response;
  try {
    const page = Number(request.nextUrl.searchParams.get("page") ?? "1");
    const search = request.nextUrl.searchParams.get("search") ?? "";
    const issueNo = Number(request.nextUrl.searchParams.get("issue") ?? "");
    const emailStatus = request.nextUrl.searchParams.get("emailStatus") ?? undefined;
    return apiSuccess(await getAdminWinnersData(Number.isFinite(page) ? page : 1, search, Number.isFinite(issueNo) ? issueNo : undefined, emailStatus));
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
