import type { NextRequest } from "next/server";
import { requireAdminApiSession } from "@/server/auth/api-authorization";
import { getAdminRequestContext } from "@/server/auth/request-context";
import { apiError, apiErrorFromUnknown, apiSuccess } from "@/server/http/api-response";
import { retryFailedDraw } from "@/server/services/draw";
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
    const retried = await retryFailedDraw(id);
    if (!retried) return apiError("INVALID_CAMPAIGN_STATE", "当前活动不能重试开奖。", 409);
    await writeAdminOperationLog({
      action: "CAMPAIGN_DRAW_RETRY_REQUESTED",
      context: getAdminRequestContext(request),
      entityType: "campaign",
      entityId: id,
    });
    return apiSuccess({ queued: true });
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
