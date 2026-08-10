import { getServerEnv } from "@/server/env";
import { getCurrentAdminSession } from "@/server/auth/session";
import { apiSuccess } from "@/server/http/api-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getCurrentAdminSession();
  if (!session) {
    return apiSuccess({ authenticated: false });
  }

  return apiSuccess({
    authenticated: true,
    username: getServerEnv().ADMIN_USERNAME,
    expiresAt: session.expiresAt.toISOString(),
  });
}
