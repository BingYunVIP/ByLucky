import type { NextRequest } from "next/server";
import { z } from "zod";
import { getClientIp } from "@/server/auth/request-context";
import { apiError, apiErrorFromUnknown, apiSuccess } from "@/server/http/api-response";
import { participate } from "@/server/services/participation";

const schema = z.object({
  email: z.string().min(1).max(320),
  // Do not trim or normalize this field: code identity is exact UTF-8 text.
  code: z.string().min(1),
});

export async function handleParticipation(request: NextRequest) {
  const payload = await request.json().catch(() => null);
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    return apiError("INVALID_REQUEST", "请输入邮箱和兑换码。", 400);
  }

  try {
    const result = await participate({
      email: parsed.data.email,
      code: parsed.data.code,
      ipAddress: getClientIp(request),
    });
    return apiSuccess(result);
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
