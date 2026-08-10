import { getDb } from "@/db/client";
import { operationLogs } from "@/db/schema";
import type { AdminRequestContext } from "@/server/auth/request-context";

export async function writeAdminOperationLog(input: {
  action: string;
  context: AdminRequestContext;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
}) {
  await getDb().insert(operationLogs).values({
    actorType: "ADMIN",
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    ipHash: input.context.ipHash,
    userAgent: input.context.userAgent,
    metadata: input.metadata ?? {},
  });
}
