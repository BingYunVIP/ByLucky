import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { hashSessionToken } from "@/server/auth/session";

describe("administrator session token", () => {
  it("stores a SHA-256 digest rather than the raw token", () => {
    const token = "raw-session-token";
    const digest = hashSessionToken(token);

    expect(Buffer.isBuffer(digest)).toBe(true);
    expect(digest).toHaveLength(32);
    expect(digest.equals(Buffer.from(token))).toBe(false);
    expect(digest.equals(createHash("sha256").update(token).digest())).toBe(true);
  });
});
