import { requireAdminApiSession } from "@/server/auth/api-authorization";
import type { NextRequest } from "next/server";
import { apiErrorFromUnknown, apiSuccess } from "@/server/http/api-response";
import { getDashboardData } from "@/server/services/admin-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireAdminApiSession(request);
  if ("response" in auth) return auth.response;
  try {
    return apiSuccess(await getDashboardData());
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
