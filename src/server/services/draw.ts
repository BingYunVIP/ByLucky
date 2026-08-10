import "server-only";

import { getSqlClient } from "@/db/client";
import { decryptSensitiveText, encryptSensitiveText } from "@/server/crypto/sensitive";
import { drawByCodeEqual, drawByFaceValuePriority } from "@/server/lottery/algorithms";
import { cryptoRandomSource } from "@/server/lottery/random-source";
import type {
  LotteryParticipant,
  LotteryPrizeItem,
  RandomSource,
} from "@/server/lottery/types";
import type { DrawMethod, DrawTriggerSource } from "@/db/schema";

type SqlClient = ReturnType<typeof getSqlClient>;

type CampaignDrawRow = {
  id: string;
  issue_no: number;
  name: string;
  status: string;
  draw_method: DrawMethod;
  draw_trigger: string;
  winner_cooldown_periods: number;
  cleanup_delay_minutes: number;
  timezone: string;
};

type ParticipantRow = LotteryParticipant;
type CooldownRow = { canonical_email_snapshot: string };
type PrizeRow = LotteryPrizeItem & {
  prizeTierName: string;
  publicDescription: string;
  contentCiphertext: string;
};
type CountRow = { count: number | string };
type RunRow = { id: string };
type TemplateRow = {
  subject_template: string;
  text_template: string;
  html_template: string | null;
};

function jsonb(value: Record<string, unknown>) {
  return JSON.stringify(value);
}

function toNumber(value: number | string) {
  return typeof value === "number" ? value : Number(value);
}

function safeDrawFailure(error: unknown) {
  if (error instanceof Error && error.name === "BusinessError") {
    return { code: "DRAW_BUSINESS_ERROR", message: "开奖业务校验未通过。" };
  }
  return { code: "DRAW_INTERNAL_ERROR", message: "开奖过程中发生内部错误。" };
}

function renderTemplate(template: string, variables: Record<string, string>) {
  return template.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (full, key: string) => variables[key] ?? full);
}

async function getCooldownEmails(
  tx: SqlClient,
  campaign: CampaignDrawRow,
) {
  if (campaign.winner_cooldown_periods <= 0) return new Set<string>();
  const rows = await tx<CooldownRow[]>`
    with recent_campaigns as (
      select id
      from campaigns
      where issue_no < ${campaign.issue_no}
        and status in ('COMPLETED', 'ARCHIVED')
      order by issue_no desc
      limit ${campaign.winner_cooldown_periods}
    )
    select distinct winners.canonical_email_snapshot
    from winners
    join recent_campaigns on recent_campaigns.id = winners.campaign_id
  `;
  return new Set(rows.map((row) => row.canonical_email_snapshot));
}

async function markDrawFailed(
  campaignId: string,
  triggerSource: DrawTriggerSource,
  errorCode: string,
  errorMessage: string,
) {
  const sql = getSqlClient();
  await sql.begin(async (transaction) => {
    const tx = transaction as unknown as SqlClient;
    const [campaign] = await tx<{ id: string; issue_no: number; draw_method: DrawMethod }[]>`
      select id, issue_no, draw_method from campaigns
      where id = ${campaignId} and status in ('LOCKED', 'DRAWING')
      for update
    `;
    if (!campaign) return;
    const [run] = await tx<RunRow[]>`
      insert into draw_runs (
        campaign_id, attempt_no, trigger_source, algorithm, algorithm_version, status,
        participant_count, eligible_count, used_code_count, prize_item_count, winner_count,
        completed_at, error_code, error_message
      ) values (
        ${campaignId},
        (select coalesce(max(attempt_no), 0) + 1 from draw_runs where campaign_id = ${campaignId}),
        ${triggerSource}, ${campaign.draw_method}, 'V1', 'FAILED', 0, 0, 0, 0, 0,
        now(), ${errorCode}, ${errorMessage}
      )
      returning id
    `;
    await tx`
      update campaigns
      set status = 'DRAW_FAILED', updated_at = now()
      where id = ${campaignId}
    `;
    await tx`
      insert into operation_logs (actor_type, action, entity_type, entity_id, metadata)
      values ('SYSTEM', 'CAMPAIGN_DRAW_FAILED', 'campaign', ${campaignId}, ${jsonb({ errorCode, drawRunId: run?.id ?? null })}::jsonb)
    `;
  });
}

export type DrawResult = {
  status: "COMPLETED" | "DRAW_FAILED" | "SKIPPED";
  campaignId: string;
  winnerCount: number;
};

export async function drawCampaign(
  campaignId: string,
  triggerSource: DrawTriggerSource,
  random: RandomSource = cryptoRandomSource,
): Promise<DrawResult> {
  const sql = getSqlClient();
  try {
    return await sql.begin(async (transaction) => {
      const tx = transaction as unknown as SqlClient;
      const [campaign] = await tx<CampaignDrawRow[]>`
        select id, issue_no, name, status, draw_method, draw_trigger,
          winner_cooldown_periods, cleanup_delay_minutes, timezone
        from campaigns where id = ${campaignId} for update
      `;
      if (!campaign) return { status: "SKIPPED" as const, campaignId, winnerCount: 0 };
      if (campaign.status !== "LOCKED") {
        return { status: "SKIPPED" as const, campaignId, winnerCount: 0 };
      }

      const [drawing] = await tx<{ id: string }[]>`
        update campaigns set status = 'DRAWING', updated_at = now()
        where id = ${campaignId} and status = 'LOCKED'
        returning id
      `;
      if (!drawing) return { status: "SKIPPED" as const, campaignId, winnerCount: 0 };

      const [participantCountRow, usedCodeCountRow] = await Promise.all([
        tx<CountRow[]>`select count(*) as count from campaign_participants where campaign_id = ${campaignId}`,
        tx<CountRow[]>`select count(*) as count from used_codes where campaign_id = ${campaignId}`,
      ]);
      const participants = await tx<ParticipantRow[]>`
        select id, original_email as "originalEmail", canonical_email as "canonicalEmail",
          code_count as "codeCount", total_face_value as "totalFaceValue"
        from campaign_participants
        where campaign_id = ${campaignId}
        order by id
      `;
      const cooldownEmails = await getCooldownEmails(tx, campaign);
      const eligibleParticipants = participants.filter(
        (participant) => !cooldownEmails.has(participant.canonicalEmail),
      );
      const prizeItems = await tx<PrizeRow[]>`
        select prize_items.id, prize_items.prize_tier_id as "prizeTierId",
          prize_items.sequence_no as "sequenceNo",
          prize_items.content_ciphertext as "contentCiphertext",
          prize_tiers.name as "prizeTierName",
          prize_tiers.public_description as "publicDescription"
        from prize_items
        join prize_tiers on prize_tiers.id = prize_items.prize_tier_id
        where prize_items.campaign_id = ${campaignId} and prize_items.status = 'AVAILABLE'
        order by prize_tiers.sort_order, prize_items.sequence_no
      `;
      const [run] = await tx<RunRow[]>`
        insert into draw_runs (
          campaign_id, attempt_no, trigger_source, algorithm, algorithm_version, status,
          participant_count, eligible_count, used_code_count, prize_item_count, winner_count
        ) values (
          ${campaignId},
          (select coalesce(max(attempt_no), 0) + 1 from draw_runs where campaign_id = ${campaignId}),
          ${triggerSource}, ${campaign.draw_method}, 'V1', 'RUNNING',
          ${toNumber(participantCountRow[0]?.count ?? 0)}, ${eligibleParticipants.length},
          ${toNumber(usedCodeCountRow[0]?.count ?? 0)}, ${prizeItems.length}, 0
        )
        returning id
      `;
      if (!run) throw new Error("Failed to create draw run");

      if (eligibleParticipants.length === 0) {
        await tx`
          update prize_items
          set status = 'UNAWARDED', unawarded_reason = 'NO_ELIGIBLE_CANDIDATE'
          where campaign_id = ${campaignId} and status = 'AVAILABLE'
        `;
        await tx`
          update draw_runs
          set status = 'FAILED', completed_at = now(), error_code = 'NO_ELIGIBLE_CANDIDATE',
            error_message = '没有符合中奖条件的参与者。'
          where id = ${run.id}
        `;
        await tx`
          update campaigns set status = 'DRAW_FAILED', updated_at = now()
          where id = ${campaignId}
        `;
        await tx`
          insert into operation_logs (actor_type, action, entity_type, entity_id, metadata)
          values ('SYSTEM', 'CAMPAIGN_DRAW_FAILED', 'campaign', ${campaignId}, ${jsonb({
            errorCode: "NO_ELIGIBLE_CANDIDATE",
            drawRunId: run.id,
          })}::jsonb)
        `;
        return { status: "DRAW_FAILED" as const, campaignId, winnerCount: 0 };
      }

      const selections =
        campaign.draw_method === "FACE_VALUE_PRIORITY"
          ? drawByFaceValuePriority(eligibleParticipants, prizeItems, random)
          : drawByCodeEqual(eligibleParticipants, prizeItems, random);
      const [template] = await tx<TemplateRow[]>`
        select subject_template, text_template, html_template
        from email_templates where template_key = 'WINNER_NOTICE' and enabled = true
        limit 1
      `;
      let winnerCount = 0;
      for (const selection of selections) {
        const prizeItem = prizeItems.find((item) => item.id === selection.prizeItemId);
        if (!prizeItem) throw new Error("Prize item disappeared during draw");
        if (!selection.participant) {
          await tx`
            update prize_items set status = 'UNAWARDED', unawarded_reason = 'CANDIDATE_SHORTAGE'
            where id = ${selection.prizeItemId}
          `;
          continue;
        }

        const participant = selection.participant;
        const [winner] = await tx<{ id: string }[]>`
          insert into winners (
            campaign_id, draw_run_id, participant_id, prize_tier_id, prize_item_id,
            original_email_snapshot, canonical_email_snapshot,
            total_face_value_snapshot, code_count_snapshot
          ) values (
            ${campaignId}, ${run.id}, ${participant.id}, ${prizeItem.prizeTierId}, ${prizeItem.id},
            ${participant.originalEmail}, ${participant.canonicalEmail},
            ${participant.totalFaceValue}, ${participant.codeCount}
          ) returning id
        `;
        if (!winner) throw new Error("Failed to save winner");
        await tx`
          update prize_items set status = 'AWARDED' where id = ${prizeItem.id}
        `;

        if (template) {
          const prizeContent = decryptSensitiveText(prizeItem.contentCiphertext);
          const variables = {
            winner_email: participant.originalEmail,
            campaign_name: campaign.name,
            issue_no: String(campaign.issue_no),
            prize_level: prizeItem.prizeTierName,
            prize_public_name: prizeItem.publicDescription,
            prize_content: prizeContent,
            draw_time: new Date().toISOString(),
          };
          await tx`
            insert into email_jobs (
              winner_id, recipient_email, status, rendered_subject,
              rendered_text_ciphertext, rendered_html_ciphertext
            ) values (
              ${winner.id}, ${participant.originalEmail}, 'PENDING',
              ${renderTemplate(template.subject_template, variables)},
              ${encryptSensitiveText(renderTemplate(template.text_template, variables))},
              ${template.html_template ? encryptSensitiveText(renderTemplate(template.html_template, variables)) : null}
            )
          `;
        }
        winnerCount += 1;
      }

      const completedAt = new Date();
      await tx`
        update draw_runs
        set status = 'SUCCEEDED', completed_at = ${completedAt.toISOString()}::timestamptz,
          winner_count = ${winnerCount}
        where id = ${run.id}
      `;
      await tx`
        update campaigns
        set status = 'COMPLETED', completed_at = ${completedAt.toISOString()}::timestamptz,
          updated_at = ${completedAt.toISOString()}::timestamptz
        where id = ${campaignId}
      `;
      await tx`
        insert into system_jobs (type, campaign_id, status, available_at, unique_key)
        values (
          'CLEANUP_CAMPAIGN_CODES', ${campaignId}, 'PENDING',
          ${new Date(completedAt.getTime() + campaign.cleanup_delay_minutes * 60_000).toISOString()}::timestamptz,
          ${`cleanup:${campaignId}`}
        )
        on conflict (unique_key) do nothing
      `;
      await tx`
        insert into operation_logs (actor_type, action, entity_type, entity_id, metadata)
        values ('SYSTEM', 'CAMPAIGN_DRAW_COMPLETED', 'campaign', ${campaignId}, ${jsonb({
          drawRunId: run.id,
          participantCount: participants.length,
          eligibleCount: eligibleParticipants.length,
          winnerCount,
        })}::jsonb)
      `;
      return { status: "COMPLETED" as const, campaignId, winnerCount };
    });
  } catch (error) {
    const failure = safeDrawFailure(error);
    await markDrawFailed(campaignId, triggerSource, failure.code, failure.message);
    return { status: "DRAW_FAILED" as const, campaignId, winnerCount: 0 };
  }
}

export async function retryFailedDraw(campaignId: string) {
  const sql = getSqlClient();
  return sql.begin(async (transaction) => {
    const tx = transaction as unknown as SqlClient;
    const [campaign] = await tx<{ id: string; draw_method: DrawMethod }[]>`
      update campaigns
      set status = 'LOCKED', locked_at = now(), updated_at = now()
      where id = ${campaignId} and status = 'DRAW_FAILED'
      returning id, draw_method
    `;
    if (!campaign) return false;
    await tx`
      update system_jobs
      set status = 'PENDING', available_at = now(), attempts = 0, last_error = null,
        locked_at = null, locked_by = null, updated_at = now(), draw_trigger_source = 'ADMIN_RETRY'
      where unique_key = ${`draw:${campaignId}`}
        and type = 'DRAW_CAMPAIGN'
    `;
    return true;
  });
}

export async function cleanupCampaignCodes(campaignId: string) {
  const sql = getSqlClient();
  return sql.begin(async (transaction) => {
    const tx = transaction as unknown as SqlClient;
    const [campaign] = await tx<{ id: string; status: string }[]>`
      select id, status from campaigns where id = ${campaignId} for update
    `;
    if (!campaign || (campaign.status !== "COMPLETED" && campaign.status !== "ARCHIVED")) {
      return { deletedCount: 0, archived: false };
    }
    const deleted = await tx<{ face_value: number }[]>`
      delete from campaign_codes
      where campaign_id = ${campaignId} and used_at is null
      returning face_value
    `;
    await tx`
      update campaigns set status = 'ARCHIVED', archived_at = coalesce(archived_at, now()), updated_at = now()
      where id = ${campaignId}
    `;
    await tx`
      update system_jobs set status = 'SUCCEEDED', updated_at = now()
      where type = 'CLEANUP_CAMPAIGN_CODES' and campaign_id = ${campaignId} and status in ('PENDING', 'RUNNING')
    `;
    await tx`
      insert into operation_logs (actor_type, action, entity_type, entity_id, metadata)
      values ('SYSTEM', 'CAMPAIGN_CODES_CLEANED', 'campaign', ${campaignId}, ${jsonb({ deletedCount: deleted.length })}::jsonb)
    `;
    return { deletedCount: deleted.length, archived: true };
  });
}
