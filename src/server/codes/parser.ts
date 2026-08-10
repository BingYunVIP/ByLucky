import { FACE_VALUES, type FaceValue } from "@/db/schema";

export type CodeParseIssue = {
  code: "CODE_BEFORE_HEADER" | "UNKNOWN_HEADER" | "DUPLICATE_CODE" | "CROSS_VALUE_DUPLICATE";
  line: number;
};

export type ParsedCampaignCode = {
  code: string;
  faceValue: FaceValue;
  line: number;
  hasOuterWhitespace: boolean;
};

export type ParsedCodeImport = {
  codes: ParsedCampaignCode[];
  counts: Record<FaceValue, number>;
  total: number;
  whitespaceRiskCount: number;
  issues: CodeParseIssue[];
};

const headerPattern = /^\s*#\s*(1|5|10|20|50|100)元\s*$/;

function emptyCounts(): Record<FaceValue, number> {
  return { 1: 0, 5: 0, 10: 0, 20: 0, 50: 0, 100: 0 };
}

function isFaceValue(value: number): value is FaceValue {
  return FACE_VALUES.includes(value as FaceValue);
}

export function parseCampaignCodeText(text: string): ParsedCodeImport {
  const counts = emptyCounts();
  const codes: ParsedCampaignCode[] = [];
  const issues: CodeParseIssue[] = [];
  const seen = new Map<string, ParsedCampaignCode>();
  let activeFaceValue: FaceValue | null = null;
  let whitespaceRiskCount = 0;

  for (const [index, line] of text.split(/\r?\n/).entries()) {
    const lineNumber = index + 1;
    const trimmedLine = line.trim();
    if (trimmedLine === "") continue;

    const headerMatch = trimmedLine.match(headerPattern);
    if (headerMatch) {
      const value = Number(headerMatch[1]);
      if (isFaceValue(value)) {
        activeFaceValue = value;
        continue;
      }
    }

    if (trimmedLine.startsWith("#")) {
      issues.push({ code: "UNKNOWN_HEADER", line: lineNumber });
      continue;
    }

    if (activeFaceValue === null) {
      issues.push({ code: "CODE_BEFORE_HEADER", line: lineNumber });
      continue;
    }

    const item: ParsedCampaignCode = {
      // Textarea indentation and accidental outer spaces are not part of a code.
      code: trimmedLine,
      faceValue: activeFaceValue,
      line: lineNumber,
      hasOuterWhitespace: line !== trimmedLine,
    };
    const prior = seen.get(item.code);
    if (prior) {
      issues.push({
        code: prior.faceValue === item.faceValue ? "DUPLICATE_CODE" : "CROSS_VALUE_DUPLICATE",
        line: lineNumber,
      });
      continue;
    }

    seen.set(item.code, item);
    codes.push(item);
    counts[item.faceValue] += 1;
    if (item.hasOuterWhitespace) whitespaceRiskCount += 1;
  }

  return {
    codes,
    counts,
    total: codes.length,
    whitespaceRiskCount,
    issues,
  };
}
