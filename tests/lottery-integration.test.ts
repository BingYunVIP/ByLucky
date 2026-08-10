import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { closeDatabase, getSqlClient } from "@/db/client";
import type { CampaignInput } from "@/server/services/campaigns";
import {
  createCampaign,
  requestCampaignDraw,
} from "@/server/services/campaigns";
import { cleanupCampaignCodes, drawCampaign } from "@/server/services/draw";
import { participate } from "@/server/services/participation";

const runPrefix = `vitest-core-${randomUUID()}`;
let scenarioNumber = 0;

function scenarioName(label: string) {
  scenarioNumber += 1;
  return `${runPrefix}-${scenarioNumber}-${label}`;
}

function codeText(groups: Array<[1 | 5 | 10 | 20 | 50 | 100, string[]]>) {
  return groups
    .map(([faceValue, codes]) => `# ${faceValue}元\n${codes.join("\n")}`)
    .join("\n\n");
}

function campaignInput(options: {
  name: string;
  codes: Array<[1 | 5 | 10 | 20 | 50 | 100, string[]]>;
  target?: number;
  trigger?: CampaignInput["drawTrigger"];
  method?: CampaignInput["drawMethod"];
  prizes?: string[];
  cooldown?: number;
  cleanupDelayMinutes?: number;
}): CampaignInput {
  const prizes = options.prizes ?? ["TEST-PRIZE"];
  return {
    name: options.name,
    targetUniqueEmails: options.target ?? 99,
    minCodeFaceValue: 1,
    drawMethod: options.method ?? "FACE_VALUE_PRIORITY",
    drawTrigger: options.trigger ?? "MANUAL_ONLY",
    drawAt: null,
    winnerCooldownPeriods: options.cooldown ?? 3,
    cleanupDelayMinutes: options.cleanupDelayMinutes ?? 60,
    timezone: "Asia/Shanghai",
    prizeTiers: [
      {
        name: "一等奖",
        publicDescription: "测试公开奖品",
        rawContents: prizes.join("\n"),
      },
    ],
    codesText: codeText(options.codes),
    action: "START",
  };
}

function testIp(label: string) {
  return `${runPrefix}-${label}`;
}

async function startCampaign(options: Parameters<typeof campaignInput>[0]) {
  const result = await createCampaign(campaignInput(options));
  return result.campaign;
}

async function participantRow(campaignId: string, canonicalEmail: string) {
  const [row] = await getSqlClient()<{
    code_count: number;
    total_face_value: number;
  }[]>`
    select code_count, total_face_value
    from campaign_participants
    where campaign_id = ${campaignId} and canonical_email = ${canonicalEmail}
  `;
  return row;
}

async function countRows(table: "campaign_participants" | "campaign_codes" | "used_codes" | "winners" | "draw_runs" | "system_jobs", campaignId: string) {
  const sql = getSqlClient();
  const rows =
    table === "campaign_participants"
      ? await sql<{ count: number | string }[]>`select count(*) as count from campaign_participants where campaign_id = ${campaignId}`
      : table === "campaign_codes"
        ? await sql<{ count: number | string }[]>`select count(*) as count from campaign_codes where campaign_id = ${campaignId}`
        : table === "used_codes"
          ? await sql<{ count: number | string }[]>`select count(*) as count from used_codes where campaign_id = ${campaignId}`
          : table === "winners"
            ? await sql<{ count: number | string }[]>`select count(*) as count from winners where campaign_id = ${campaignId}`
            : table === "draw_runs"
              ? await sql<{ count: number | string }[]>`select count(*) as count from draw_runs where campaign_id = ${campaignId}`
              : await sql<{ count: number | string }[]>`select count(*) as count from system_jobs where campaign_id = ${campaignId}`;
  const row = rows[0];
  return Number(row?.count ?? 0);
}

async function winnerEmails(campaignId: string) {
  const rows = await getSqlClient()<{ canonical_email_snapshot: string }[]>`
    select canonical_email_snapshot
    from winners
    where campaign_id = ${campaignId}
    order by won_at, id
  `;
  return rows.map((row) => row.canonical_email_snapshot);
}

async function completeDraw(campaignId: string, source: "ADMIN_MANUAL" | "AUTO_TARGET" = "ADMIN_MANUAL") {
  const requested = await requestCampaignDraw(campaignId, source);
  expect(requested.locked).toBe(true);
  return drawCampaign(campaignId, source);
}

async function cleanupTestData() {
  const sql = getSqlClient();
  const pattern = `${runPrefix}%`;
  await sql`
    delete from email_jobs
    where winner_id in (
      select id from winners
      where campaign_id in (select id from campaigns where name like ${pattern})
    )
  `;
  await sql`delete from winners where campaign_id in (select id from campaigns where name like ${pattern})`;
  await sql`delete from system_jobs where campaign_id in (select id from campaigns where name like ${pattern})`;
  await sql`delete from used_codes where campaign_id in (select id from campaigns where name like ${pattern})`;
  await sql`delete from draw_runs where campaign_id in (select id from campaigns where name like ${pattern})`;
  await sql`delete from operation_logs where entity_type = 'campaign' and entity_id in (select id::text from campaigns where name like ${pattern})`;
  await sql`delete from campaigns where name like ${pattern}`;
}

beforeAll(async () => {
  await cleanupTestData();
});

afterEach(async () => {
  await cleanupTestData();
});

afterAll(async () => {
  await cleanupTestData();
  await closeDatabase();
});

describe.sequential("PostgreSQL 核心抽奖闭环", () => {
  it("同一邮箱提交 1 元和 50 元后累计为 2 张、51 元，参与人数仍为 1", async () => {
    const campaign = await startCampaign({
      name: scenarioName("accumulate"),
      codes: [[1, ["acc-1"]], [50, ["acc-50"]]],
    });

    await participate({ email: "sum@qq.com", code: "acc-1", ipAddress: testIp("acc-1") });
    const result = await participate({ email: "sum@qq.com", code: "acc-50", ipAddress: testIp("acc-2") });
    const row = await participantRow(campaign.id, "sum@qq.com");

    expect(result.codeCount).toBe(2);
    expect(result.totalFaceValue).toBe(51);
    expect(result.participantCount).toBe(1);
    expect(row).toEqual({ code_count: 2, total_face_value: 51 });
  });

  it("同一邮箱提交十张 1 元码后累计为 10 张、10 元且仍只算一人", async () => {
    const codes = Array.from({ length: 10 }, (_, index) => `ten-${index + 1}`);
    const campaign = await startCampaign({
      name: scenarioName("ten-codes"),
      codes: [[1, codes]],
    });

    let result;
    for (const code of codes) {
      result = await participate({ email: "ten@qq.com", code, ipAddress: testIp(`ten-${code}`) });
    }
    const row = await participantRow(campaign.id, "ten@qq.com");

    expect(result?.codeCount).toBe(10);
    expect(result?.totalFaceValue).toBe(10);
    expect(result?.participantCount).toBe(1);
    expect(row).toEqual({ code_count: 10, total_face_value: 10 });
  });

  it("同一兑换码被第一个邮箱成功使用后，第二个邮箱会被拒绝", async () => {
    const campaign = await startCampaign({
      name: scenarioName("reuse"),
      codes: [[1, ["single-use"]]],
    });

    await participate({ email: "first@qq.com", code: "single-use", ipAddress: testIp("first") });
    await expect(
      participate({ email: "second@qq.com", code: "single-use", ipAddress: testIp("second") }),
    ).rejects.toMatchObject({ code: "CODE_INVALID_OR_INELIGIBLE" });

    expect(await countRows("campaign_participants", campaign.id)).toBe(1);
    expect(await countRows("used_codes", campaign.id)).toBe(1);
  });

  it("两个并发请求争用同一兑换码时，数据库只允许一个成功", async () => {
    const campaign = await startCampaign({
      name: scenarioName("concurrent-code"),
      codes: [[1, ["race-code"]]],
    });

    const results = await Promise.allSettled([
      participate({ email: "race-a@qq.com", code: "race-code", ipAddress: testIp("race-a") }),
      participate({ email: "race-b@qq.com", code: "race-code", ipAddress: testIp("race-b") }),
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(await countRows("campaign_participants", campaign.id)).toBe(1);
    expect(await countRows("campaign_codes", campaign.id)).toBe(1);
    expect(await countRows("used_codes", campaign.id)).toBe(1);
  });

  it("大小写不同的 ABC 和 abc 被当作两张不同的兑换码", async () => {
    const campaign = await startCampaign({
      name: scenarioName("case-sensitive"),
      codes: [[1, ["ABC", "abc"]]],
    });

    await participate({ email: "case@qq.com", code: "ABC", ipAddress: testIp("case-upper") });
    const result = await participate({ email: "case@qq.com", code: "abc", ipAddress: testIp("case-lower") });

    expect(result.codeCount).toBe(2);
    expect(result.totalFaceValue).toBe(2);
    expect(await countRows("used_codes", campaign.id)).toBe(2);
  });

  it("同一期一个邮箱即使只有一个人和多个奖品，也只会产生一条 winner", async () => {
    const campaign = await startCampaign({
      name: scenarioName("one-winner"),
      codes: [[50, ["only-winner"]]],
      prizes: ["PRIZE-1", "PRIZE-2"],
    });
    await participate({ email: "only@qq.com", code: "only-winner", ipAddress: testIp("only") });
    const result = await completeDraw(campaign.id);

    expect(result.status).toBe("COMPLETED");
    expect(await countRows("winners", campaign.id)).toBe(1);
    const [unawarded] = await getSqlClient()<{ count: number | string }[]>`
      select count(*) as count from prize_items
      where campaign_id = ${campaign.id} and status = 'UNAWARDED'
    `;
    expect(Number(unawarded?.count ?? 0)).toBe(1);
  });

  it("第 40 个不同邮箱成功参与后只创建一个自动开奖任务", async () => {
    const codes = Array.from({ length: 40 }, (_, index) => `threshold-${index + 1}`);
    const campaign = await startCampaign({
      name: scenarioName("threshold"),
      codes: [[1, codes]],
      target: 40,
      trigger: "PARTICIPANT_TARGET",
    });

    for (const [index, code] of codes.entries()) {
      await participate({
        email: `threshold-${index + 1}@qq.com`,
        code,
        ipAddress: testIp(`threshold-${index}`),
      });
    }
    const [campaignRow] = await getSqlClient()<{ status: string }[]>`
      select status from campaigns where id = ${campaign.id}
    `;

    expect(campaignRow?.status).toBe("LOCKED");
    expect(await countRows("system_jobs", campaign.id)).toBe(1);
  });

  it("自动开奖与管理员手动开奖同时请求时只产生一个 draw_run", async () => {
    const campaign = await startCampaign({
      name: scenarioName("draw-race"),
      codes: [[1, ["draw-race-1", "draw-race-2"]]],
      target: 2,
      trigger: "PARTICIPANT_TARGET",
    });
    await participate({ email: "draw-first@qq.com", code: "draw-race-1", ipAddress: testIp("draw-first") });

    await Promise.allSettled([
      participate({ email: "draw-second@qq.com", code: "draw-race-2", ipAddress: testIp("draw-second") }),
      requestCampaignDraw(campaign.id, "ADMIN_MANUAL"),
    ]);
    await Promise.all([
      drawCampaign(campaign.id, "AUTO_TARGET"),
      drawCampaign(campaign.id, "ADMIN_MANUAL"),
    ]);

    expect(await countRows("draw_runs", campaign.id)).toBe(1);
  });

  it("使用过的兑换码即使被下一期再次导入，也不能再次成功参与", async () => {
    const first = await startCampaign({
      name: scenarioName("historical-use-first"),
      codes: [[1, ["historic-code"]]],
    });
    await participate({ email: "historic@qq.com", code: "historic-code", ipAddress: testIp("historic-first") });
    await completeDraw(first.id);

    await expect(
      createCampaign(campaignInput({
        name: scenarioName("historical-use-second-rejected"),
        codes: [[1, ["historic-code", "fresh-code"]]],
      })),
    ).rejects.toMatchObject({ code: "CODE_ALREADY_USED" });

    await startCampaign({
      name: scenarioName("historical-use-second"),
      codes: [[1, ["fresh-code"]]],
    });
    await expect(
      participate({ email: "other@qq.com", code: "historic-code", ipAddress: testIp("historic-retry") }),
    ).rejects.toMatchObject({ code: "CODE_INVALID_OR_INELIGIBLE" });
    await expect(
      participate({ email: "other@qq.com", code: "fresh-code", ipAddress: testIp("fresh") }),
    ).resolves.toMatchObject({ participantCount: 1 });
  });

  it("中奖冷却期会排除其后三期，并在第四期恢复资格", async () => {
    const coolEmail = "cool@qq.com";
    const first = await startCampaign({
      name: scenarioName("cooldown-1"),
      codes: [[50, ["cool-1"]]],
      cooldown: 3,
    });
    await participate({ email: coolEmail, code: "cool-1", ipAddress: testIp("cool-1") });
    await completeDraw(first.id);
    expect(await winnerEmails(first.id)).toEqual([coolEmail]);

    for (const issue of [2, 3, 4]) {
      const campaign = await startCampaign({
        name: scenarioName(`cooldown-${issue}`),
        codes: [[50, [`cool-${issue}`]], [1, [`eligible-${issue}`]]],
        cooldown: 3,
      });
      await participate({ email: coolEmail, code: `cool-${issue}`, ipAddress: testIp(`cool-${issue}`) });
      await participate({ email: `eligible-${issue}@qq.com`, code: `eligible-${issue}`, ipAddress: testIp(`eligible-${issue}`) });
      await completeDraw(campaign.id);
      expect(await winnerEmails(campaign.id)).toEqual([`eligible-${issue}@qq.com`]);
    }

    const restored = await startCampaign({
      name: scenarioName("cooldown-5"),
      codes: [[50, ["cool-5"]], [1, ["eligible-5"]]],
      cooldown: 3,
    });
    await participate({ email: coolEmail, code: "cool-5", ipAddress: testIp("cool-5") });
    await participate({ email: "eligible-5@qq.com", code: "eligible-5", ipAddress: testIp("eligible-5") });
    await completeDraw(restored.id);

    expect(await winnerEmails(restored.id)).toEqual([coolEmail]);
  });

  it("清理任务只删除未使用核实码，保留已使用兑换码全局记录", async () => {
    const campaign = await startCampaign({
      name: scenarioName("cleanup"),
      codes: [[1, ["cleanup-used", "cleanup-unused"]]],
      cleanupDelayMinutes: 0,
    });
    await participate({ email: "cleanup@qq.com", code: "cleanup-used", ipAddress: testIp("cleanup") });
    await completeDraw(campaign.id);
    const result = await cleanupCampaignCodes(campaign.id);
    const [campaignRow] = await getSqlClient()<{ status: string }[]>`
      select status from campaigns where id = ${campaign.id}
    `;

    expect(result.deletedCount).toBe(1);
    expect(result.archived).toBe(true);
    expect(await countRows("campaign_codes", campaign.id)).toBe(1);
    expect(await countRows("used_codes", campaign.id)).toBe(1);
    expect(campaignRow?.status).toBe("ARCHIVED");
  });
});
