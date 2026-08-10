import { hostname } from "node:os";
import { closeDatabase } from "@/db/client";
import { recordHeartbeat } from "./heartbeat";
import { processSystemJobs } from "./system-jobs";

const HEARTBEAT_INTERVAL_MS = 15_000;
const workerId = `${hostname()}:${process.pid}`;
const version = process.env.npm_package_version ?? "0.1.0";
let stopping = false;

function wait(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function run() {
  process.stdout.write(`ByLucky worker started (${workerId}).\n`);

  while (!stopping) {
    try {
      await recordHeartbeat(workerId, version);
      await processSystemJobs(workerId);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown database error";
      process.stderr.write(`Worker heartbeat failed: ${message}\n`);
    }

    await wait(HEARTBEAT_INTERVAL_MS);
  }
}

async function shutdown() {
  if (stopping) return;
  stopping = true;
  await closeDatabase();
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

run()
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Unknown worker error";
    process.stderr.write(`Worker stopped unexpectedly: ${message}\n`);
    process.exitCode = 1;
  })
  .finally(closeDatabase);
