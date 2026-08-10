import { hostname } from "node:os";
import { getSqlClient } from "@/db/client";
import { cleanupCampaignCodes, drawCampaign } from "@/server/services/draw";
import { requestCampaignDraw } from "@/server/services/campaigns";
import type { DrawTriggerSource } from "@/db/schema";

type JobRow = {
  id: string;
  type: "DRAW_CAMPAIGN" | "CLEANUP_CAMPAIGN_CODES";
  campaign_id: string;
  draw_trigger_source: DrawTriggerSource | null;
};

export async function lockDueScheduledCampaigns() {
  const sql = getSqlClient();
  const campaigns = await sql<{ id: string }[]>`
    select id
    from campaigns
    where status = 'ACTIVE'
      and draw_trigger = 'SCHEDULED'
      and draw_at <= now()
    order by draw_at
    limit 20
  `;
  for (const campaign of campaigns) {
    await requestCampaignDraw(campaign.id, "AUTO_SCHEDULE");
  }
}

async function claimJob(workerId: string) {
  const sql = getSqlClient();
  return sql.begin(async (transaction) => {
    const [job] = await transaction<JobRow[]>`
      select id, type, campaign_id, draw_trigger_source
      from system_jobs
      where status = 'PENDING' and available_at <= now()
      order by available_at, created_at
      limit 1
      for update skip locked
    `;
    if (!job) return null;
    const [claimed] = await transaction<JobRow[]>`
      update system_jobs
      set status = 'RUNNING', locked_at = now(), locked_by = ${workerId},
        attempts = attempts + 1, updated_at = now()
      where id = ${job.id} and status = 'PENDING'
      returning id, type, campaign_id, draw_trigger_source
    `;
    return claimed ?? null;
  });
}

async function completeJob(jobId: string) {
  await getSqlClient()`
    update system_jobs
    set status = 'SUCCEEDED', locked_at = null, locked_by = null, updated_at = now()
    where id = ${jobId}
  `;
}

async function failJob(jobId: string, message: string) {
  await getSqlClient()`
    update system_jobs
    set status = case when attempts < max_attempts then 'PENDING' else 'FAILED' end,
      available_at = case when attempts < max_attempts then now() + interval '1 minute' else available_at end,
      locked_at = null, locked_by = null, last_error = ${message}, updated_at = now()
    where id = ${jobId}
  `;
}

async function reconcileTerminalDrawJobs() {
  await getSqlClient()`
    update system_jobs
    set status = 'SUCCEEDED', last_error = null, locked_at = null,
      locked_by = null, updated_at = now()
    where type = 'DRAW_CAMPAIGN'
      and status = 'FAILED'
      and exists (
        select 1
        from campaigns
        where campaigns.id = system_jobs.campaign_id
          and campaigns.status in ('COMPLETED', 'ARCHIVED')
      )
  `;
}

export async function processOneSystemJob(workerId = `${hostname()}:worker`) {
  const job = await claimJob(workerId);
  if (!job) return false;

  try {
    if (job.type === "DRAW_CAMPAIGN") {
      const result = await drawCampaign(
        job.campaign_id,
        job.draw_trigger_source ?? "AUTO_TARGET",
      );
      if (result.status === "DRAW_FAILED") {
        await failJob(job.id, "开奖失败，等待管理员处理。");
      } else {
        await completeJob(job.id);
      }
    } else {
      await cleanupCampaignCodes(job.campaign_id);
      await completeJob(job.id);
    }
  } catch (error) {
    const detail = error instanceof Error
      ? `${error.name}: ${error.message}`
      : "unknown error";
    process.stderr.write(`Worker job ${job.id} (${job.type}) failed: ${detail}\n`);
    await failJob(job.id, "系统任务执行失败。");
  }
  return true;
}

export async function processSystemJobs(workerId = `${hostname()}:worker`) {
  await reconcileTerminalDrawJobs();
  await lockDueScheduledCampaigns();
  for (let count = 0; count < 10; count += 1) {
    const processed = await processOneSystemJob(workerId);
    if (!processed) break;
  }
}
