import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdminApiSession } from "@/server/auth/api-authorization";
import { apiError, apiErrorFromUnknown, apiSuccess } from "@/server/http/api-response";
import { previewCodeImport } from "@/server/services/code-import";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({ text: z.string().max(10_000_000) });

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminApiSession(request, { write: true });
  if ("response" in auth) return auth.response;
  const payload = await request.json().catch(() => null);
  const parsed = schema.safeParse(payload);
  if (!parsed.success) return apiError("INVALID_REQUEST", "请输入有效的兑换码文本。", 400);
  try {
    return apiSuccess(await previewCodeImport(parsed.data.text, (await params).id));
  } catch (error) {
    return apiErrorFromUnknown(error);
  }
}
