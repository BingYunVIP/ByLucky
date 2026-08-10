import type { NextRequest } from "next/server";
import { requireAdminApiSession } from "@/server/auth/api-authorization";
import { getAdminRequestContext } from "@/server/auth/request-context";
import { apiError, apiErrorFromUnknown, apiSuccess } from "@/server/http/api-response";
import { getSmtpConfig, smtpInputSchema, updateSmtpConfig } from "@/server/services/settings";
import { writeAdminOperationLog } from "@/server/operation-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireAdminApiSession(request);
  if ("response" in auth) return auth.response;
  try {
    return apiSuccess({ smtp: await getSmtpConfig() });
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}

export async function PUT(request: NextRequest) {
  const auth = await requireAdminApiSession(request, { write: true });
  if ("response" in auth) return auth.response;
  const payload = await request.json().catch(() => null);
  const parsed = smtpInputSchema.safeParse(payload);
  if (!parsed.success) return apiError("INVALID_REQUEST", "SMTP 配置格式不正确。", 400);
  try {
    const smtp = await updateSmtpConfig(parsed.data);
    await writeAdminOperationLog({
      action: "SMTP_CONFIG_UPDATED",
      context: getAdminRequestContext(request),
      entityType: "smtp_config",
      entityId: "1",
      metadata: { provider: parsed.data.provider, host: parsed.data.host, port: parsed.data.port },
    });
    return apiSuccess({ smtp });
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
