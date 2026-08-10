import type { NextRequest } from "next/server";
import { requireAdminApiSession } from "@/server/auth/api-authorization";
import { getAdminRequestContext } from "@/server/auth/request-context";
import { apiError, apiErrorFromUnknown, apiSuccess } from "@/server/http/api-response";
import { requestCampaignDraw } from "@/server/services/campaigns";
import { writeAdminOperationLog } from "@/server/operation-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminApiSession(request, { write: true });
  if ("response" in auth) return auth.response;
  try {
    const id = (await params).id;
    const result = await requestCampaignDraw(id, "ADMIN_MANUAL");
    if (!result.locked) return apiError("DRAW_ALREADY_RUNNING", "活动已经停止接受参与或正在开奖。", 409);
    await writeAdminOperationLog({
      action: "CAMPAIGN_MANUAL_DRAW_REQUESTED",
      context: getAdminRequestContext(request),
      entityType: "campaign",
      entityId: id,
    });
    return apiSuccess({ locked: true, campaign: result.campaign });
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
