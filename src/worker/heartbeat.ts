import { getDb } from "@/db/client";
import { workerHeartbeats } from "@/db/schema";

export async function recordHeartbeat(workerId: string, version: string) {
  const now = new Date();
  await getDb()
    .insert(workerHeartbeats)
    .values({ workerId, version, startedAt: now, lastSeenAt: now })
    .onConflictDoUpdate({
      target: workerHeartbeats.workerId,
      set: { version, lastSeenAt: now },
    });
}
