import "server-only";

import { getSqlClient } from "@/db/client";
import { decryptSensitiveText } from "@/server/crypto/sensitive";
import { getAdminCampaign } from "./campaigns";
type CountRow = { count: number | string };

export const OPERATION_LOG_CATEGORIES = [
  "ALL",
  "AUTH",
  "CAMPAIGN",
  "DRAW",
  "CODES",
  "EMAIL",
  "SETTINGS",
  "BACKGROUND",
] as const;

export type OperationLogCategory = typeof OPERATION_LOG_CATEGORIES[number];

const operationActionsByCategory: Record<Exclude<OperationLogCategory, "ALL" | "BACKGROUND">, string[]> = {
  AUTH: ["ADMIN_LOGIN_SUCCEEDED", "ADMIN_LOGIN_FAILED", "ADMIN_LOGIN_BLOCKED", "ADMIN_LOGOUT"],
  CAMPAIGN: ["CAMPAIGN_CREATED", "CAMPAIGN_DRAFT_UPDATED", "CAMPAIGN_UPDATED", "CAMPAIGN_DELETED", "CAMPAIGN_STARTED", "CAMPAIGN_CANCELED"],
  DRAW: ["CAMPAIGN_DRAW_STARTED", "CAMPAIGN_MANUAL_DRAW_REQUESTED", "CAMPAIGN_DRAW_RETRY_REQUESTED", "CAMPAIGN_DRAW_COMPLETED", "CAMPAIGN_DRAW_FAILED"],
  CODES: ["CAMPAIGN_CODES_IMPORTED", "CAMPAIGN_CODES_CLEANED"],
  EMAIL: ["SMTP_CONFIG_UPDATED", "SMTP_TEST_SUCCEEDED", "SMTP_TEST_FAILED", "EMAIL_TEMPLATE_UPDATED", "EMAIL_JOB_MANUAL_RETRY", "EMAIL_RETRIED"],
  SETTINGS: ["SYSTEM_SETTINGS_UPDATED", "EMAIL_DOMAIN_RULE_CREATED", "EMAIL_DOMAIN_RULE_UPDATED", "EMAIL_DOMAIN_RULE_DELETED"],
};

const categorizedActions = Object.values(operationActionsByCategory).flat();

export function normalizeOperationLogCategory(value?: string): OperationLogCategory {
  return OPERATION_LOG_CATEGORIES.includes(value as OperationLogCategory) ? value as OperationLogCategory : "ALL";
}

const FACE_VALUES = [1, 5, 10, 20, 50, 100] as const;

function toNumber(value: number | string | null | undefined) {
  return typeof value === "number" ? value : Number(value ?? 0);
}

function dateValue(value: Date | string | null) {
  return value ? new Date(value).toISOString() : null;
}

export async function getDashboardData() {
  const sql = getSqlClient();
  const [settingsRows, activeRows, inventoryRows, emailRows, recentRows, heartbeatRows, failedJobs] = await Promise.all([
    sql<Record<string, unknown>[]>`select * from app_settings where id = 1`,
    sql<Record<string, unknown>[]>`
      select campaigns.*, 
        (select count(*) from campaign_participants where campaign_id = campaigns.id)::int as participant_count,
        (select count(*) from used_codes where campaign_id = campaigns.id)::int as used_code_count,
        (select count(*) from campaign_codes where campaign_id = campaigns.id)::int as imported_code_count,
        (select coalesce(sum(total_face_value), 0) from campaign_participants where campaign_id = campaigns.id)::int as total_face_value,
        (select count(*) from prize_items where campaign_id = campaigns.id)::int as prize_item_count,
        (select count(*) from winners where campaign_id = campaigns.id)::int as winner_count
      from campaigns
      where status in ('ACTIVE', 'LOCKED', 'DRAWING')
      order by issue_no desc limit 1
    `,
    sql<{ face_value: number; imported_count: number | string; used_count: number | string }[]>`
      select face_value, count(*)::int as imported_count,
        count(*) filter (where used_at is not null)::int as used_count
      from campaign_codes
      where campaign_id = (
        select id from campaigns
        where status in ('ACTIVE', 'LOCKED', 'DRAWING')
        order by issue_no desc
        limit 1
      )
      group by face_value order by face_value
    `,
    sql<{ status: string; count: number | string }[]>`
      select status, count(*)::int as count from email_jobs group by status
    `,
    sql<Record<string, unknown>[]>`
      select campaigns.issue_no, campaigns.name, campaigns.completed_at,
        (select count(*) from campaign_participants where campaign_id = campaigns.id)::int as participant_count,
        (select count(*) from winners where campaign_id = campaigns.id)::int as winner_count
      from campaigns where status in ('COMPLETED', 'ARCHIVED')
      order by issue_no desc limit 5
    `,
    sql<{ worker_id: string; last_seen_at: Date | string }[]>`
      select worker_id, last_seen_at from worker_heartbeats order by last_seen_at desc limit 1
    `,
    sql<CountRow[]>`
      select count(*) as count from system_jobs where status = 'FAILED'
    `,
  ]);
  const active = activeRows[0] ?? null;
  const heartbeat = heartbeatRows[0] ?? null;
  const heartbeatAt = heartbeat ? new Date(heartbeat.last_seen_at) : null;
  const emailStatus = Object.fromEntries(emailRows.map((row) => [row.status, toNumber(row.count)]));
  return {
    settings: settingsRows[0]
      ? {
          timezone: String(settingsRows[0].timezone),
          defaultTargetUniqueEmails: Number(settingsRows[0].default_target_unique_emails),
          defaultMinCodeFaceValue: Number(settingsRows[0].default_min_code_face_value),
          defaultDrawMethod: String(settingsRows[0].default_draw_method),
          defaultWinnerCooldownPeriods: Number(settingsRows[0].default_winner_cooldown_periods),
          defaultCleanupDelayMinutes: Number(settingsRows[0].default_cleanup_delay_minutes),
          rejectPlusAlias: Boolean(settingsRows[0].reject_plus_alias),
          gmailDotNormalization: Boolean(settingsRows[0].gmail_dot_normalization),
          updatedAt: dateValue(settingsRows[0].updated_at as Date | string),
        }
      : null,
    activeCampaign: active
      ? {
          id: String(active.id),
          issueNo: Number(active.issue_no),
          name: String(active.name),
          status: String(active.status),
          targetUniqueEmails: Number(active.target_unique_emails),
          participantCount: Number(active.participant_count),
          usedCodeCount: Number(active.used_code_count),
          importedCodeCount: Number(active.imported_code_count),
          remainingCodeCount: Math.max(0, Number(active.imported_code_count) - Number(active.used_code_count)),
          remainingParticipantCount: Math.max(0, Number(active.target_unique_emails) - Number(active.participant_count)),
          totalFaceValue: Number(active.total_face_value),
          prizeItemCount: Number(active.prize_item_count),
          winnerCount: Number(active.winner_count),
          drawMethod: String(active.draw_method),
          drawTrigger: String(active.draw_trigger),
          drawAt: dateValue(active.draw_at as Date | string | null),
        }
      : null,
    inventory: FACE_VALUES.map((faceValue) => {
      const row = inventoryRows.find((item) => item.face_value === faceValue);
      const imported = toNumber(row?.imported_count);
      const used = toNumber(row?.used_count);
      return { faceValue, imported, used, remaining: imported - used };
    }),
    emailStatus: {
      pending: emailStatus.PENDING ?? 0,
      sending: emailStatus.SENDING ?? 0,
      sent: emailStatus.SENT ?? 0,
      failed: emailStatus.FAILED ?? 0,
    },
    recentCampaigns: recentRows.map((row) => ({
      issueNo: Number(row.issue_no),
      name: String(row.name),
      participantCount: Number(row.participant_count),
      winnerCount: Number(row.winner_count),
      completedAt: dateValue(row.completed_at as Date | string | null),
    })),
    worker: heartbeat
      ? {
          workerId: heartbeat.worker_id,
          lastSeenAt: new Date(heartbeat.last_seen_at).toISOString(),
          online: Date.now() - heartbeatAt!.getTime() < 45_000,
        }
      : null,
    failedJobCount: toNumber(failedJobs[0]?.count),
  };
}

export async function getCampaignDetailData(campaignId: string, page = 1, participantSearch = "") {
  const campaign = await getAdminCampaign(campaignId);
  const sql = getSqlClient();
  const safePage = Math.max(1, page);
  const offset = (safePage - 1) * 25;
  const participantSearchPattern = `%${participantSearch.trim()}%`;
  const [statsRows, participantCountRows, participantPageCountRows, prizeItemCountRows, prizeTierRows, participants, winners, drawRuns, logs, cooldownRows] = await Promise.all([
    sql<{ face_value: number; imported_count: number | string; used_count: number | string }[]>`
      select face_value, count(*)::int as imported_count,
        count(*) filter (where used_at is not null)::int as used_count
      from campaign_codes where campaign_id = ${campaignId}
      group by face_value order by face_value
    `,
    sql<CountRow[]>`select count(*) as count from campaign_participants where campaign_id = ${campaignId}`,
    sql<CountRow[]>`
      select count(*) as count
      from campaign_participants participants
      where participants.campaign_id = ${campaignId}
        and (${participantSearch.trim() === ""} or participants.original_email ilike ${participantSearchPattern} or participants.canonical_email ilike ${participantSearchPattern})
    `,
    sql<CountRow[]>`select count(*) as count from prize_items where campaign_id = ${campaignId}`,
    sql<{
      id: string;
      name: string;
      public_description: string;
      raw_content_ciphertext: string | null;
      sort_order: number;
      item_count: number | string;
    }[]>`
      select prize_tiers.id, prize_tiers.name, prize_tiers.public_description,
        prize_tiers.raw_content_ciphertext, prize_tiers.sort_order,
        count(prize_items.id)::int as item_count
      from prize_tiers
      left join prize_items on prize_items.prize_tier_id = prize_tiers.id
      where prize_tiers.campaign_id = ${campaignId}
      group by prize_tiers.id
      order by prize_tiers.sort_order
    `,
    sql<Record<string, unknown>[]>`
      with cooldown_emails as (
        select distinct winners.canonical_email_snapshot
        from winners join campaigns previous on previous.id = winners.campaign_id
        where previous.status in ('COMPLETED', 'ARCHIVED')
          and previous.issue_no < ${campaign.issue_no}
        order by winners.canonical_email_snapshot
      )
      select participants.id, participants.original_email, participants.canonical_email,
        participants.code_count, participants.total_face_value,
        participants.first_submitted_at, participants.last_submitted_at,
        exists(select 1 from winners where winners.campaign_id = ${campaignId} and winners.participant_id = participants.id) as is_winner,
        exists(select 1 from cooldown_emails where cooldown_emails.canonical_email_snapshot = participants.canonical_email) as is_cooldown
      from campaign_participants participants
      where participants.campaign_id = ${campaignId}
        and (${participantSearch.trim() === ""} or participants.original_email ilike ${participantSearchPattern} or participants.canonical_email ilike ${participantSearchPattern})
      order by participants.last_submitted_at desc, participants.id
      limit 25 offset ${offset}
    `,
    sql<Record<string, unknown>[]>`
      select winners.id, winners.original_email_snapshot, winners.total_face_value_snapshot,
        winners.code_count_snapshot, winners.won_at,
        prize_tiers.name as prize_name, prize_tiers.public_description,
        prize_items.sequence_no, prize_items.status as prize_item_status
      from winners
      join prize_tiers on prize_tiers.id = winners.prize_tier_id
      join prize_items on prize_items.id = winners.prize_item_id
      where winners.campaign_id = ${campaignId}
      order by prize_tiers.sort_order, prize_items.sequence_no
    `,
    sql<Record<string, unknown>[]>`
      select id, attempt_no, trigger_source, algorithm, status, participant_count,
        eligible_count, used_code_count, prize_item_count, winner_count,
        started_at, completed_at, error_code, error_message
      from draw_runs where campaign_id = ${campaignId} order by attempt_no desc
    `,
    sql<Record<string, unknown>[]>`
      select id, action, actor_type, entity_type, metadata, created_at
      from operation_logs where entity_type = 'campaign' and entity_id = ${campaignId}
      order by created_at desc limit 30
    `,
    sql<{ canonical_email_snapshot: string }[]>`
      with recent_campaigns as (
        select id from campaigns
        where issue_no < ${campaign.issue_no} and status in ('COMPLETED', 'ARCHIVED')
        order by issue_no desc limit ${campaign.winner_cooldown_periods}
      )
      select distinct winners.canonical_email_snapshot
      from winners join recent_campaigns on recent_campaigns.id = winners.campaign_id
    `,
  ]);
  const cooldownEmails = new Set(cooldownRows.map((row) => row.canonical_email_snapshot));
  return {
    campaign,
    stats: {
      participantCount: toNumber(participantCountRows[0]?.count),
      prizeItemCount: toNumber(prizeItemCountRows[0]?.count),
      codeStats: FACE_VALUES.map((faceValue) => {
        const row = statsRows.find((item) => item.face_value === faceValue);
        const imported = toNumber(row?.imported_count);
        const used = toNumber(row?.used_count);
        return { faceValue, imported, used, remaining: imported - used };
      }),
    },
    prizeTiers: prizeTierRows.map((tier) => ({
      id: tier.id,
      name: tier.name,
      publicDescription: tier.public_description,
      itemCount: toNumber(tier.item_count),
      rawContents: tier.raw_content_ciphertext
        ? decryptSensitiveText(tier.raw_content_ciphertext)
        : null,
    })),
    participants: {
      page: safePage,
      pageSize: 25,
      total: toNumber(participantPageCountRows[0]?.count),
      items: participants.map((row) => ({
        id: String(row.id),
        email: String(row.original_email),
        canonicalEmail: String(row.canonical_email),
        codeCount: Number(row.code_count),
        totalFaceValue: Number(row.total_face_value),
        firstSubmittedAt: dateValue(row.first_submitted_at as Date | string),
        lastSubmittedAt: dateValue(row.last_submitted_at as Date | string),
        isWinner: Boolean(row.is_winner),
        isCooldown: cooldownEmails.has(String(row.canonical_email)),
      })),
    },
    winners,
    drawRuns,
    logs,
  };
}

export async function getAdminWinnersData(page = 1, search = "", issueNo?: number, emailStatus?: string) {
  const sql = getSqlClient();
  const safePage = Math.max(1, page);
  const offset = (safePage - 1) * 25;
  const pattern = `%${search.trim()}%`;
  const safeIssueNo: number | null = typeof issueNo === "number" && Number.isInteger(issueNo) && issueNo > 0
    ? issueNo
    : null;
  const status = emailStatus?.trim() || null;
  const [rows, countRows] = await Promise.all([
    sql<Record<string, unknown>[]>`
      select winners.id, campaigns.issue_no, campaigns.name as campaign_name,
        winners.original_email_snapshot, winners.total_face_value_snapshot,
        winners.code_count_snapshot, winners.won_at,
        prize_tiers.name as prize_name, prize_tiers.public_description,
        prize_items.content_ciphertext as prize_content_ciphertext,
        email_jobs.id as email_job_id,
        coalesce(email_jobs.status, 'NOT_CREATED') as email_status,
        email_jobs.sent_at
      from winners
      join campaigns on campaigns.id = winners.campaign_id
      join prize_tiers on prize_tiers.id = winners.prize_tier_id
      join prize_items on prize_items.id = winners.prize_item_id
      left join email_jobs on email_jobs.winner_id = winners.id
      where (${search.trim() === ""} or winners.original_email_snapshot ilike ${pattern}
        or campaigns.name ilike ${pattern} or campaigns.issue_no::text ilike ${pattern})
        and (${safeIssueNo === null} or campaigns.issue_no = ${safeIssueNo})
        and (${status === null} or coalesce(email_jobs.status, 'NOT_CREATED') = ${status})
      order by winners.won_at desc, winners.id
      limit 25 offset ${offset}
    `,
    sql<CountRow[]>`
      select count(*) as count from winners
      join campaigns on campaigns.id = winners.campaign_id
      left join email_jobs on email_jobs.winner_id = winners.id
      where (${search.trim() === ""} or winners.original_email_snapshot ilike ${pattern}
        or campaigns.name ilike ${pattern} or campaigns.issue_no::text ilike ${pattern})
        and (${safeIssueNo === null} or campaigns.issue_no = ${safeIssueNo})
        and (${status === null} or coalesce(email_jobs.status, 'NOT_CREATED') = ${status})
    `,
  ]);
  return {
    page: safePage,
    pageSize: 25,
    total: toNumber(countRows[0]?.count),
    items: rows.map((row) => ({
      ...row,
      prize_content: row.prize_content_ciphertext
        ? decryptSensitiveText(String(row.prize_content_ciphertext))
        : null,
    })),
  };
}

export async function getOperationLogsData(page = 1, search = "", requestedCategory?: string) {
  const sql = getSqlClient();
  const safePage = Math.max(1, page);
  const offset = (safePage - 1) * 30;
  const pattern = `%${search.trim()}%`;
  const category = normalizeOperationLogCategory(requestedCategory);
  const categoryActions = category === "ALL" || category === "BACKGROUND"
    ? ["__NO_ACTION__"]
    : operationActionsByCategory[category];
  const isAll = category === "ALL";
  const isBackground = category === "BACKGROUND";
  const [rows, countRows] = await Promise.all([
    sql<Record<string, unknown>[]>`
      select id, actor_type, action, entity_type, entity_id, metadata, created_at
      from operation_logs
      where (
        ${isAll}
        or (${isBackground} and (actor_type = 'SYSTEM' or action not in ${sql(categorizedActions)}))
        or (${!isAll && !isBackground} and action in ${sql(categoryActions)})
      )
        and (${search.trim() === ""} or action ilike ${pattern} or entity_type ilike ${pattern})
      order by created_at desc limit 30 offset ${offset}
    `,
    sql<CountRow[]>`
      select count(*) as count from operation_logs
      where (
        ${isAll}
        or (${isBackground} and (actor_type = 'SYSTEM' or action not in ${sql(categorizedActions)}))
        or (${!isAll && !isBackground} and action in ${sql(categoryActions)})
      )
        and (${search.trim() === ""} or action ilike ${pattern} or entity_type ilike ${pattern})
    `,
  ]);
  return { page: safePage, pageSize: 30, total: toNumber(countRows[0]?.count), items: rows, category };
}
