"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { emailStatusLabel, emailStatusTone, formatAdminDate } from "@/components/admin/presentation";
import { EmailRulesManager } from "@/components/email-rules-manager";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { cn } from "@/components/ui/cn";
import { Field, SelectInput, Switch, Textarea, TextInput } from "@/components/ui/form";
import { MaterialIcon } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";

type Smtp = { provider: string; host: string; port: number; security: string; username: string; fromEmail: string; fromName: string; enabled: boolean; passwordConfigured: boolean } | null;
type Template = { templateKey: string; subjectTemplate: string; textTemplate: string; htmlTemplate: string | null; enabled: boolean };
type Job = { id: string; recipientEmail: string; status: string; attempts: number; maxAttempts: number; nextAttemptAt: string | null; lastError: string | null; sentAt: string | null; createdAt: string; issueNo: number; prizeName: string };
type EmailRule = { id: string; rule_type: string; value: string; enabled: boolean };
type Tab = "smtp" | "template" | "rules" | "queue";

const variables = [
  { key: "winner_email", label: "中奖用户邮箱" },
  { key: "campaign_name", label: "活动名称" },
  { key: "issue_no", label: "活动期号" },
  { key: "prize_level", label: "奖项等级" },
  { key: "prize_public_name", label: "公开奖品名称" },
  { key: "prize_content", label: "实际获奖内容" },
  { key: "draw_time", label: "开奖时间" },
];

export function EmailManagement({ initialSmtp, initialTemplates, initialJobs, initialRules, queueTotal, initialTab = "smtp", highlightJobId = null }: { initialSmtp: Smtp; initialTemplates: Template[]; initialJobs: Job[]; initialRules: EmailRule[]; queueTotal: number; initialTab?: Tab; highlightJobId?: string | null }) {
  const router = useRouter();
  const { showToast } = useToast();
  const initialTemplate = initialTemplates.find((item) => item.templateKey === "WINNER_NOTICE") ?? { templateKey: "WINNER_NOTICE", subjectTemplate: "", textTemplate: "", htmlTemplate: null, enabled: true };
  const [tab, setTab] = useState<Tab>(initialTab);
  const [smtp, setSmtp] = useState({ provider: initialSmtp?.provider ?? "QQ", host: initialSmtp?.host ?? "smtp.qq.com", port: initialSmtp?.port ?? 465, security: initialSmtp?.security ?? "TLS", username: initialSmtp?.username ?? "", password: "", fromEmail: initialSmtp?.fromEmail ?? "", fromName: initialSmtp?.fromName ?? "ByLucky 冰云抽奖", enabled: initialSmtp?.enabled ?? false });
  const [passwordConfigured, setPasswordConfigured] = useState(initialSmtp?.passwordConfigured ?? false);
  const [mailTemplate, setMailTemplate] = useState(initialTemplate);
  const [pending, setPending] = useState<"smtp" | "template" | "smtp-test" | string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [activeEditor, setActiveEditor] = useState<"subject" | "text" | "html">("text");
  const [testOpen, setTestOpen] = useState(false);
  const [testRecipient, setTestRecipient] = useState("");
  const [highlightedJob, setHighlightedJob] = useState<string | null>(highlightJobId);
  const subjectRef = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const htmlRef = useRef<HTMLTextAreaElement>(null);
  const testRecipientRef = useRef<HTMLInputElement>(null);
  const highlightedRowRef = useRef<HTMLTableRowElement>(null);

  useEffect(() => { setTab(initialTab); }, [initialTab]);
  useEffect(() => { setHighlightedJob(highlightJobId); }, [highlightJobId]);
  useEffect(() => {
    if (tab !== "queue" || !highlightedJob) return;
    const frame = window.requestAnimationFrame(() => highlightedRowRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }));
    const timeout = window.setTimeout(() => setHighlightedJob(null), 2_000);
    return () => { window.cancelAnimationFrame(frame); window.clearTimeout(timeout); };
  }, [highlightedJob, tab]);
  useEffect(() => {
    if (!testOpen) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape" && pending !== "smtp-test") setTestOpen(false); };
    document.addEventListener("keydown", onKeyDown);
    window.setTimeout(() => testRecipientRef.current?.focus(), 0);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [pending, testOpen]);

  function chooseProvider(provider: string) {
    setSmtp((current) => provider === "QQ" ? { ...current, provider, host: "smtp.qq.com", port: 465, security: "TLS" } : { ...current, provider });
  }

  function smtpPayload() {
    const { password, ...smtpPayload } = smtp;
    return { ...smtpPayload, ...(password ? { password } : {}) };
  }

  async function saveSmtp(event: React.FormEvent) {
    event.preventDefault();
    setPending("smtp");
    try {
      const response = await fetch("/api/admin/email/smtp", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(smtpPayload()) });
      const payload = await response.json() as { ok: boolean; error?: { message: string } };
      if (!response.ok || !payload.ok) throw new Error(payload.error?.message ?? "SMTP 保存失败。");
      if (smtp.password) setPasswordConfigured(true);
      setSmtp((current) => ({ ...current, password: "" }));
      showToast({ tone: "success", title: "SMTP 配置已保存" });
    } catch (error) { showToast({ tone: "error", title: "SMTP 保存失败", description: error instanceof Error ? error.message : "请稍后重试。" }); } finally { setPending(null); }
  }

  async function sendSmtpTest(event: React.FormEvent) {
    event.preventDefault();
    setPending("smtp-test");
    try {
      const response = await fetch("/api/admin/email/smtp/test", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ recipientEmail: testRecipient, smtp: smtpPayload() }) });
      const payload = await response.json() as { ok: boolean; error?: { message: string } };
      if (!response.ok || !payload.ok) throw new Error(payload.error?.message ?? "测试邮件发送失败。");
      setTestOpen(false);
      showToast({ tone: "success", title: "测试邮件发送成功" });
    } catch (error) { showToast({ tone: "error", title: "测试邮件发送失败", description: error instanceof Error ? error.message : "请稍后重试。" }); } finally { setPending(null); }
  }

  async function saveTemplate(event: React.FormEvent) {
    event.preventDefault();
    setPending("template");
    try {
      const response = await fetch(`/api/admin/email/templates/${mailTemplate.templateKey}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(mailTemplate) });
      const payload = await response.json() as { ok: boolean; error?: { message: string } };
      if (!response.ok || !payload.ok) throw new Error(payload.error?.message ?? "模板保存失败。");
      showToast({ tone: "success", title: "邮件模板已保存" });
    } catch (error) { showToast({ tone: "error", title: "模板保存失败", description: error instanceof Error ? error.message : "请稍后重试。" }); } finally { setPending(null); }
  }

  function insertVariable(variable: string) {
    const token = `{{${variable}}}`;
    const target = activeEditor === "subject" ? subjectRef.current : activeEditor === "text" ? textRef.current : htmlRef.current;
    const previous = target?.value ?? (activeEditor === "subject" ? mailTemplate.subjectTemplate : activeEditor === "text" ? mailTemplate.textTemplate : mailTemplate.htmlTemplate ?? "");
    const start = target?.selectionStart ?? previous.length;
    const end = target?.selectionEnd ?? previous.length;
    const next = `${previous.slice(0, start)}${token}${previous.slice(end)}`;
    target?.setRangeText(token, start, end, "end");
    setMailTemplate((current) => activeEditor === "subject" ? { ...current, subjectTemplate: next } : activeEditor === "text" ? { ...current, textTemplate: next } : { ...current, htmlTemplate: next });
    window.setTimeout(() => { target?.focus(); target?.setSelectionRange(start + token.length, start + token.length); }, 0);
  }

  async function retryJob(id: string) {
    setPending(id);
    try {
      const response = await fetch(`/api/admin/email/jobs/${id}/retry`, { method: "POST" });
      const payload = await response.json() as { ok: boolean; error?: { message: string } };
      if (!response.ok || !payload.ok) throw new Error(payload.error?.message ?? "重试失败。");
      showToast({ tone: "success", title: "邮件任务已重新排队" });
      router.refresh();
    } catch (error) { showToast({ tone: "error", title: "无法重试邮件任务", description: error instanceof Error ? error.message : "请稍后重试。" }); } finally { setPending(null); }
  }

  return <div>
    <div className="mb-5 flex gap-1 overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--surface)] p-2 shadow-[var(--shadow-card)]" role="tablist" aria-label="邮件配置标签页">
      {([{ id: "smtp", label: "SMTP", icon: "mail" }, { id: "rules", label: "邮箱规则", icon: "alternate_email" }, { id: "template", label: "邮件模板", icon: "edit_note" }, { id: "queue", label: "发送队列", icon: "outbox" }] as Array<{ id: Tab; label: string; icon: string }>).map((item) => <button key={item.id} type="button" role="tab" aria-selected={tab === item.id} onClick={() => setTab(item.id)} className={cn("inline-flex h-10 shrink-0 items-center gap-2 rounded-lg px-3 text-sm font-semibold transition", tab === item.id ? "bg-[var(--text-primary)] text-white" : "text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]")}><MaterialIcon name={item.icon} size={19} filled={tab === item.id} />{item.label}{item.id === "queue" ? <span className="text-xs opacity-70">{queueTotal}</span> : null}</button>)}
    </div>

    {tab === "smtp" ? <form onSubmit={saveSmtp}><Card><CardHeader title="SMTP 配置" /><div className="p-5 sm:p-6"><div className="grid gap-4 sm:grid-cols-2"><Field label="服务商" required><SelectInput value={smtp.provider} onChange={(event) => chooseProvider(event.target.value)}><option value="QQ">QQ 邮箱</option><option value="CUSTOM">自定义 SMTP</option></SelectInput></Field><Field label="安全模式" required><SelectInput value={smtp.security} onChange={(event) => setSmtp((current) => ({ ...current, security: event.target.value }))}><option value="TLS">TLS / SSL</option><option value="STARTTLS">STARTTLS</option><option value="NONE">不加密</option></SelectInput></Field><Field label="SMTP 主机" required><TextInput value={smtp.host} onChange={(event) => setSmtp((current) => ({ ...current, host: event.target.value }))} placeholder="smtp.qq.com" /></Field><Field label="端口" required><TextInput type="number" min="1" max="65535" value={smtp.port} onChange={(event) => setSmtp((current) => ({ ...current, port: Number(event.target.value) }))} /></Field><Field label="SMTP 用户名" required><TextInput type="email" value={smtp.username} onChange={(event) => setSmtp((current) => ({ ...current, username: event.target.value }))} placeholder="name@example.com" /></Field><Field label="授权码" required><span className="relative block"><TextInput type={showPassword ? "text" : "password"} value={smtp.password} onChange={(event) => setSmtp((current) => ({ ...current, password: event.target.value }))} className="pr-11" placeholder={passwordConfigured ? "留空表示保持不变" : "输入授权码"} autoComplete="new-password" /><button type="button" aria-label={showPassword ? "隐藏授权码" : "显示授权码"} className="absolute right-1 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-lg text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]" onClick={() => setShowPassword((current) => !current)}><MaterialIcon name={showPassword ? "visibility_off" : "visibility"} size={19} /></button></span></Field><Field label="发件邮箱" required><TextInput type="email" value={smtp.fromEmail} onChange={(event) => setSmtp((current) => ({ ...current, fromEmail: event.target.value }))} placeholder="name@example.com" /></Field><Field label="发件人名称" required><TextInput value={smtp.fromName} onChange={(event) => setSmtp((current) => ({ ...current, fromName: event.target.value }))} /></Field></div><div className="mt-4"><Switch checked={smtp.enabled} onChange={(enabled) => setSmtp((current) => ({ ...current, enabled }))} label="启用邮件发送" /></div><p className="mt-4 text-xs leading-5 text-[var(--text-muted)]">测试发送不会创建中奖邮件任务；中奖邮件仍按发送队列处理。</p></div><div className="flex flex-wrap justify-end gap-2 border-t border-[var(--border-subtle)] p-5 sm:px-6"><Button type="button" variant="secondary" disabled={pending !== null} onClick={() => { setTestRecipient(smtp.fromEmail); setTestOpen(true); }}><MaterialIcon name="send" size={19} />测试发送</Button><Button type="submit" disabled={pending !== null}>{pending === "smtp" ? <MaterialIcon name="progress_activity" size={19} className="animate-spin" /> : <MaterialIcon name="save" size={19} />}保存 SMTP</Button></div></Card></form> : null}

    {tab === "template" ? <form onSubmit={saveTemplate}><Card><CardHeader title="中奖邮件模板" /><div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_250px] sm:p-6"><div className="space-y-4"><Field label="邮件主题" required><TextInput ref={subjectRef} defaultValue={mailTemplate.subjectTemplate} onFocus={() => setActiveEditor("subject")} onChange={(event) => setMailTemplate((current) => ({ ...current, subjectTemplate: event.target.value }))} placeholder="例如：恭喜你获得 {{prize_public_name}}" /></Field><Field label="文本正文" required><Textarea ref={textRef} defaultValue={mailTemplate.textTemplate} onFocus={() => setActiveEditor("text")} onChange={(event) => setMailTemplate((current) => ({ ...current, textTemplate: event.target.value }))} className="min-h-56" placeholder="请输入邮件正文" /></Field><details className="rounded-xl border border-[var(--border)] bg-[var(--surface-subtle)]"><summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-[var(--text-primary)]"><span>高级选项：HTML 正文</span><MaterialIcon name="expand_more" size={19} /></summary><div className="border-t border-[var(--border-subtle)] p-4"><Field label="HTML 正文"><Textarea ref={htmlRef} defaultValue={mailTemplate.htmlTemplate ?? ""} onFocus={() => setActiveEditor("html")} onChange={(event) => setMailTemplate((current) => ({ ...current, htmlTemplate: event.target.value || null }))} className="min-h-44 font-mono" placeholder="可选 HTML 内容" /></Field></div></details><Switch checked={mailTemplate.enabled} onChange={(enabled) => setMailTemplate((current) => ({ ...current, enabled }))} label="启用中奖邮件模板" /></div><aside className="rounded-xl border border-[#cfe2f1] bg-[#f3faff] p-4"><div className="flex items-center gap-2 text-sm font-semibold text-[#28617f]"><MaterialIcon name="data_object" size={20} />可用变量</div><div className="mt-4 space-y-2">{variables.map((variable) => <button key={variable.key} type="button" aria-label={`插入变量：${variable.label}`} onClick={() => insertVariable(variable.key)} className="flex w-full items-center justify-between gap-3 rounded-lg border border-[#c7e0ed] bg-[var(--surface)] px-3 py-2 text-left transition hover:border-[var(--brand)] hover:text-[var(--brand)]"><span className="min-w-0 text-xs font-medium text-[var(--text-secondary)]">{variable.label}</span><code className="shrink-0 font-mono text-[11px] text-[#28617f]">{`{{${variable.key}}}`}</code></button>)}</div></aside></div><div className="flex justify-end border-t border-[var(--border-subtle)] p-5 sm:px-6"><Button type="submit" disabled={pending !== null}>{pending === "template" ? <MaterialIcon name="progress_activity" size={19} className="animate-spin" /> : <MaterialIcon name="save" size={19} />}保存邮件模板</Button></div></Card></form> : null}

    {tab === "queue" ? <Card><CardHeader title="发送队列" />{initialJobs.length ? <div className="overflow-x-auto"><table className="w-full min-w-[860px] text-left text-sm"><thead className="border-b border-[var(--border-subtle)] bg-[var(--surface-subtle)] text-xs text-[var(--text-muted)]"><tr><th className="px-5 py-3.5 font-semibold sm:px-6">收件人</th><th className="px-5 py-3.5 font-semibold">期号 / 奖项</th><th className="px-5 py-3.5 font-semibold">状态</th><th className="px-5 py-3.5 font-semibold">尝试次数</th><th className="px-5 py-3.5 font-semibold">下次重试</th><th className="px-5 py-3.5 font-semibold">创建时间</th><th className="px-5 py-3.5 text-right font-semibold sm:px-6">操作</th></tr></thead><tbody>{initialJobs.map((job) => <tr key={job.id} ref={job.id === highlightedJob ? highlightedRowRef : undefined} className={cn("border-b border-[var(--border-subtle)] transition-colors last:border-b-0", job.id === highlightedJob && "bg-[#fff9ee]")}><td className="px-5 py-4 font-medium text-[var(--text-primary)] sm:px-6">{job.recipientEmail}</td><td className="px-5 py-4 text-[var(--text-secondary)]">第 {job.issueNo} 期 · {job.prizeName}</td><td className="px-5 py-4"><Badge tone={emailStatusTone(job.status)}>{emailStatusLabel(job.status)}</Badge></td><td className="px-5 py-4 text-[var(--text-secondary)]">{job.attempts} / {job.maxAttempts}</td><td className="px-5 py-4 whitespace-nowrap text-xs text-[var(--text-muted)]">{job.nextAttemptAt ? formatAdminDate(job.nextAttemptAt) : "-"}</td><td className="px-5 py-4 whitespace-nowrap text-xs text-[var(--text-muted)]">{formatAdminDate(job.createdAt)}</td><td className="px-5 py-4 text-right sm:px-6">{["FAILED", "PENDING"].includes(job.status) ? <Button type="button" variant="ghost" size="sm" disabled={pending !== null} onClick={() => void retryJob(job.id)}>{pending === job.id ? <MaterialIcon name="progress_activity" size={17} className="animate-spin" /> : <MaterialIcon name="refresh" size={18} />}重新排队</Button> : <span className="text-xs text-[var(--text-muted)]">-</span>}</td></tr>)}</tbody></table></div> : <div className="px-6 py-12 text-center"><MaterialIcon name="outbox" size={27} className="text-[var(--text-muted)]" /><p className="mt-3 text-sm font-semibold text-[var(--text-primary)]">暂无待发送邮件</p></div>}</Card> : null}

    {tab === "rules" ? <EmailRulesManager initialRules={initialRules} /> : null}

    {testOpen ? <div className="fixed inset-0 z-[70] grid place-items-center bg-[#17242d]/35 p-4" role="presentation"><button type="button" className="absolute inset-0 cursor-default" aria-label="关闭测试发送" disabled={pending === "smtp-test"} onClick={() => setTestOpen(false)} /><section role="dialog" aria-modal="true" aria-labelledby="smtp-test-title" className="relative w-full max-w-md rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-[0_20px_60px_rgba(23,36,45,0.24)]"><form onSubmit={sendSmtpTest}><div className="border-b border-[var(--border-subtle)] px-5 py-4"><h2 id="smtp-test-title" className="text-lg font-semibold text-[var(--text-primary)]">测试发送</h2></div><div className="p-5"><Field label="测试收件邮箱" required><TextInput ref={testRecipientRef} type="email" value={testRecipient} onChange={(event) => setTestRecipient(event.target.value)} placeholder="example@qq.com" required disabled={pending === "smtp-test"} /></Field></div><div className="flex justify-end gap-2 border-t border-[var(--border-subtle)] p-4"><Button type="button" variant="secondary" disabled={pending === "smtp-test"} onClick={() => setTestOpen(false)}>取消</Button><Button type="submit" disabled={pending === "smtp-test"}>{pending === "smtp-test" ? <MaterialIcon name="progress_activity" size={19} className="animate-spin" /> : <MaterialIcon name="send" size={19} />}发送测试邮件</Button></div></form></section></div> : null}
  </div>;
}
