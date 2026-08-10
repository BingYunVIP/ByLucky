"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Field, SelectInput, TextInput } from "@/components/ui/form";
import { MaterialIcon } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";

type Rule = { id: string; rule_type: string; value: string; enabled: boolean };

export function EmailRulesManager({ initialRules }: { initialRules: Rule[] }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [rules, setRules] = useState(initialRules);
  const [ruleType, setRuleType] = useState("EXACT");
  const [value, setValue] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Rule | null>(null);

  async function createRule(event: React.FormEvent) {
    event.preventDefault();
    setPending("create");
    try {
      const response = await fetch("/api/admin/email-rules", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ruleType, value, enabled: true }) });
      const payload = await response.json() as { ok: boolean; data?: { rule: Rule }; error?: { message: string } };
      if (!response.ok || !payload.ok || !payload.data?.rule) throw new Error(payload.error?.message ?? "新增失败。");
      setRules((current) => [...current, payload.data!.rule].sort((left, right) => left.value.localeCompare(right.value)));
      setValue("");
      showToast({ tone: "success", title: "邮箱规则已新增" });
      router.refresh();
    } catch (error) { showToast({ tone: "error", title: "无法新增邮箱规则", description: error instanceof Error ? error.message : "请稍后重试。" }); } finally { setPending(null); }
  }

  async function toggle(rule: Rule) {
    setPending(rule.id);
    try {
      const response = await fetch(`/api/admin/email-rules/${rule.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ enabled: !rule.enabled }) });
      const payload = await response.json() as { ok: boolean; data?: { rule: Rule }; error?: { message: string } };
      if (!response.ok || !payload.ok || !payload.data?.rule) throw new Error(payload.error?.message ?? "更新失败。");
      setRules((current) => current.map((item) => item.id === rule.id ? payload.data!.rule : item));
      showToast({ tone: "success", title: payload.data.rule.enabled ? "邮箱规则已启用" : "邮箱规则已停用" });
    } catch (error) { showToast({ tone: "error", title: "无法更新邮箱规则", description: error instanceof Error ? error.message : "请稍后重试。" }); } finally { setPending(null); }
  }

  async function remove(rule: Rule) {
    setPending(rule.id);
    try {
      const response = await fetch(`/api/admin/email-rules/${rule.id}`, { method: "DELETE" });
      const payload = await response.json() as { ok: boolean; error?: { message: string } };
      if (!response.ok || !payload.ok) throw new Error(payload.error?.message ?? "删除失败。");
      setRules((current) => current.filter((item) => item.id !== rule.id));
      showToast({ tone: "success", title: "邮箱规则已删除" });
    } catch (error) { showToast({ tone: "error", title: "无法删除邮箱规则", description: error instanceof Error ? error.message : "请稍后重试。" }); } finally { setPending(null); }
  }

  return <div className="space-y-5">
    <Card><CardHeader title="新增规则" /><form onSubmit={createRule} className="grid gap-4 p-5 sm:grid-cols-[180px_minmax(0,1fr)_auto] sm:items-end sm:p-6"><Field label="类型"><SelectInput value={ruleType} onChange={(event) => setRuleType(event.target.value)}><option value="EXACT">精确域名</option><option value="WILDCARD_SUFFIX">通配域名</option></SelectInput></Field><Field label="域名" required><TextInput value={value} onChange={(event) => setValue(event.target.value)} placeholder={ruleType === "WILDCARD_SUFFIX" ? "*.edu.cn" : "qq.com"} required /></Field><Button type="submit" disabled={pending !== null}>{pending === "create" ? <MaterialIcon name="progress_activity" size={19} className="animate-spin" /> : <MaterialIcon name="add" size={19} />}新增规则</Button></form></Card>
    <Card><CardHeader title="规则列表" />{rules.length ? <div className="overflow-x-auto"><table className="w-full min-w-[660px] text-left text-sm"><thead className="border-b border-[var(--border-subtle)] bg-[var(--surface-subtle)] text-xs text-[var(--text-muted)]"><tr><th className="px-5 py-3.5 font-semibold sm:px-6">域名</th><th className="px-5 py-3.5 font-semibold">类型</th><th className="px-5 py-3.5 font-semibold">状态</th><th className="px-5 py-3.5 text-right font-semibold sm:px-6">操作</th></tr></thead><tbody>{rules.map((rule) => <tr key={rule.id} className="border-b border-[var(--border-subtle)] last:border-b-0"><td className="px-5 py-4 font-mono font-medium text-[var(--text-primary)] sm:px-6">{displayRule(rule)}</td><td className="px-5 py-4"><p className="font-semibold text-[var(--text-primary)]">{rule.rule_type === "EXACT" ? "精确域名" : "通配域名"}</p><p className="mt-1 text-xs text-[var(--text-muted)]">{rule.rule_type}</p></td><td className="px-5 py-4"><label className="inline-flex cursor-pointer items-center gap-2"><input type="checkbox" className="switch-input" checked={rule.enabled} disabled={pending !== null} onChange={() => void toggle(rule)} aria-label={`${rule.enabled ? "停用" : "启用"} ${displayRule(rule)}`} /><span className="text-xs font-semibold text-[var(--text-secondary)]">{pending === rule.id ? "更新中" : rule.enabled ? "已启用" : "已停用"}</span></label></td><td className="px-5 py-4 text-right sm:px-6"><Button type="button" variant="ghost" size="sm" className="text-[var(--danger)] hover:bg-[#fff2f1] hover:text-[var(--danger)]" disabled={pending !== null} onClick={() => setPendingDelete(rule)}><MaterialIcon name="delete" size={18} />删除</Button></td></tr>)}</tbody></table></div> : <div className="px-6 py-12 text-center"><MaterialIcon name="alternate_email" size={26} className="text-[var(--text-muted)]" /><p className="mt-3 text-sm font-semibold text-[var(--text-primary)]">尚无邮箱域名规则</p></div>}</Card>
    <ConfirmDialog open={pendingDelete !== null} title="确认删除邮箱规则？" description={pendingDelete ? `将删除 ${displayRule(pendingDelete)}。` : ""} confirmLabel="确认删除" danger pending={pending === pendingDelete?.id} onCancel={() => setPendingDelete(null)} onConfirm={() => { if (pendingDelete) { const rule = pendingDelete; setPendingDelete(null); void remove(rule); } }} />
  </div>;
}

function displayRule(rule: Rule) { return rule.rule_type === "WILDCARD_SUFFIX" ? `*.${rule.value.replace(/^\*\./, "")}` : rule.value; }
