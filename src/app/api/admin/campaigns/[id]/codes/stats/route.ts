import type { NextRequest } from "next/server";
import { requireAdminApiSession } from "@/server/auth/api-authorization";
import { apiErrorFromUnknown, apiSuccess } from "@/server/http/api-response";
import { getCampaignCodeStats } from "@/server/services/campaigns";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminApiSession(request);
  if ("response" in auth) return auth.response;
  try {
    return apiSuccess({ stats: await getCampaignCodeStats((await params).id) });
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
