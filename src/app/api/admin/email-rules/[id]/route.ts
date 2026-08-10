import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdminApiSession } from "@/server/auth/api-authorization";
import { getAdminRequestContext } from "@/server/auth/request-context";
import { apiError, apiErrorFromUnknown, apiSuccess } from "@/server/http/api-response";
import { deleteEmailDomainRule, updateEmailDomainRule } from "@/server/services/settings";
import { writeAdminOperationLog } from "@/server/operation-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const patchSchema = z.object({ enabled: z.boolean() });

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminApiSession(request, { write: true });
  if ("response" in auth) return auth.response;
  const payload = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(payload);
  if (!parsed.success) return apiError("INVALID_REQUEST", "邮箱域名规则格式不正确。", 400);
  try {
    const id = (await params).id;
    const rule = await updateEmailDomainRule(id, parsed.data.enabled);
    await writeAdminOperationLog({
      action: "EMAIL_DOMAIN_RULE_UPDATED",
      context: getAdminRequestContext(request),
      entityType: "email_domain_rule",
      entityId: id,
      metadata: { enabled: parsed.data.enabled },
    });
    return apiSuccess({ rule });
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
    await deleteEmailDomainRule(id);
    await writeAdminOperationLog({
      action: "EMAIL_DOMAIN_RULE_DELETED",
      context: getAdminRequestContext(request),
      entityType: "email_domain_rule",
      entityId: id,
    });
    return apiSuccess({ deleted: true });
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
