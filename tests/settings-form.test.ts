import { describe, expect, it } from "vitest";
import { normalizeSavedSettings } from "@/components/settings-form";

const fallback = {
  timezone: "Asia/Shanghai",
  defaultTargetUniqueEmails: 40,
  defaultMinCodeFaceValue: 1,
  defaultDrawMethod: "FACE_VALUE_PRIORITY",
  defaultWinnerCooldownPeriods: 3,
  defaultCleanupDelayMinutes: 60,
  rejectPlusAlias: true,
  gmailDotNormalization: true,
};

describe("saved system settings normalization", () => {
  it("maps the database response to complete controlled form values", () => {
    expect(normalizeSavedSettings({
      timezone: "Asia/Shanghai",
      default_target_unique_emails: 75,
      default_min_code_face_value: 20,
      default_draw_method: "CODE_EQUAL",
      default_winner_cooldown_periods: 5,
      default_cleanup_delay_minutes: 180,
      reject_plus_alias: false,
      gmail_dot_normalization: false,
    }, fallback)).toEqual({
      timezone: "Asia/Shanghai",
      defaultTargetUniqueEmails: 75,
      defaultMinCodeFaceValue: 20,
      defaultDrawMethod: "CODE_EQUAL",
      defaultWinnerCooldownPeriods: 5,
      defaultCleanupDelayMinutes: 180,
      rejectPlusAlias: false,
      gmailDotNormalization: false,
    });
  });

  it("keeps existing form values when a response field is absent", () => {
    expect(normalizeSavedSettings({ timezone: "UTC" }, fallback)).toEqual({ ...fallback, timezone: "UTC" });
  });
});
