import { apiSuccess } from "@/server/http/api-response";
import { getPublicCampaign } from "@/server/services/public";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return apiSuccess({ campaign: await getPublicCampaign() });
}
