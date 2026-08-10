import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { z } from "zod";
import {
  adminSessionCookieOptions,
  ADMIN_SESSION_COOKIE,
  createAdminSession,
} from "@/server/auth/session";
import { hasValidAdminRequestOrigin } from "@/server/auth/origin";
import {
  getAdminRequestContext,
} from "@/server/auth/request-context";
import {
  checkLoginRateLimit,
  clearLoginRateLimit,
  createLoginBucketKey,
  recordLoginFailure,
} from "@/server/auth/rate-limit";
import {
  timingSafeTextEqual,
  verifyAdminPassword,
} from "@/server/auth/password";
import { getServerEnv } from "@/server/env";
import { apiError, apiSuccess } from "@/server/http/api-response";
import { writeAdminOperationLog } from "@/server/operation-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const loginSchema = z.object({
  username: z.string().min(1).max(128),
  password: z.string().min(1).max(1024),
});

export async function POST(request: NextRequest) {
  if (!hasValidAdminRequestOrigin(request)) {
    return apiError("INVALID_ORIGIN", "请求来源无效。", 403);
  }

  const context = getAdminRequestContext(request);
  const bucketKey = createLoginBucketKey(context.ipAddress);
  const rateLimit = await checkLoginRateLimit(bucketKey);
  if (!rateLimit.allowed) {
    await writeAdminOperationLog({
      action: "ADMIN_LOGIN_BLOCKED",
      context,
      metadata: { reason: "RATE_LIMITED" },
    });
    return apiError("RATE_LIMITED", "登录尝试过于频繁，请稍后重试。", 429, {
      "retry-after": String(rateLimit.retryAfterSeconds),
    });
  }

  const payload = await request.json().catch(() => null);
  const parsed = loginSchema.safeParse(payload);
  if (!parsed.success) {
    return apiError("INVALID_REQUEST", "请输入管理员账号和密码。", 400);
  }

  const env = getServerEnv();
  const passwordMatches = await verifyAdminPassword(
    parsed.data.password,
    env.ADMIN_PASSWORD_HASH,
  );
  const usernameMatches = timingSafeTextEqual(parsed.data.username, env.ADMIN_USERNAME);

  if (!passwordMatches || !usernameMatches) {
    await recordLoginFailure(bucketKey);
    await writeAdminOperationLog({
      action: "ADMIN_LOGIN_FAILED",
      context,
      metadata: { reason: "INVALID_CREDENTIALS" },
    });
    return apiError("INVALID_CREDENTIALS", "管理员账号或密码错误。", 401);
  }

  await clearLoginRateLimit(bucketKey);
  const session = await createAdminSession(context);
  (await cookies()).set(
    ADMIN_SESSION_COOKIE,
    session.token,
    adminSessionCookieOptions(session.expiresAt),
  );
  await writeAdminOperationLog({
    action: "ADMIN_LOGIN_SUCCEEDED",
    context,
    entityType: "admin_session",
    entityId: session.id,
  });

  return apiSuccess({ expiresAt: session.expiresAt.toISOString() });
}
