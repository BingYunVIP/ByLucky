import type { NextRequest } from "next/server";
import { getServerEnv } from "@/server/env";

export function hasValidAdminRequestOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin) return false;

  try {
    return new URL(origin).origin === new URL(getServerEnv().APP_URL).origin;
  } catch {
    return false;
  }
}
