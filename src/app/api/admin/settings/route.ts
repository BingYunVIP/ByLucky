import type { NextRequest } from "next/server";
import { requireAdminApiSession } from "@/server/auth/api-authorization";
import { getAdminRequestContext } from "@/server/auth/request-context";
import { apiError, apiErrorFromUnknown, apiSuccess } from "@/server/http/api-response";
import { getSettingsData, settingsInputSchema, updateSettings } from "@/server/services/settings";
import { writeAdminOperationLog } from "@/server/operation-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireAdminApiSession(request);
  if ("response" in auth) return auth.response;
  try {
    return apiSuccess({ settings: await getSettingsData() });
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdminApiSession(request, { write: true });
  if ("response" in auth) return auth.response;
  const payload = await request.json().catch(() => null);
  const parsed = settingsInputSchema.safeParse(payload);
  if (!parsed.success) return apiError("INVALID_REQUEST", "系统设置格式不正确。", 400);
  try {
    const settings = await updateSettings(parsed.data);
    await writeAdminOperationLog({
      action: "SYSTEM_SETTINGS_UPDATED",
      context: getAdminRequestContext(request),
      entityType: "app_settings",
      entityId: "1",
      metadata: { timezone: parsed.data.timezone },
    });
    return apiSuccess({ settings });
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
