import type { Metadata } from "next";
import { SettingsForm } from "@/components/settings-form";
import { PageHeader } from "@/components/ui/page-header";
import { getSettingsData } from "@/server/services/settings";

export const metadata: Metadata = { title: { absolute: "系统设置 - 冰云抽奖" } };

export default async function SettingsPage() {
  const row = await getSettingsData();
  const settings = { timezone: String(row?.timezone ?? "Asia/Shanghai"), defaultTargetUniqueEmails: Number(row?.default_target_unique_emails ?? 40), defaultMinCodeFaceValue: Number(row?.default_min_code_face_value ?? 1), defaultDrawMethod: String(row?.default_draw_method ?? "FACE_VALUE_PRIORITY"), defaultWinnerCooldownPeriods: Number(row?.default_winner_cooldown_periods ?? 3), defaultCleanupDelayMinutes: Number(row?.default_cleanup_delay_minutes ?? 60), rejectPlusAlias: Boolean(row?.reject_plus_alias ?? true), gmailDotNormalization: Boolean(row?.gmail_dot_normalization ?? true) };
  return <main className="mx-auto w-full max-w-[1180px] px-5 py-7 sm:px-7 lg:px-9 lg:py-9"><PageHeader title="系统设置" /><SettingsForm initial={settings} /></main>;
}
