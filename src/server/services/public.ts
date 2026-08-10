import "server-only";

import { getSqlClient } from "@/db/client";

type SqlClient = ReturnType<typeof getSqlClient>;

type PublicCampaignRow = {
  id: string;
  issue_no: number;
  name: string;
  status: "ACTIVE" | "LOCKED" | "DRAWING";
  target_unique_emails: number;
  draw_trigger: string;
  draw_at: Date | string | null;
  timezone: string;
  participant_count: number | string;
};

type PrizeRow = {
  id: string;
  name: string;
  public_description: string;
  sort_order: number;
  quantity: number | string;
};

type WinnerRow = {
  id: string;
  issue_no: number;
  campaign_name: string;
  prize_name: string;
  public_description: string;
  original_email_snapshot: string;
  won_at: Date | string;
};

type RecentCampaignRow = {
  issue_no: number;
  name: string;
  participant_count: number | string;
  winner_count: number | string;
  completed_at: Date | string | null;
};

function toNumber(value: number | string) {
  return typeof value === "number" ? value : Number(value);
}

export function maskEmail(email: string) {
  const atIndex = email.lastIndexOf("@");
  if (atIndex <= 0) return "***";
  const local = email.slice(0, atIndex);
  const domain = email.slice(atIndex + 1);
  if (!domain) return "***";

  const prefix = local.slice(0, Math.min(2, local.length));
  const suffix = local.length > 2 ? local.slice(-Math.min(2, local.length - 2)) : "";
  return `${prefix}***${suffix}@${domain}`;
}

async function getPrizeRows(sql: SqlClient, campaignId: string) {
  return sql<PrizeRow[]>`
    select prize_tiers.id, prize_tiers.name, prize_tiers.public_description,
      prize_tiers.sort_order,
      count(prize_items.id)::int as quantity
    from prize_tiers
    left join prize_items on prize_items.prize_tier_id = prize_tiers.id
    where prize_tiers.campaign_id = ${campaignId}
    group by prize_tiers.id
    order by prize_tiers.sort_order
  `;
}

export async function getPublicCampaign() {
  const sql = getSqlClient();
  const [campaign] = await sql<PublicCampaignRow[]>`
    select campaigns.id, campaigns.issue_no, campaigns.name, campaigns.status,
      campaigns.target_unique_emails, campaigns.draw_trigger, campaigns.draw_at,
      campaigns.timezone,
      (select count(*) from campaign_participants where campaign_id = campaigns.id)::int as participant_count
    from campaigns
    where campaigns.status in ('ACTIVE', 'LOCKED', 'DRAWING')
    order by campaigns.issue_no desc
    limit 1
  `;
  if (!campaign) return null;
  const prizes = await getPrizeRows(sql, campaign.id);
  return {
    id: campaign.id,
    issueNo: campaign.issue_no,
    name: campaign.name,
    status: campaign.status,
    targetUniqueEmails: campaign.target_unique_emails,
    currentUniqueEmails: toNumber(campaign.participant_count),
    drawTrigger: campaign.draw_trigger,
    drawAt: campaign.draw_at ? new Date(campaign.draw_at).toISOString() : null,
    timezone: campaign.timezone,
    prizes: prizes.map((prize) => ({
      id: prize.id,
      name: prize.name,
      publicDescription: prize.public_description,
      quantity: toNumber(prize.quantity),
    })),
  };
}

export async function getPublicWinners(input: { page?: number; pageSize?: number } = {}) {
  const page = Math.max(1, input.page ?? 1);
  const limit = Math.min(50, Math.max(1, input.pageSize ?? 20));
  const offset = (page - 1) * limit;
  const sql = getSqlClient();
  const [rows, countRows] = await Promise.all([
    sql<WinnerRow[]>`
      select winners.id, campaigns.issue_no, campaigns.name as campaign_name,
        prize_tiers.name as prize_name, prize_tiers.public_description,
        winners.original_email_snapshot, winners.won_at
      from winners
      join campaigns on campaigns.id = winners.campaign_id
      join prize_tiers on prize_tiers.id = winners.prize_tier_id
      where campaigns.status in ('COMPLETED', 'ARCHIVED')
      order by campaigns.issue_no desc, winners.won_at, winners.id
      limit ${limit} offset ${offset}
    `,
    sql<{ count: number | string }[]>`
      select count(*) as count
      from winners join campaigns on campaigns.id = winners.campaign_id
      where campaigns.status in ('COMPLETED', 'ARCHIVED')
    `,
  ]);
  return {
    page,
    pageSize: limit,
    total: toNumber(countRows[0]?.count ?? 0),
    items: rows.map((row) => ({
      id: row.id,
      issueNo: row.issue_no,
      campaignName: row.campaign_name,
      prizeName: row.prize_name,
      publicDescription: row.public_description,
      maskedEmail: maskEmail(row.original_email_snapshot),
      wonAt: new Date(row.won_at).toISOString(),
    })),
  };
}

export async function getPublicRecentCampaigns(input: { limit?: number } = {}) {
  const limit = Math.min(5, Math.max(1, input.limit ?? 5));
  const sql = getSqlClient();
  const rows = await sql<RecentCampaignRow[]>`
    select campaigns.issue_no, campaigns.name,
      (select count(*) from campaign_participants where campaign_id = campaigns.id)::int as participant_count,
      (select count(*) from winners where campaign_id = campaigns.id)::int as winner_count,
      campaigns.completed_at
    from campaigns
    where campaigns.status in ('COMPLETED', 'ARCHIVED')
    order by campaigns.issue_no desc
    limit ${limit}
  `;
  return rows.map((row) => ({
    issueNo: row.issue_no,
    name: row.name,
    participantCount: toNumber(row.participant_count),
    winnerCount: toNumber(row.winner_count),
    completedAt: row.completed_at ? new Date(row.completed_at).toISOString() : null,
  }));
}

export async function getPublicCampaignByIssue(issueNo: number) {
  const sql = getSqlClient();
  const [campaign] = await sql<PublicCampaignRow[]>`
    select campaigns.id, campaigns.issue_no, campaigns.name, campaigns.status,
      campaigns.target_unique_emails, campaigns.draw_trigger, campaigns.draw_at,
      campaigns.timezone,
      (select count(*) from campaign_participants where campaign_id = campaigns.id)::int as participant_count
    from campaigns where issue_no = ${issueNo}
      and status in ('COMPLETED', 'ARCHIVED', 'LOCKED', 'DRAWING')
  `;
  if (!campaign) return null;
  const prizes = await getPrizeRows(sql, campaign.id);
  const winners = await sql<WinnerRow[]>`
    select winners.id, campaigns.issue_no, campaigns.name as campaign_name,
      prize_tiers.name as prize_name, prize_tiers.public_description,
      winners.original_email_snapshot, winners.won_at
    from winners
    join campaigns on campaigns.id = winners.campaign_id
    join prize_tiers on prize_tiers.id = winners.prize_tier_id
    where winners.campaign_id = ${campaign.id}
    order by prize_tiers.sort_order, winners.won_at
  `;
  return {
    id: campaign.id,
    issueNo: campaign.issue_no,
    name: campaign.name,
    status: campaign.status,
    targetUniqueEmails: campaign.target_unique_emails,
    currentUniqueEmails: toNumber(campaign.participant_count),
    drawAt: campaign.draw_at ? new Date(campaign.draw_at).toISOString() : null,
    timezone: campaign.timezone,
    prizes: prizes.map((prize) => ({
      id: prize.id,
      name: prize.name,
      publicDescription: prize.public_description,
      quantity: toNumber(prize.quantity),
    })),
    winners: winners.map((winner) => ({
      id: winner.id,
      prizeName: winner.prize_name,
      publicDescription: winner.public_description,
      maskedEmail: maskEmail(winner.original_email_snapshot),
      wonAt: new Date(winner.won_at).toISOString(),
    })),
  };
}
