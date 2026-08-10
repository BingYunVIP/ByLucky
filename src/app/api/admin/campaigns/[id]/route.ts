import type { NextRequest } from "next/server";
import { requireAdminApiSession } from "@/server/auth/api-authorization";
import { getAdminRequestContext } from "@/server/auth/request-context";
import { apiError, apiErrorFromUnknown, apiSuccess } from "@/server/http/api-response";
import {
  campaignInputSchema,
  deleteDraftCampaign,
  updateDraftCampaign,
} from "@/server/services/campaigns";
import { getCampaignDetailData } from "@/server/services/admin-data";
import { writeAdminOperationLog } from "@/server/operation-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminApiSession(request);
  if ("response" in auth) return auth.response;
  try {
    const page = Number(request.nextUrl.searchParams.get("page") ?? "1");
    const search = request.nextUrl.searchParams.get("search") ?? "";
    return apiSuccess(await getCampaignDetailData((await params).id, Number.isFinite(page) ? page : 1, search));
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminApiSession(request, { write: true });
  if ("response" in auth) return auth.response;
  const payload = await request.json().catch(() => null);
  const parsed = campaignInputSchema.safeParse({ ...(payload ?? {}), action: "DRAFT" });
  if (!parsed.success) return apiError("INVALID_REQUEST", "活动信息填写不完整或格式不正确。", 400);
  try {
    const id = (await params).id;
    const result = await updateDraftCampaign(id, parsed.data);
    await writeAdminOperationLog({
      action: "CAMPAIGN_DRAFT_UPDATED",
      context: getAdminRequestContext(request),
      entityType: "campaign",
      entityId: id,
      metadata: { importedCodeCount: result.importedCodeCount },
    });
    return apiSuccess(result);
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminApiSession(request, { write: true });
  if ("response" in auth) return auth.response;
  try {
    const id = (await params).id;
    await deleteDraftCampaign(id);
    await writeAdminOperationLog({
      action: "CAMPAIGN_DELETED",
      context: getAdminRequestContext(request),
      entityType: "campaign",
      entityId: id,
    });
    return apiSuccess({ deleted: true });
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
