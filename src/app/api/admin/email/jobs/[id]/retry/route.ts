import type { NextRequest } from "next/server";
import { requireAdminApiSession } from "@/server/auth/api-authorization";
import { getAdminRequestContext } from "@/server/auth/request-context";
import { apiErrorFromUnknown, apiSuccess } from "@/server/http/api-response";
import { retryEmailJob } from "@/server/services/settings";
import { writeAdminOperationLog } from "@/server/operation-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminApiSession(request, { write: true });
  if ("response" in auth) return auth.response;
  try {
    const id = (await params).id;
    const job = await retryEmailJob(id);
    await writeAdminOperationLog({
      action: "EMAIL_JOB_MANUAL_RETRY",
      context: getAdminRequestContext(request),
      entityType: "email_job",
      entityId: id,
    });
    return apiSuccess({ job });
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
