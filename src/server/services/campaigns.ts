import "server-only";

import { z } from "zod";
import {
  DRAW_METHODS,
  DRAW_TRIGGERS,
  FACE_VALUES,
  type DrawTriggerSource,
  type FaceValue,
} from "@/db/schema";
import { getSqlClient } from "@/db/client";
import { decryptSensitiveText, encryptSensitiveText } from "@/server/crypto/sensitive";
import { prepareCodeImport, type PreparedCampaignCode } from "./code-import";
import { BusinessError } from "./errors";

const pageSize = 25;

const prizeTierInputSchema = z.object({
  name: z.string().trim().min(1, "奖项名称不能为空。").max(80),
  publicDescription: z.string().trim().min(1, "公开展示名称不能为空。").max(300),
  rawContents: z.string().max(1_000_000),
});

export const campaignInputSchema = z.object({
  name: z.string().trim().min(1, "活动名称不能为空。").max(160),
  targetUniqueEmails: z.number().int().min(1).max(1_000_000),
  minCodeFaceValue: z.union(FACE_VALUES.map((value) => z.literal(value)) as [z.ZodLiteral<1>, z.ZodLiteral<5>, z.ZodLiteral<10>, z.ZodLiteral<20>, z.ZodLiteral<50>, z.ZodLiteral<100>]),
  drawMethod: z.enum(DRAW_METHODS),
  drawTrigger: z.enum(DRAW_TRIGGERS),
  drawAt: z.string().datetime().nullable().optional(),
  // The public create flow now takes these two values from app_settings. They
  // remain accepted for API and test compatibility, and stay per-campaign snapshots.
  winnerCooldownPeriods: z.number().int().min(0).max(1000).optional(),
  cleanupDelayMinutes: z.number().int().min(0).max(525_600).optional(),
  timezone: z.string().trim().min(1).max(80),
  prizeTiers: z.array(prizeTierInputSchema).min(1).max(30),
  codesText: z.string().max(10_000_000).default(""),
  action: z.enum(["DRAFT", "START"]).default("DRAFT"),
});

export type CampaignInput = z.infer<typeof campaignInputSchema>;

type SqlClient = ReturnType<typeof getSqlClient>;

type CampaignRow = {
  id: string;
  issue_no: number;
  name: string;
  status: string;
  target_unique_emails: number;
  min_code_face_value: number;
  draw_method: string;
  draw_trigger: string;
  draw_at: Date | string | null;
  winner_cooldown_periods: number;
  cleanup_delay_minutes: number;
  timezone: string;
  started_at: Date | string | null;
  locked_at: Date | string | null;
  completed_at: Date | string | null;
  created_at: Date | string;
};

type IdRow = { id: string };
type HashRow = { hash_key: string };
type CountRow = { count: number | string };

type NormalizedPrizeTier = {
  name: string;
  publicDescription: string;
  rawContents: string;
  items: string[];
};

function toNumber(value: number | string) {
  return typeof value === "number" ? value : Number(value);
}

function normalizePrizeTiers(input: CampaignInput["prizeTiers"]): NormalizedPrizeTier[] {
  return input.map((tier) => ({
    name: tier.name.trim(),
    publicDescription: tier.publicDescription.trim(),
    rawContents: tier.rawContents,
    items: tier.rawContents
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0),
  }));
}

function validateCampaignShape(input: CampaignInput, prizeTiers: NormalizedPrizeTier[]) {
  if (input.drawTrigger === "SCHEDULED" && !input.drawAt) {
    throw new BusinessError("INVALID_DRAW_TIME", "请选择指定开奖时间。", 400);
  }
  if (input.drawAt && Number.isNaN(new Date(input.drawAt).getTime())) {
    throw new BusinessError("INVALID_DRAW_TIME", "开奖时间无效。", 400);
  }
  if (input.action === "START") {
    if (input.drawTrigger === "SCHEDULED" && new Date(input.drawAt!).getTime() <= Date.now()) {
      throw new BusinessError("INVALID_DRAW_TIME", "指定开奖时间必须晚于当前时间。", 400);
    }
    if (!prizeTiers.some((tier) => tier.items.length > 0)) {
      throw new BusinessError("NO_PRIZE_ITEM", "至少需要一个中奖名额。", 400);
    }
  }
}

function hashRows(entries: PreparedCampaignCode[]) {
  return entries.map((entry) => entry.codeHash);
}

async function lockCodeImportHashes(tx: SqlClient, entries: PreparedCampaignCode[]) {
  if (entries.length === 0) return;
  const rows = entries.map((entry) => [entry.hashKey]);
  await tx`
    select pg_advisory_xact_lock(hashtextextended(input.hash_key, 0))
    from (values ${tx(rows)}) as input(hash_key)
  `;
}

async function findUsedHashKeys(tx: SqlClient, entries: PreparedCampaignCode[]) {
  const rows = await tx<HashRow[]>`
    select encode(code_hash, 'hex') as hash_key
    from used_codes
    where code_hash in ${tx(hashRows(entries))}
  `;
  return new Set(rows.map((row) => row.hash_key));
}

async function findOtherCampaignHashKeys(
  tx: SqlClient,
  entries: PreparedCampaignCode[],
  ownCampaignId?: string,
) {
  const rows = ownCampaignId
    ? await tx<HashRow[]>`
        select distinct encode(campaign_codes.code_hash, 'hex') as hash_key
        from campaign_codes
        join campaigns on campaigns.id = campaign_codes.campaign_id
        where campaign_codes.code_hash in ${tx(hashRows(entries))}
          and campaign_codes.used_at is null
          and campaign_codes.campaign_id <> ${ownCampaignId}
          and campaigns.status not in ('ARCHIVED', 'CANCELED')
      `
    : await tx<HashRow[]>`
        select distinct encode(campaign_codes.code_hash, 'hex') as hash_key
        from campaign_codes
        join campaigns on campaigns.id = campaign_codes.campaign_id
        where campaign_codes.code_hash in ${tx(hashRows(entries))}
          and campaign_codes.used_at is null
          and campaigns.status not in ('ARCHIVED', 'CANCELED')
      `;
  return new Set(rows.map((row) => row.hash_key));
}

async function insertCampaignCodes(
  tx: SqlClient,
  campaignId: string,
  entries: PreparedCampaignCode[],
) {
  for (let index = 0; index < entries.length; index += 1_000) {
    const rows = entries.slice(index, index + 1_000).map((entry) => ({
      campaign_id: campaignId,
      code_hash: entry.codeHash,
      face_value: entry.faceValue,
    }));
    if (rows.length > 0) {
      await tx`
        insert into campaign_codes ${tx(rows, ["campaign_id", "code_hash", "face_value"])}
      `;
    }
  }
}

async function insertPrizeTree(
  tx: SqlClient,
  campaignId: string,
  prizeTiers: NormalizedPrizeTier[],
) {
  for (const [sortOrder, tier] of prizeTiers.entries()) {
    const [createdTier] = await tx<IdRow[]>`
      insert into prize_tiers (
        campaign_id,
        name,
        public_description,
        raw_content_ciphertext,
        sort_order
      ) values (
        ${campaignId},
        ${tier.name},
        ${tier.publicDescription},
        ${encryptSensitiveText(tier.rawContents)},
        ${sortOrder}
      )
      returning id
    `;
    if (!createdTier) throw new Error("Failed to create prize tier");

    const rows = tier.items.map((content, index) => ({
      prize_tier_id: createdTier.id,
      campaign_id: campaignId,
      sequence_no: index + 1,
      content_ciphertext: encryptSensitiveText(content),
    }));
    if (rows.length > 0) {
      await tx`
        insert into prize_items ${tx(rows, [
          "prize_tier_id",
          "campaign_id",
          "sequence_no",
          "content_ciphertext",
        ])}
      `;
    }
  }
}

async function validateAndPrepareCodes(
  tx: SqlClient,
  entries: PreparedCampaignCode[],
  ownCampaignId?: string,
) {
  if (entries.length === 0) return [];
  await lockCodeImportHashes(tx, entries);
  const [usedHashKeys, occupiedHashKeys] = await Promise.all([
    findUsedHashKeys(tx, entries),
    findOtherCampaignHashKeys(tx, entries, ownCampaignId),
  ]);
  if (usedHashKeys.size > 0) {
    throw new BusinessError(
      "CODE_ALREADY_USED",
      "部分兑换码已经在历史活动中使用，不能再次导入。",
      409,
    );
  }
  if (occupiedHashKeys.size > 0) {
    throw new BusinessError(
      "CODE_ASSIGNED_TO_OTHER_CAMPAIGN",
      "部分兑换码正在被其他未归档活动占用。",
      409,
    );
  }
  return entries;
}

async function assertDraftStartable(tx: SqlClient, campaignId: string, campaign: CampaignRow) {
  const [prizeItemCount, codeCount] = await Promise.all([
    tx<CountRow[]>`select count(*) as count from prize_items where campaign_id = ${campaignId}`,
    tx<CountRow[]>`select count(*) as count from campaign_codes where campaign_id = ${campaignId}`,
  ]);
  if (toNumber(prizeItemCount[0]?.count ?? 0) === 0) {
    throw new BusinessError("NO_PRIZE_ITEM", "至少需要一个中奖名额。", 400);
  }
  if (toNumber(codeCount[0]?.count ?? 0) === 0) {
    throw new BusinessError("NO_CAMPAIGN_CODE", "至少需要一张可用核实兑换码。", 400);
  }
  if (
    campaign.draw_trigger === "SCHEDULED" &&
    (!campaign.draw_at || new Date(campaign.draw_at).getTime() <= Date.now())
  ) {
    throw new BusinessError("INVALID_DRAW_TIME", "指定开奖时间必须晚于当前时间。", 400);
  }
}

function campaignValues(
  input: CampaignInput,
  globalRules: { winnerCooldownPeriods: number; cleanupDelayMinutes: number },
) {
  return {
    name: input.name.trim(),
    targetUniqueEmails: input.targetUniqueEmails,
    minCodeFaceValue: input.minCodeFaceValue,
    drawMethod: input.drawMethod,
    drawTrigger: input.drawTrigger,
    drawAt: input.drawAt ? new Date(input.drawAt).toISOString() : null,
    winnerCooldownPeriods: input.winnerCooldownPeriods ?? globalRules.winnerCooldownPeriods,
    cleanupDelayMinutes: input.cleanupDelayMinutes ?? globalRules.cleanupDelayMinutes,
    timezone: input.timezone.trim(),
  };
}

export async function getCampaignEditorDefaults() {
  const sql = getSqlClient();
  const [settingsRows, issueRows] = await Promise.all([
    sql<{
      timezone: string;
      default_target_unique_emails: number;
      default_min_code_face_value: number;
      default_draw_method: string;
      default_winner_cooldown_periods: number;
      default_cleanup_delay_minutes: number;
    }[]>`
      select timezone, default_target_unique_emails, default_min_code_face_value,
        default_draw_method, default_winner_cooldown_periods, default_cleanup_delay_minutes
      from app_settings where id = 1
    `,
    sql<{ next_issue_no: number | string }[]>`
      select coalesce(max(issue_no), 0) + 1 as next_issue_no from campaigns
    `,
  ]);
  const settings = settingsRows[0];
  if (!settings) throw new Error("Application settings are not initialized");
  return {
    nextIssueNo: toNumber(issueRows[0]?.next_issue_no ?? 1),
    timezone: settings.timezone,
    targetUniqueEmails: settings.default_target_unique_emails,
    minCodeFaceValue: settings.default_min_code_face_value as FaceValue,
    drawMethod: settings.default_draw_method,
    winnerCooldownPeriods: settings.default_winner_cooldown_periods,
    cleanupDelayMinutes: settings.default_cleanup_delay_minutes,
  };
}

type DraftPrizeTierRow = {
  id: string;
  name: string;
  public_description: string;
  raw_content_ciphertext: string | null;
  sort_order: number;
};

type DraftPrizeItemRow = {
  prize_tier_id: string;
  content_ciphertext: string;
  sequence_no: number;
};

export async function getDraftCampaignEditorData(campaignId: string) {
  const campaign = await getAdminCampaign(campaignId);
  if (campaign.status !== "DRAFT") {
    throw new BusinessError("INVALID_CAMPAIGN_STATE", "只有草稿活动可以编辑。", 409);
  }

  const sql = getSqlClient();
  const [tiers, items, countRows] = await Promise.all([
    sql<DraftPrizeTierRow[]>`
      select id, name, public_description, raw_content_ciphertext, sort_order
      from prize_tiers where campaign_id = ${campaignId}
      order by sort_order
    `,
    sql<DraftPrizeItemRow[]>`
      select prize_tier_id, content_ciphertext, sequence_no
      from prize_items where campaign_id = ${campaignId}
      order by prize_tier_id, sequence_no
    `,
    sql<CountRow[]>`select count(*) as count from campaign_codes where campaign_id = ${campaignId}`,
  ]);

  return {
    id: campaign.id,
    issueNo: campaign.issue_no,
    name: campaign.name,
    targetUniqueEmails: campaign.target_unique_emails,
    minCodeFaceValue: campaign.min_code_face_value,
    drawMethod: campaign.draw_method,
    drawTrigger: campaign.draw_trigger,
    drawAt: campaign.draw_at ? new Date(campaign.draw_at).toISOString() : null,
    winnerCooldownPeriods: campaign.winner_cooldown_periods,
    cleanupDelayMinutes: campaign.cleanup_delay_minutes,
    timezone: campaign.timezone,
    importedCodeCount: toNumber(countRows[0]?.count ?? 0),
    prizeTiers: tiers.map((tier) => {
      const fallbackContents = items
        .filter((item) => item.prize_tier_id === tier.id)
        .map((item) => decryptSensitiveText(item.content_ciphertext))
        .join("\n");
      return {
        id: tier.id,
        name: tier.name,
        publicDescription: tier.public_description,
        rawContents: tier.raw_content_ciphertext
          ? decryptSensitiveText(tier.raw_content_ciphertext)
          : fallbackContents,
      };
    }),
  };
}

export async function createCampaign(input: CampaignInput) {
  const prizeTiers = normalizePrizeTiers(input.prizeTiers);
  validateCampaignShape(input, prizeTiers);
  const preparedCodes = prepareCodeImport(input.codesText);
  if (preparedCodes.parseIssues.length > 0) {
    throw new BusinessError("INVALID_CODE_IMPORT", "兑换码文本存在格式或重复错误。", 400);
  }
  const sql = getSqlClient();

  return sql.begin(async (transaction) => {
    const tx = transaction as unknown as SqlClient;
    const [settings] = await tx<{
      default_winner_cooldown_periods: number;
      default_cleanup_delay_minutes: number;
    }[]>`
      select default_winner_cooldown_periods, default_cleanup_delay_minutes
      from app_settings where id = 1
    `;
    if (!settings) throw new Error("Application settings are not initialized");
    const values = campaignValues(input, {
      winnerCooldownPeriods: settings.default_winner_cooldown_periods,
      cleanupDelayMinutes: settings.default_cleanup_delay_minutes,
    });
    const importableCodes = await validateAndPrepareCodes(tx, preparedCodes.entries);
    if (input.action === "START" && importableCodes.length === 0) {
      throw new BusinessError("NO_CAMPAIGN_CODE", "至少需要一张未使用的核实兑换码。", 400);
    }
    const [campaign] = await tx<CampaignRow[]>`
      insert into campaigns (
        name, status, target_unique_emails, min_code_face_value, draw_method,
        draw_trigger, draw_at, winner_cooldown_periods, cleanup_delay_minutes, timezone
      ) values (
        ${values.name}, 'DRAFT', ${values.targetUniqueEmails}, ${values.minCodeFaceValue}, ${values.drawMethod},
        ${values.drawTrigger}, ${values.drawAt}::timestamptz, ${values.winnerCooldownPeriods}, ${values.cleanupDelayMinutes}, ${values.timezone}
      )
      returning id, issue_no, name, status, target_unique_emails, min_code_face_value,
        draw_method, draw_trigger, draw_at, winner_cooldown_periods, cleanup_delay_minutes,
        timezone, started_at, locked_at, completed_at, created_at
    `;
    if (!campaign) throw new Error("Failed to create campaign");

    await insertPrizeTree(tx, campaign.id, prizeTiers);
    await insertCampaignCodes(tx, campaign.id, importableCodes);

    if (input.action === "START") {
      await assertDraftStartable(tx, campaign.id, campaign);
      const [started] = await tx<CampaignRow[]>`
        update campaigns
        set status = 'ACTIVE', started_at = now(), updated_at = now()
        where id = ${campaign.id} and status = 'DRAFT'
        returning id, issue_no, name, status, target_unique_emails, min_code_face_value,
          draw_method, draw_trigger, draw_at, winner_cooldown_periods, cleanup_delay_minutes,
          timezone, started_at, locked_at, completed_at, created_at
      `;
      if (!started) throw new BusinessError("INVALID_CAMPAIGN_STATE", "活动状态已变化。", 409);
      return { campaign: started, importedCodeCount: importableCodes.length, skippedUsedCodeCount: preparedCodes.entries.length - importableCodes.length };
    }

    return { campaign, importedCodeCount: importableCodes.length, skippedUsedCodeCount: preparedCodes.entries.length - importableCodes.length };
  });
}

export async function updateDraftCampaign(campaignId: string, input: CampaignInput) {
  const prizeTiers = normalizePrizeTiers(input.prizeTiers);
  validateCampaignShape({ ...input, action: "DRAFT" }, prizeTiers);
  const shouldReplaceCodes = input.codesText.length > 0;
  const preparedCodes = shouldReplaceCodes ? prepareCodeImport(input.codesText) : null;
  if (preparedCodes && preparedCodes.parseIssues.length > 0) {
    throw new BusinessError("INVALID_CODE_IMPORT", "兑换码文本存在格式或重复错误。", 400);
  }
  const sql = getSqlClient();

  return sql.begin(async (transaction) => {
    const tx = transaction as unknown as SqlClient;
    const [existing] = await tx<CampaignRow[]>`
      select id, issue_no, name, status, target_unique_emails, min_code_face_value,
        draw_method, draw_trigger, draw_at, winner_cooldown_periods, cleanup_delay_minutes,
        timezone, started_at, locked_at, completed_at, created_at
      from campaigns where id = ${campaignId} for update
    `;
    if (!existing) throw new BusinessError("CAMPAIGN_NOT_FOUND", "活动不存在。", 404);
    if (existing.status !== "DRAFT") {
      throw new BusinessError("INVALID_CAMPAIGN_STATE", "只有草稿活动可以编辑。", 409);
    }
    const values = campaignValues(input, {
      winnerCooldownPeriods: existing.winner_cooldown_periods,
      cleanupDelayMinutes: existing.cleanup_delay_minutes,
    });

    const importableCodes = preparedCodes
      ? await validateAndPrepareCodes(tx, preparedCodes.entries, campaignId)
      : null;
    if (importableCodes) {
      await tx`delete from campaign_codes where campaign_id = ${campaignId}`;
    }
    await tx`delete from prize_tiers where campaign_id = ${campaignId}`;
    const [campaign] = await tx<CampaignRow[]>`
      update campaigns set
        name = ${values.name},
        target_unique_emails = ${values.targetUniqueEmails},
        min_code_face_value = ${values.minCodeFaceValue},
        draw_method = ${values.drawMethod},
        draw_trigger = ${values.drawTrigger},
        draw_at = ${values.drawAt}::timestamptz,
        winner_cooldown_periods = ${values.winnerCooldownPeriods},
        cleanup_delay_minutes = ${values.cleanupDelayMinutes},
        timezone = ${values.timezone},
        updated_at = now()
      where id = ${campaignId}
      returning id, issue_no, name, status, target_unique_emails, min_code_face_value,
        draw_method, draw_trigger, draw_at, winner_cooldown_periods, cleanup_delay_minutes,
        timezone, started_at, locked_at, completed_at, created_at
    `;
    if (!campaign) throw new Error("Failed to update campaign");
    await insertPrizeTree(tx, campaignId, prizeTiers);
    if (importableCodes) {
      await insertCampaignCodes(tx, campaignId, importableCodes);
    }

    return {
      campaign,
      importedCodeCount: importableCodes?.length ?? 0,
      skippedUsedCodeCount: preparedCodes ? preparedCodes.entries.length - (importableCodes?.length ?? 0) : 0,
    };
  });
}

export async function importCodesIntoDraft(campaignId: string, text: string) {
  const prepared = prepareCodeImport(text);
  if (prepared.parseIssues.length > 0) {
    throw new BusinessError("INVALID_CODE_IMPORT", "兑换码文本存在格式或重复错误。", 400);
  }
  const sql = getSqlClient();
  return sql.begin(async (transaction) => {
    const tx = transaction as unknown as SqlClient;
    const [campaign] = await tx<{ id: string; status: string }[]>`
      select id, status from campaigns where id = ${campaignId} for update
    `;
    if (!campaign) throw new BusinessError("CAMPAIGN_NOT_FOUND", "活动不存在。", 404);
    if (campaign.status !== "DRAFT") {
      throw new BusinessError("INVALID_CAMPAIGN_STATE", "只有草稿活动可以导入兑换码。", 409);
    }
    const entries = await validateAndPrepareCodes(tx, prepared.entries, campaignId);
    const existingRows = entries.length === 0
      ? []
      : await tx<HashRow[]>`
          select encode(code_hash, 'hex') as hash_key
          from campaign_codes
          where campaign_id = ${campaignId} and code_hash in ${tx(hashRows(entries))}
        `;
    if (existingRows.length > 0) {
      throw new BusinessError("CODE_ALREADY_IN_CAMPAIGN", "部分兑换码已经导入本期活动。", 409);
    }
    await insertCampaignCodes(tx, campaignId, entries);
    return {
      importedCodeCount: entries.length,
      skippedUsedCodeCount: prepared.entries.length - entries.length,
    };
  });
}

export async function getCampaignCodeStats(campaignId: string) {
  const sql = getSqlClient();
  return sql<{ face_value: number; imported_count: number | string; used_count: number | string }[]>`
    select face_value, count(*)::int as imported_count,
      count(*) filter (where used_at is not null)::int as used_count
    from campaign_codes where campaign_id = ${campaignId}
    group by face_value order by face_value
  `;
}

export async function startCampaign(campaignId: string) {
  const sql = getSqlClient();
  return sql.begin(async (transaction) => {
    const tx = transaction as unknown as SqlClient;
    const [campaign] = await tx<CampaignRow[]>`
      select id, issue_no, name, status, target_unique_emails, min_code_face_value,
        draw_method, draw_trigger, draw_at, winner_cooldown_periods, cleanup_delay_minutes,
        timezone, started_at, locked_at, completed_at, created_at
      from campaigns where id = ${campaignId} for update
    `;
    if (!campaign) throw new BusinessError("CAMPAIGN_NOT_FOUND", "活动不存在。", 404);
    if (campaign.status !== "DRAFT") {
      throw new BusinessError("INVALID_CAMPAIGN_STATE", "只有草稿活动可以启动。", 409);
    }
    await assertDraftStartable(tx, campaignId, campaign);
    const [started] = await tx<CampaignRow[]>`
      update campaigns
      set status = 'ACTIVE', started_at = now(), updated_at = now()
      where id = ${campaignId} and status = 'DRAFT'
      returning id, issue_no, name, status, target_unique_emails, min_code_face_value,
        draw_method, draw_trigger, draw_at, winner_cooldown_periods, cleanup_delay_minutes,
        timezone, started_at, locked_at, completed_at, created_at
    `;
    if (!started) throw new BusinessError("INVALID_CAMPAIGN_STATE", "活动状态已变化。", 409);
    return started;
  });
}

export async function requestCampaignDraw(
  campaignId: string,
  source: DrawTriggerSource = "ADMIN_MANUAL",
) {
  const sql = getSqlClient();
  return sql.begin(async (transaction) => {
    const tx = transaction as unknown as SqlClient;
    const [locked] = await tx<CampaignRow[]>`
      update campaigns
      set status = 'LOCKED', locked_at = now(), updated_at = now()
      where id = ${campaignId} and status = 'ACTIVE'
      returning id, issue_no, name, status, target_unique_emails, min_code_face_value,
        draw_method, draw_trigger, draw_at, winner_cooldown_periods, cleanup_delay_minutes,
        timezone, started_at, locked_at, completed_at, created_at
    `;
    if (!locked) return { locked: false as const, campaign: null };
    await tx`
      insert into system_jobs (type, campaign_id, draw_trigger_source, status, unique_key)
      values ('DRAW_CAMPAIGN', ${campaignId}, ${source}, 'PENDING', ${`draw:${campaignId}`})
      on conflict (unique_key) do nothing
    `;
    return { locked: true as const, campaign: locked };
  });
}

export async function cancelCampaign(campaignId: string) {
  const sql = getSqlClient();
  return sql.begin(async (transaction) => {
    const tx = transaction as unknown as SqlClient;
    const [campaign] = await tx<CampaignRow[]>`
      select id, issue_no, name, status, target_unique_emails, min_code_face_value,
        draw_method, draw_trigger, draw_at, winner_cooldown_periods, cleanup_delay_minutes,
        timezone, started_at, locked_at, completed_at, created_at
      from campaigns where id = ${campaignId} for update
    `;
    if (!campaign) throw new BusinessError("CAMPAIGN_NOT_FOUND", "活动不存在。", 404);
    if (campaign.status !== "DRAFT" && campaign.status !== "ACTIVE") {
      throw new BusinessError("INVALID_CAMPAIGN_STATE", "当前状态不能取消活动。", 409);
    }
    if (campaign.status === "ACTIVE") {
      const rows = await tx<CountRow[]>`
        select count(*) as count from campaign_participants where campaign_id = ${campaignId}
      `;
      if (toNumber(rows[0]?.count ?? 0) > 0) {
        throw new BusinessError("CAMPAIGN_HAS_PARTICIPANTS", "已有参与者的活动不能取消。", 409);
      }
    }
    const [canceled] = await tx<CampaignRow[]>`
      update campaigns set status = 'CANCELED', updated_at = now()
      where id = ${campaignId}
      returning id, issue_no, name, status, target_unique_emails, min_code_face_value,
        draw_method, draw_trigger, draw_at, winner_cooldown_periods, cleanup_delay_minutes,
        timezone, started_at, locked_at, completed_at, created_at
    `;
    if (!canceled) throw new Error("Failed to cancel campaign");
    return canceled;
  });
}

export async function deleteDraftCampaign(campaignId: string) {
  const sql = getSqlClient();
  const rows = await sql<IdRow[]>`
    delete from campaigns where id = ${campaignId} and status = 'DRAFT' returning id
  `;
  if (!rows[0]) {
    throw new BusinessError("INVALID_CAMPAIGN_STATE", "只有草稿活动可以删除。", 409);
  }
}

export async function listAdminCampaigns(status?: string) {
  const sql = getSqlClient();
  return status
    ? sql<(CampaignRow & { participant_count: number | string; used_code_count: number | string; total_face_value: number | string })[]>`
        select campaigns.*, 
          (select count(*) from campaign_participants where campaign_id = campaigns.id) as participant_count,
          (select count(*) from used_codes where campaign_id = campaigns.id) as used_code_count,
          (select coalesce(sum(total_face_value), 0) from campaign_participants where campaign_id = campaigns.id) as total_face_value
        from campaigns where status = ${status}
        order by issue_no desc
      `
    : sql<(CampaignRow & { participant_count: number | string; used_code_count: number | string; total_face_value: number | string })[]>`
        select campaigns.*, 
          (select count(*) from campaign_participants where campaign_id = campaigns.id) as participant_count,
          (select count(*) from used_codes where campaign_id = campaigns.id) as used_code_count,
          (select coalesce(sum(total_face_value), 0) from campaign_participants where campaign_id = campaigns.id) as total_face_value
        from campaigns order by issue_no desc
      `;
}

export async function getAdminCampaign(campaignId: string) {
  const sql = getSqlClient();
  const [campaign] = await sql<CampaignRow[]>`
    select id, issue_no, name, status, target_unique_emails, min_code_face_value,
      draw_method, draw_trigger, draw_at, winner_cooldown_periods, cleanup_delay_minutes,
      timezone, started_at, locked_at, completed_at, created_at
    from campaigns where id = ${campaignId}
  `;
  if (!campaign) throw new BusinessError("CAMPAIGN_NOT_FOUND", "活动不存在。", 404);
  return campaign;
}

export const ADMIN_PARTICIPANT_PAGE_SIZE = pageSize;
