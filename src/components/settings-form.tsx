"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Field, SelectInput, Switch, TextInput } from "@/components/ui/form";
import { MaterialIcon } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";

type Settings = { timezone: string; defaultTargetUniqueEmails: number; defaultMinCodeFaceValue: number; defaultDrawMethod: string; defaultWinnerCooldownPeriods: number; defaultCleanupDelayMinutes: number; rejectPlusAlias: boolean; gmailDotNormalization: boolean };

function savedString(value: unknown, fallback: string) {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

function savedNumber(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function savedBoolean(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

export function normalizeSavedSettings(value: unknown, fallback: Settings): Settings {
  const row = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return {
    timezone: savedString(row.timezone, fallback.timezone),
    defaultTargetUniqueEmails: savedNumber(row.defaultTargetUniqueEmails ?? row.default_target_unique_emails, fallback.defaultTargetUniqueEmails),
    defaultMinCodeFaceValue: savedNumber(row.defaultMinCodeFaceValue ?? row.default_min_code_face_value, fallback.defaultMinCodeFaceValue),
    defaultDrawMethod: savedString(row.defaultDrawMethod ?? row.default_draw_method, fallback.defaultDrawMethod),
    defaultWinnerCooldownPeriods: savedNumber(row.defaultWinnerCooldownPeriods ?? row.default_winner_cooldown_periods, fallback.defaultWinnerCooldownPeriods),
    defaultCleanupDelayMinutes: savedNumber(row.defaultCleanupDelayMinutes ?? row.default_cleanup_delay_minutes, fallback.defaultCleanupDelayMinutes),
    rejectPlusAlias: savedBoolean(row.rejectPlusAlias ?? row.reject_plus_alias, fallback.rejectPlusAlias),
    gmailDotNormalization: savedBoolean(row.gmailDotNormalization ?? row.gmail_dot_normalization, fallback.gmailDotNormalization),
  };
}

export function SettingsForm({ initial }: { initial: Settings }) {
  const { showToast } = useToast();
  const [settings, setSettings] = useState(initial);
  const [pending, setPending] = useState(false);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    try {
      const response = await fetch("/api/admin/settings", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(settings) });
      const payload = await response.json() as { ok: boolean; data?: { settings: unknown }; error?: { message: string } };
      if (!response.ok || !payload.ok || !payload.data?.settings) throw new Error(payload.error?.message ?? "保存失败。");
      setSettings((current) => normalizeSavedSettings(payload.data!.settings, current));
      showToast({ tone: "success", title: "系统设置已保存" });
    } catch (error) {
      showToast({ tone: "error", title: "无法保存系统设置", description: error instanceof Error ? error.message : "请稍后重试。" });
    } finally { setPending(false); }
  }

  return <form onSubmit={save} className="space-y-5">
    <Card><CardHeader title="活动默认值" /><div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6"><Field label="系统时区"><TextInput value={settings.timezone} onChange={(event) => setSettings({ ...settings, timezone: event.target.value })} /></Field><Field label="默认目标人数"><TextInput type="number" min="1" value={settings.defaultTargetUniqueEmails} onChange={(event) => setSettings({ ...settings, defaultTargetUniqueEmails: Number(event.target.value) })} /></Field><Field label="默认最低兑换码面值"><SelectInput value={settings.defaultMinCodeFaceValue} onChange={(event) => setSettings({ ...settings, defaultMinCodeFaceValue: Number(event.target.value) })}>{[1, 5, 10, 20, 50, 100].map((value) => <option key={value} value={value}>{value} 元</option>)}</SelectInput></Field><Field label="默认抽奖方式"><SelectInput value={settings.defaultDrawMethod} onChange={(event) => setSettings({ ...settings, defaultDrawMethod: event.target.value })}><option value="FACE_VALUE_PRIORITY">面值优先抽奖</option><option value="CODE_EQUAL">每张兑换码等权</option></SelectInput></Field></div></Card>
    <div className="grid gap-5 xl:grid-cols-2"><Card><CardHeader title="全局中奖规则" /><div className="p-5 sm:p-6"><Field label="中奖冷却期"><TextInput type="number" min="0" value={settings.defaultWinnerCooldownPeriods} onChange={(event) => setSettings({ ...settings, defaultWinnerCooldownPeriods: Number(event.target.value) })} /></Field></div></Card><Card><CardHeader title="核实码" /><div className="p-5 sm:p-6"><Field label="核实码清理延迟（分钟）"><TextInput type="number" min="0" value={settings.defaultCleanupDelayMinutes} onChange={(event) => setSettings({ ...settings, defaultCleanupDelayMinutes: Number(event.target.value) })} /></Field></div></Card></div>
    <Card><CardHeader title="邮箱策略" /><div className="grid gap-3 p-5 sm:grid-cols-2 sm:p-6"><Switch checked={settings.rejectPlusAlias} onChange={(checked) => setSettings({ ...settings, rejectPlusAlias: checked })} label="禁止 + alias" /><Switch checked={settings.gmailDotNormalization} onChange={(checked) => setSettings({ ...settings, gmailDotNormalization: checked })} label="Gmail 去点归一化" /></div></Card>
    <div className="flex justify-end border-t border-[var(--border)] pt-5"><Button type="submit" size="lg" disabled={pending}>{pending ? <MaterialIcon name="progress_activity" size={19} className="animate-spin" /> : <MaterialIcon name="save" size={19} />}保存系统设置</Button></div>
  </form>;
}
