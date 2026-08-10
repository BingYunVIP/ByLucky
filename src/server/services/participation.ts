import "server-only";

import { getSqlClient } from "@/db/client";
import { hashExactCode } from "@/server/crypto/sensitive";
import { canonicalizeEmail, isEmailDomainAllowed, type EmailDomainRule } from "@/server/email/identity";
import {
  checkParticipationRateLimit,
  createParticipationBucketKey,
  recordParticipationFailure,
} from "@/server/auth/rate-limit";
import { BusinessError } from "./errors";

type SqlClient = ReturnType<typeof getSqlClient>;

type SettingsRow = {
  reject_plus_alias: boolean;
  gmail_dot_normalization: boolean;
};

type CampaignRow = {
  id: string;
  issue_no: number;
  name: string;
  status: string;
  target_unique_emails: number;
  min_code_face_value: number;
  draw_trigger: string;
  draw_at: Date | string | null;
};

type CodeRow = {
  id: string;
  face_value: number;
  used_at: Date | string | null;
};

type ParticipantRow = {
  id: string;
  code_count: number | string;
  total_face_value: number | string;
};

type CountRow = { count: number | string };
type IdRow = { id: string };

function toNumber(value: number | string) {
  return typeof value === "number" ? value : Number(value);
}

function genericCodeError() {
  return new BusinessError(
    "CODE_INVALID_OR_INELIGIBLE",
    "兑换码无效、已使用或不符合当前活动要求。",
    400,
  );
}

async function getEmailValidationConfig() {
  const sql = getSqlClient();
  const [settingsRows, rules] = await Promise.all([
    sql<SettingsRow[]>`
      select reject_plus_alias, gmail_dot_normalization
      from app_settings where id = 1
    `,
    sql<EmailDomainRule[]>`
      select rule_type as "ruleType", value, enabled
      from email_domain_rules
    `,
  ]);
  const settings = settingsRows[0];
  if (!settings) throw new Error("Application settings are not initialized");
  return { settings, rules };
}

export type ParticipateResult = {
  campaign: {
    id: string;
    issueNo: number;
    name: string;
    targetUniqueEmails: number;
  };
  codeCount: number;
  totalFaceValue: number;
  participantCount: number;
  lockedForDraw: boolean;
};

export async function participate(input: {
  email: string;
  code: string;
  ipAddress: string;
}) {
  const { settings, rules } = await getEmailValidationConfig();
  const identity = canonicalizeEmail(input.email, {
    rejectPlusAlias: settings.reject_plus_alias,
    gmailDotNormalization: settings.gmail_dot_normalization,
  });
  if (!isEmailDomainAllowed(identity.domain, rules)) {
    throw new BusinessError("EMAIL_DOMAIN_NOT_ALLOWED", "当前邮箱域名暂不支持。", 400);
  }

  const bucketKey = createParticipationBucketKey(input.ipAddress);
  const rateLimit = await checkParticipationRateLimit(bucketKey);
  if (!rateLimit.allowed) {
    throw new BusinessError("RATE_LIMITED", "请求过于频繁，请稍后再试。", 429);
  }

  const codeHash = hashExactCode(input.code);
  const sql = getSqlClient();
  try {
    const result = await sql.begin(async (transaction) => {
      const tx = transaction as unknown as SqlClient;
      const [campaign] = await tx<CampaignRow[]>`
        select id, issue_no, name, status, target_unique_emails,
          min_code_face_value, draw_trigger, draw_at
        from campaigns
        where status = 'ACTIVE'
        order by issue_no desc
        limit 1
        for update
      `;
      if (!campaign) {
        throw new BusinessError("NO_ACTIVE_CAMPAIGN", "当前暂无进行中的抽奖活动。", 409);
      }

      const now = Date.now();
      if (
        campaign.draw_trigger === "SCHEDULED" &&
        campaign.draw_at &&
        new Date(campaign.draw_at).getTime() <= now
      ) {
        await tx`
          update campaigns set status = 'LOCKED', locked_at = now(), updated_at = now()
          where id = ${campaign.id} and status = 'ACTIVE'
        `;
        await tx`
          insert into system_jobs (type, campaign_id, draw_trigger_source, status, unique_key)
          values ('DRAW_CAMPAIGN', ${campaign.id}, 'AUTO_SCHEDULE', 'PENDING', ${`draw:${campaign.id}`})
          on conflict (unique_key) do nothing
        `;
        return { closed: true as const };
      }

      const [campaignCode] = await tx<CodeRow[]>`
        select id, face_value, used_at
        from campaign_codes
        where campaign_id = ${campaign.id} and code_hash = ${codeHash}
        for update
      `;
      if (
        !campaignCode ||
        campaignCode.used_at !== null ||
        campaignCode.face_value < campaign.min_code_face_value
      ) {
        throw genericCodeError();
      }

      const [participant] = await tx<ParticipantRow[]>`
        insert into campaign_participants (
          campaign_id, original_email, canonical_email, code_count, total_face_value
        ) values (${campaign.id}, ${identity.originalEmail}, ${identity.canonicalEmail}, 0, 0)
        on conflict (campaign_id, canonical_email) do update set last_submitted_at = now()
        returning id, code_count, total_face_value
      `;
      if (!participant) throw new Error("Failed to create participant");

      const [claimed] = await tx<IdRow[]>`
        insert into used_codes (code_hash, face_value, campaign_id, participant_id)
        values (${codeHash}, ${campaignCode.face_value}, ${campaign.id}, ${participant.id})
        on conflict (code_hash) do nothing
        returning code_hash as id
      `;
      if (!claimed) throw genericCodeError();

      const [updatedCode] = await tx<IdRow[]>`
        update campaign_codes
        set used_at = now(), used_by_participant_id = ${participant.id}
        where id = ${campaignCode.id} and used_at is null
        returning id
      `;
      if (!updatedCode) throw genericCodeError();

      const [updatedParticipant] = await tx<ParticipantRow[]>`
        update campaign_participants
        set code_count = code_count + 1,
            total_face_value = total_face_value + ${campaignCode.face_value},
            last_submitted_at = now()
        where id = ${participant.id}
        returning id, code_count, total_face_value
      `;
      if (!updatedParticipant) throw new Error("Failed to update participant");

      const [participantCountRow] = await tx<CountRow[]>`
        select count(*) as count from campaign_participants where campaign_id = ${campaign.id}
      `;
      const participantCount = toNumber(participantCountRow?.count ?? 0);
      let lockedForDraw = false;
      if (
        campaign.draw_trigger === "PARTICIPANT_TARGET" &&
        participantCount >= campaign.target_unique_emails
      ) {
        const [locked] = await tx<IdRow[]>`
          update campaigns
          set status = 'LOCKED', locked_at = now(), updated_at = now()
          where id = ${campaign.id} and status = 'ACTIVE'
          returning id
        `;
        if (locked) {
          lockedForDraw = true;
          await tx`
            insert into system_jobs (type, campaign_id, draw_trigger_source, status, unique_key)
            values ('DRAW_CAMPAIGN', ${campaign.id}, 'AUTO_TARGET', 'PENDING', ${`draw:${campaign.id}`})
            on conflict (unique_key) do nothing
          `;
        }
      }

      return {
        closed: false as const,
        campaign,
        participant: updatedParticipant,
        participantCount,
        lockedForDraw,
      };
    });

    if (result.closed) {
      throw new BusinessError("CAMPAIGN_CLOSED", "本期已停止接受参与。", 409);
    }
    return {
      campaign: {
        id: result.campaign.id,
        issueNo: result.campaign.issue_no,
        name: result.campaign.name,
        targetUniqueEmails: result.campaign.target_unique_emails,
      },
      codeCount: toNumber(result.participant.code_count),
      totalFaceValue: toNumber(result.participant.total_face_value),
      participantCount: result.participantCount,
      lockedForDraw: result.lockedForDraw,
    } satisfies ParticipateResult;
  } catch (error) {
    if (error instanceof BusinessError && error.code === "CODE_INVALID_OR_INELIGIBLE") {
      await recordParticipationFailure(bucketKey);
    }
    throw error;
  }
}
