import type { NextRequest } from "next/server";
import { requireAdminApiSession } from "@/server/auth/api-authorization";
import { getAdminRequestContext } from "@/server/auth/request-context";
import { apiErrorFromUnknown, apiSuccess } from "@/server/http/api-response";
import { startCampaign } from "@/server/services/campaigns";
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
    const campaign = await startCampaign(id);
    await writeAdminOperationLog({
      action: "CAMPAIGN_STARTED",
      context: getAdminRequestContext(request),
      entityType: "campaign",
      entityId: id,
      metadata: { issueNo: campaign.issue_no },
    });
    return apiSuccess({ campaign });
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
