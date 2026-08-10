import type { NextRequest } from "next/server";
import { handleParticipation } from "@/server/http/participation-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  return handleParticipation(request);
}
