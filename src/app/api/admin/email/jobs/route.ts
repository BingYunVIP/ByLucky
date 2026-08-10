import type { NextRequest } from "next/server";
import { requireAdminApiSession } from "@/server/auth/api-authorization";
import { apiErrorFromUnknown, apiSuccess } from "@/server/http/api-response";
import { listEmailJobs } from "@/server/services/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireAdminApiSession(request);
  if ("response" in auth) return auth.response;
  try {
    const page = Number(request.nextUrl.searchParams.get("page") ?? "1");
    return apiSuccess(await listEmailJobs(Number.isFinite(page) ? page : 1));
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
