import { createHmac } from "node:crypto";
import type { NextRequest } from "next/server";
import { getServerEnv } from "@/server/env";

export type AdminRequestContext = {
  ipAddress: string;
  ipHash: Buffer;
  userAgent: string | null;
};

function firstHeaderValue(value: string | null) {
  return value?.split(",", 1)[0]?.trim() || null;
}

export function getClientIp(request: NextRequest) {
  return (
    firstHeaderValue(request.headers.get("cf-connecting-ip")) ??
    firstHeaderValue(request.headers.get("x-real-ip")) ??
    firstHeaderValue(request.headers.get("x-forwarded-for")) ??
    "unknown"
  ).slice(0, 128);
}

export function hashClientIp(ipAddress: string) {
  return createHmac("sha256", getServerEnv().SESSION_SECRET)
    .update("admin-ip:", "utf8")
    .update(ipAddress, "utf8")
    .digest();
}

export function getAdminRequestContext(request: NextRequest): AdminRequestContext {
  const ipAddress = getClientIp(request);
  return {
    ipAddress,
    ipHash: hashClientIp(ipAddress),
    userAgent: request.headers.get("user-agent")?.slice(0, 512) ?? null,
  };
}
