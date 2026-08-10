import { describe, expect, it } from "vitest";
import { maskEmail } from "@/server/services/public";

describe("public winner email masking", () => {
  it("keeps the complete domain and shows the first and last two local-part characters", () => {
    expect(maskEmail("worker@qq.com")).toBe("wo***er@qq.com");
    expect(maskEmail("bingyun.user@gmail.com")).toBe("bi***er@gmail.com");
    expect(maskEmail("name@subdomain.example.com")).toBe("na***me@subdomain.example.com");
  });

  it("does not expose an invalid email address", () => {
    expect(maskEmail("not-an-email")).toBe("***");
    expect(maskEmail("name@")).toBe("***");
  });
});
