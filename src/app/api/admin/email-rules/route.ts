import type { NextRequest } from "next/server";
import { requireAdminApiSession } from "@/server/auth/api-authorization";
import { getAdminRequestContext } from "@/server/auth/request-context";
import { apiError, apiErrorFromUnknown, apiSuccess } from "@/server/http/api-response";
import {
  createEmailDomainRule,
  domainRuleInputSchema,
  listEmailDomainRules,
} from "@/server/services/settings";
import { writeAdminOperationLog } from "@/server/operation-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireAdminApiSession(request);
  if ("response" in auth) return auth.response;
  try {
    return apiSuccess({ rules: await listEmailDomainRules() });
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminApiSession(request, { write: true });
  if ("response" in auth) return auth.response;
  const payload = await request.json().catch(() => null);
  const parsed = domainRuleInputSchema.safeParse(payload);
  if (!parsed.success) return apiError("INVALID_REQUEST", "邮箱域名规则格式不正确。", 400);
  try {
    const rule = await createEmailDomainRule(parsed.data);
    await writeAdminOperationLog({
      action: "EMAIL_DOMAIN_RULE_CREATED",
      context: getAdminRequestContext(request),
      entityType: "email_domain_rule",
      entityId: String(rule?.id),
      metadata: { ruleType: parsed.data.ruleType, value: parsed.data.value },
    });
    return apiSuccess({ rule }, 201);
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
