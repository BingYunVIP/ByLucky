import { NextResponse } from "next/server";
import { isBusinessError, isUniqueViolation } from "@/server/services/errors";

export function apiSuccess<T>(data: T, status = 200) {
  return NextResponse.json({ ok: true as const, data }, { status });
}

export function apiError(
  code: string,
  message: string,
  status: number,
  headers?: HeadersInit,
) {
  return NextResponse.json(
    { ok: false as const, error: { code, message } },
    { status, headers },
  );
}

export function apiErrorFromUnknown(error: unknown, fallback = "操作失败，请稍后重试。") {
  if (isBusinessError(error)) {
    return apiError(error.code, error.message, error.status);
  }
  if (isUniqueViolation(error)) {
    return apiError("CONFLICT", "数据已被其他请求更新，请刷新后重试。", 409);
  }
  return apiError("INTERNAL_ERROR", fallback, 500);
}
