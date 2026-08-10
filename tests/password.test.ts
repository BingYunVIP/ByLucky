import { describe, expect, it } from "vitest";
import {
  hashAdminPassword,
  timingSafeTextEqual,
  verifyAdminPassword,
} from "@/server/auth/password";

describe("administrator password hashing", () => {
  it("accepts the exact password and rejects a different value", async () => {
    const encoded = await hashAdminPassword("A-strong-test-password-2026");

    await expect(
      verifyAdminPassword("A-strong-test-password-2026", encoded),
    ).resolves.toBe(true);
    await expect(
      verifyAdminPassword("a-strong-test-password-2026", encoded),
    ).resolves.toBe(false);
  });

  it("uses a fresh salt for every hash", async () => {
    const first = await hashAdminPassword("same-password-value");
    const second = await hashAdminPassword("same-password-value");

    expect(first).not.toBe(second);
  });

  it("rejects malformed hashes without throwing", async () => {
    await expect(verifyAdminPassword("password", "not-a-hash")).resolves.toBe(false);
  });
});

describe("timing-safe text comparison", () => {
  it("compares exact Unicode strings", () => {
    expect(timingSafeTextEqual("admin", "admin")).toBe(true);
    expect(timingSafeTextEqual("Admin", "admin")).toBe(false);
  });
});
