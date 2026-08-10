import { describe, expect, it } from "vitest";
import {
  drawByCodeEqual,
  drawByFaceValuePriority,
} from "@/server/lottery/algorithms";
import type {
  LotteryParticipant,
  LotteryPrizeItem,
  RandomSource,
} from "@/server/lottery/types";

function participant(
  id: string,
  totalFaceValue: number,
  codeCount = 1,
): LotteryParticipant {
  return {
    id,
    originalEmail: `${id}@qq.com`,
    canonicalEmail: `${id}@qq.com`,
    totalFaceValue,
    codeCount,
  };
}

function prize(id: string): LotteryPrizeItem {
  return { id, prizeTierId: "tier-1", sequenceNo: 1 };
}

function picks(...values: number[]): RandomSource {
  return {
    int(minInclusive, maxExclusive) {
      const value = values.shift() ?? minInclusive;
      expect(value).toBeGreaterThanOrEqual(minInclusive);
      expect(value).toBeLessThan(maxExclusive);
      return value;
    },
  };
}

describe("面值优先抽奖", () => {
  it("51 元、20 元、10 元且只有一个奖品时，51 元邮箱必定获奖", () => {
    const result = drawByFaceValuePriority(
      [participant("a", 51), participant("b", 20), participant("c", 10)],
      [prize("first")],
      picks(0),
    );

    expect(result[0]?.participant?.id).toBe("a");
  });

  it("50 元并列时只会从最高档的邮箱中抽取", () => {
    const result = drawByFaceValuePriority(
      [participant("a", 50), participant("b", 50), participant("c", 10)],
      [prize("first")],
      picks(1),
    );

    expect(["a", "b"]).toContain(result[0]?.participant?.id);
  });

  it("名额多于最高档人数时，按累计面值向下一档递补", () => {
    const result = drawByFaceValuePriority(
      [participant("a", 100), participant("b", 50), participant("c", 20), participant("d", 20)],
      [prize("first"), prize("second"), prize("third")],
      picks(0, 0, 1),
    );
    const winners = result.map((selection) => selection.participant?.id);

    expect(winners.slice(0, 2)).toEqual(["a", "b"]);
    expect(["c", "d"]).toContain(winners[2]);
  });
});

describe("每张兑换码等权", () => {
  it("一个邮箱中奖后会移除其全部剩余票，后续奖项不能重复中奖", () => {
    const result = drawByCodeEqual(
      [participant("a", 10, 10), participant("b", 1, 1), participant("c", 1, 1)],
      [prize("first"), prize("second"), prize("third")],
      picks(0, 0, 0),
    );
    const winners = result
      .map((selection) => selection.participant?.id)
      .filter((id): id is string => Boolean(id));

    expect(winners[0]).toBe("a");
    expect(new Set(winners).size).toBe(winners.length);
    expect(winners.slice(1)).not.toContain("a");
  });
});
