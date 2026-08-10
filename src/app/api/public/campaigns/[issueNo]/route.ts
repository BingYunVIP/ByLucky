import type { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/server/http/api-response";
import { getPublicCampaignByIssue } from "@/server/services/public";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ issueNo: string }> },
) {
  const issueNo = Number((await params).issueNo);
  if (!Number.isInteger(issueNo) || issueNo < 1) {
    return apiError("INVALID_ISSUE_NO", "期号无效。", 400);
  }
  const campaign = await getPublicCampaignByIssue(issueNo);
  if (!campaign) return apiError("CAMPAIGN_NOT_FOUND", "该期活动不存在。", 404);
  return apiSuccess({ campaign });
}
