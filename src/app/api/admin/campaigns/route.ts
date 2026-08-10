import type { NextRequest } from "next/server";
import { requireAdminApiSession } from "@/server/auth/api-authorization";
import { getAdminRequestContext } from "@/server/auth/request-context";
import { apiError, apiErrorFromUnknown, apiSuccess } from "@/server/http/api-response";
import {
  campaignInputSchema,
  createCampaign,
  listAdminCampaigns,
} from "@/server/services/campaigns";
import { writeAdminOperationLog } from "@/server/operation-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireAdminApiSession(request);
  if ("response" in auth) return auth.response;
  try {
    const status = request.nextUrl.searchParams.get("status") ?? undefined;
    return apiSuccess({ campaigns: await listAdminCampaigns(status) });
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminApiSession(request, { write: true });
  if ("response" in auth) return auth.response;
  const payload = await request.json().catch(() => null);
  const parsed = campaignInputSchema.safeParse(payload);
  if (!parsed.success) return apiError("INVALID_REQUEST", "活动信息填写不完整或格式不正确。", 400);
  try {
    const result = await createCampaign(parsed.data);
    const context = getAdminRequestContext(request);
    await writeAdminOperationLog({
      action: "CAMPAIGN_CREATED",
      context,
      entityType: "campaign",
      entityId: result.campaign.id,
      metadata: {
        issueNo: result.campaign.issue_no,
        action: parsed.data.action,
        importedCodeCount: result.importedCodeCount,
        skippedUsedCodeCount: result.skippedUsedCodeCount,
        prizeTierCount: parsed.data.prizeTiers.length,
      },
    });
    if (parsed.data.action === "START") {
      await writeAdminOperationLog({
        action: "CAMPAIGN_STARTED",
        context,
        entityType: "campaign",
        entityId: result.campaign.id,
        metadata: { issueNo: result.campaign.issue_no },
      });
    }
    return apiSuccess(result, 201);
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
