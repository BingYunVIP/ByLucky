import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { hasValidAdminRequestOrigin } from "@/server/auth/origin";
import { getAdminRequestContext } from "@/server/auth/request-context";
import {
  ADMIN_SESSION_COOKIE,
  expiredAdminSessionCookieOptions,
  findAdminSession,
  revokeAdminSession,
} from "@/server/auth/session";
import { apiError, apiSuccess } from "@/server/http/api-response";
import { writeAdminOperationLog } from "@/server/operation-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!hasValidAdminRequestOrigin(request)) {
    return apiError("INVALID_ORIGIN", "请求来源无效。", 403);
  }

  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  if (token) {
    const session = await findAdminSession(token);
    await revokeAdminSession(token);

    if (session) {
      await writeAdminOperationLog({
        action: "ADMIN_LOGOUT",
        context: getAdminRequestContext(request),
        entityType: "admin_session",
        entityId: session.id,
      });
    }
  }

  cookieStore.set(ADMIN_SESSION_COOKIE, "", expiredAdminSessionCookieOptions());
  return apiSuccess({ loggedOut: true });
}
