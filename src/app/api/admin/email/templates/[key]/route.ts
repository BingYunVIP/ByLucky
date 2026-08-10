import type { NextRequest } from "next/server";
import { requireAdminApiSession } from "@/server/auth/api-authorization";
import { getAdminRequestContext } from "@/server/auth/request-context";
import { apiError, apiErrorFromUnknown, apiSuccess } from "@/server/http/api-response";
import {
  emailTemplateInputSchema,
  updateEmailTemplate,
} from "@/server/services/settings";
import { writeAdminOperationLog } from "@/server/operation-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> },
) {
  const auth = await requireAdminApiSession(request, { write: true });
  if ("response" in auth) return auth.response;
  const payload = await request.json().catch(() => null);
  const parsed = emailTemplateInputSchema.safeParse(payload);
  if (!parsed.success) return apiError("INVALID_REQUEST", "邮件模板格式不正确。", 400);
  try {
    const key = (await params).key;
    const template = await updateEmailTemplate(key, parsed.data);
    await writeAdminOperationLog({
      action: "EMAIL_TEMPLATE_UPDATED",
      context: getAdminRequestContext(request),
      entityType: "email_template",
      entityId: key,
      metadata: { templateKey: key },
    });
    return apiSuccess({ template });
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
