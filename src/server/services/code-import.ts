import "server-only";

import type { FaceValue } from "@/db/schema";
import { codeHashKey, hashExactCode } from "@/server/crypto/sensitive";
import {
  parseCampaignCodeText,
  type ParsedCampaignCode,
} from "@/server/codes/parser";
import { getSqlClient } from "@/db/client";

export type PreparedCampaignCode = ParsedCampaignCode & {
  codeHash: Buffer;
  hashKey: string;
};

export type PreparedCodeImport = {
  entries: PreparedCampaignCode[];
  counts: Record<FaceValue, number>;
  total: number;
  whitespaceRiskCount: number;
  parseIssues: Array<{ code: string; line: number }>;
};

export type CodeImportPreview = {
  counts: Record<FaceValue, number>;
  importableCounts: Record<FaceValue, number>;
  total: number;
  importableTotal: number;
  whitespaceRiskCount: number;
  duplicateCount: number;
  crossValueDuplicateCount: number;
  usedSkippedCount: number;
  otherCampaignConflictCount: number;
  currentCampaignDuplicateCount: number;
  errors: Array<{ code: string; line?: number }>;
  canImport: boolean;
};

type HashRow = { hash_key: string };

function emptyCounts(): Record<FaceValue, number> {
  return { 1: 0, 5: 0, 10: 0, 20: 0, 50: 0, 100: 0 };
}

function chunk<T>(values: T[], size: number) {
  const results: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    results.push(values.slice(index, index + size));
  }
  return results;
}

export function prepareCodeImport(text: string): PreparedCodeImport {
  const parsed = parseCampaignCodeText(text);
  return {
    entries: parsed.codes.map((entry) => {
      const codeHash = hashExactCode(entry.code);
      return { ...entry, codeHash, hashKey: codeHashKey(codeHash) };
    }),
    counts: parsed.counts,
    total: parsed.total,
    whitespaceRiskCount: parsed.whitespaceRiskCount,
    parseIssues: parsed.issues,
  };
}

async function findUsedHashes(hashBuffers: Buffer[]) {
  const sql = getSqlClient();
  const found = new Set<string>();
  for (const group of chunk(hashBuffers, 2_000)) {
    const rows = await sql<HashRow[]>`
      select encode(code_hash, 'hex') as hash_key
      from used_codes
      where code_hash in ${sql(group)}
    `;
    rows.forEach((row) => found.add(row.hash_key));
  }
  return found;
}

async function findOtherCampaignHashes(hashBuffers: Buffer[], campaignId?: string) {
  const sql = getSqlClient();
  const found = new Set<string>();
  for (const group of chunk(hashBuffers, 2_000)) {
    const rows = campaignId
      ? await sql<HashRow[]>`
          select distinct encode(campaign_codes.code_hash, 'hex') as hash_key
          from campaign_codes
          join campaigns on campaigns.id = campaign_codes.campaign_id
          where campaign_codes.code_hash in ${sql(group)}
            and campaign_codes.used_at is null
            and campaign_codes.campaign_id <> ${campaignId}
            and campaigns.status not in ('ARCHIVED', 'CANCELED')
        `
      : await sql<HashRow[]>`
          select distinct encode(campaign_codes.code_hash, 'hex') as hash_key
          from campaign_codes
          join campaigns on campaigns.id = campaign_codes.campaign_id
          where campaign_codes.code_hash in ${sql(group)}
            and campaign_codes.used_at is null
            and campaigns.status not in ('ARCHIVED', 'CANCELED')
        `;
    rows.forEach((row) => found.add(row.hash_key));
  }
  return found;
}

async function findCurrentCampaignHashes(hashBuffers: Buffer[], campaignId?: string) {
  if (!campaignId || hashBuffers.length === 0) return new Set<string>();
  const sql = getSqlClient();
  const found = new Set<string>();
  for (const group of chunk(hashBuffers, 2_000)) {
    const rows = await sql<HashRow[]>`
      select encode(code_hash, 'hex') as hash_key
      from campaign_codes
      where campaign_id = ${campaignId} and code_hash in ${sql(group)}
    `;
    rows.forEach((row) => found.add(row.hash_key));
  }
  return found;
}

export async function previewCodeImport(text: string, campaignId?: string): Promise<CodeImportPreview> {
  const prepared = prepareCodeImport(text);
  const hashBuffers = prepared.entries.map((entry) => entry.codeHash);
  const [usedHashes, otherCampaignHashes, currentCampaignHashes] = await Promise.all([
    findUsedHashes(hashBuffers),
    findOtherCampaignHashes(hashBuffers, campaignId),
    findCurrentCampaignHashes(hashBuffers, campaignId),
  ]);
  const importableCounts = emptyCounts();
  let importableTotal = 0;
  let usedSkippedCount = 0;
  let otherCampaignConflictCount = 0;
  let currentCampaignDuplicateCount = 0;

  for (const entry of prepared.entries) {
    if (usedHashes.has(entry.hashKey)) {
      usedSkippedCount += 1;
      continue;
    }
    if (otherCampaignHashes.has(entry.hashKey)) {
      otherCampaignConflictCount += 1;
      continue;
    }
    if (currentCampaignHashes.has(entry.hashKey)) {
      currentCampaignDuplicateCount += 1;
      continue;
    }
    importableCounts[entry.faceValue] += 1;
    importableTotal += 1;
  }

  const duplicateCount = prepared.parseIssues.filter(
    (issue) => issue.code === "DUPLICATE_CODE",
  ).length;
  const crossValueDuplicateCount = prepared.parseIssues.filter(
    (issue) => issue.code === "CROSS_VALUE_DUPLICATE",
  ).length;
  const errors: Array<{ code: string; line?: number }> = prepared.parseIssues.map(
    (issue) => issue,
  );
  if (prepared.total === 0) errors.push({ code: "EMPTY_IMPORT" });
  if (usedSkippedCount > 0) {
    errors.push({ code: "CODE_ALREADY_USED" });
  }
  if (otherCampaignConflictCount > 0) {
    errors.push({ code: "CODE_ASSIGNED_TO_OTHER_CAMPAIGN" });
  }
  if (currentCampaignDuplicateCount > 0) {
    errors.push({ code: "CODE_ALREADY_IN_CAMPAIGN" });
  }

  return {
    counts: prepared.counts,
    importableCounts,
    total: prepared.total,
    importableTotal,
    whitespaceRiskCount: prepared.whitespaceRiskCount,
    duplicateCount,
    crossValueDuplicateCount,
    usedSkippedCount,
    otherCampaignConflictCount,
    currentCampaignDuplicateCount,
    errors,
    canImport: errors.length === 0 && importableTotal > 0,
  };
}
