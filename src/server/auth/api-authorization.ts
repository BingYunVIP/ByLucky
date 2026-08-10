import type { NextRequest } from "next/server";
import { hasValidAdminRequestOrigin } from "@/server/auth/origin";
import { getCurrentAdminSession } from "@/server/auth/session";
import { apiError } from "@/server/http/api-response";

export async function requireAdminApiSession(
  request: NextRequest,
  options: { write?: boolean } = {},
) {
  if (options.write && !hasValidAdminRequestOrigin(request)) {
    return { response: apiError("INVALID_ORIGIN", "请求来源无效。", 403) } as const;
  }
  const session = await getCurrentAdminSession();
  if (!session) {
    return { response: apiError("UNAUTHENTICATED", "请先登录管理员账号。", 401) } as const;
  }
  return { session } as const;
}
