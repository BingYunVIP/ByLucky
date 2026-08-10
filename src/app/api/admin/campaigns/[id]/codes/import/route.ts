import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdminApiSession } from "@/server/auth/api-authorization";
import { getAdminRequestContext } from "@/server/auth/request-context";
import { apiError, apiErrorFromUnknown, apiSuccess } from "@/server/http/api-response";
import { importCodesIntoDraft } from "@/server/services/campaigns";
import { writeAdminOperationLog } from "@/server/operation-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({ text: z.string().max(10_000_000) });

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminApiSession(request, { write: true });
  if ("response" in auth) return auth.response;
  const payload = await request.json().catch(() => null);
  const parsed = schema.safeParse(payload);
  if (!parsed.success) return apiError("INVALID_REQUEST", "请输入有效的兑换码文本。", 400);
  try {
    const id = (await params).id;
    const result = await importCodesIntoDraft(id, parsed.data.text);
    await writeAdminOperationLog({
      action: "CAMPAIGN_CODES_IMPORTED",
      context: getAdminRequestContext(request),
      entityType: "campaign",
      entityId: id,
      metadata: result,
    });
    return apiSuccess(result);
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
