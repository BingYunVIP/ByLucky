import type { NextRequest } from "next/server";
import { requireAdminApiSession } from "@/server/auth/api-authorization";
import { getAdminRequestContext } from "@/server/auth/request-context";
import { apiError, apiErrorFromUnknown, apiSuccess } from "@/server/http/api-response";
import { writeAdminOperationLog } from "@/server/operation-log";
import { sendSmtpTestEmail, smtpTestInputSchema } from "@/server/services/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const auth = await requireAdminApiSession(request, { write: true });
  if ("response" in auth) return auth.response;
  const payload = await request.json().catch(() => null);
  const parsed = smtpTestInputSchema.safeParse(payload);
  if (!parsed.success) return apiError("INVALID_REQUEST", "请先填写完整 SMTP 配置和测试收件邮箱。", 400);
  try {
    await sendSmtpTestEmail(parsed.data);
    await writeAdminOperationLog({
      action: "SMTP_TEST_SUCCEEDED",
      context: getAdminRequestContext(request),
      entityType: "smtp_config",
      entityId: "1",
      metadata: { host: parsed.data.smtp.host, port: parsed.data.smtp.port },
    });
    return apiSuccess({ sent: true });
  } catch (error) {
    try {
      await writeAdminOperationLog({
        action: "SMTP_TEST_FAILED",
        context: getAdminRequestContext(request),
        entityType: "smtp_config",
        entityId: "1",
        metadata: { host: parsed.data.smtp.host, port: parsed.data.smtp.port },
      });
    } catch {
      // Logging failure must not replace the safe SMTP failure response.
    }
    return apiErrorFromUnknown(error);
  }
}
