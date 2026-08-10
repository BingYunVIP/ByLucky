import { describe, expect, it } from "vitest";
import { parseCampaignCodeText } from "@/server/codes/parser";

describe("核实兑换码文本解析", () => {
  it("会去掉 textarea 行首尾空格，但保留大小写并按精确值判断重复", () => {
    const result = parseCampaignCodeText(
      "# 1元\n  ABC \n\n# 5元\nABC\nabc\n",
    );

    expect(result.codes.map((entry) => entry.code)).toEqual(["ABC", "abc"]);
    expect(result.counts).toMatchObject({ 1: 1, 5: 1 });
    expect(result.whitespaceRiskCount).toBe(1);
    expect(result.issues).toContainEqual({ code: "CROSS_VALUE_DUPLICATE", line: 5 });
  });
});
