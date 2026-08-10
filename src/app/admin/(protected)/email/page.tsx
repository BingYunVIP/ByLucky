import type { Metadata } from "next";
import { EmailManagement } from "@/components/email-management";
import { PageHeader } from "@/components/ui/page-header";
import { getSmtpConfig, listEmailDomainRules, listEmailJobs, listEmailTemplates } from "@/server/services/settings";

type EmailTab = "smtp" | "template" | "rules" | "queue";

export const metadata: Metadata = { title: { absolute: "邮件配置 - 冰云抽奖" } };

function validTab(value: string | undefined): EmailTab {
  return value === "template" || value === "rules" || value === "queue" ? value : "smtp";
}

export default async function EmailPage({ searchParams }: { searchParams: Promise<{ tab?: string; jobId?: string }> }) {
  const params = await searchParams;
  const tab = validTab(params.tab);
  const [smtp, templates, jobs, rules] = await Promise.all([getSmtpConfig(), listEmailTemplates(), listEmailJobs(1, params.jobId), listEmailDomainRules()]);
  const typedSmtp = smtp ? { provider: String(smtp.provider), host: String(smtp.host), port: Number(smtp.port), security: String(smtp.security), username: String(smtp.username), fromEmail: String(smtp.from_email), fromName: String(smtp.from_name), enabled: Boolean(smtp.enabled), passwordConfigured: Boolean(smtp.password_configured) } : null;
  const typedTemplates = templates.map((row) => ({ templateKey: String(row.template_key), subjectTemplate: String(row.subject_template), textTemplate: String(row.text_template), htmlTemplate: row.html_template ? String(row.html_template) : null, enabled: Boolean(row.enabled) }));
  const typedJobs = jobs.items.map((row) => ({ id: String(row.id), recipientEmail: String(row.recipient_email), status: String(row.status), attempts: Number(row.attempts), maxAttempts: Number(row.max_attempts), nextAttemptAt: row.next_attempt_at ? new Date(row.next_attempt_at as string | Date).toISOString() : null, lastError: row.last_error ? String(row.last_error) : null, sentAt: row.sent_at ? new Date(row.sent_at as string | Date).toISOString() : null, createdAt: new Date(row.created_at as string | Date).toISOString(), issueNo: Number(row.issue_no), prizeName: String(row.prize_name) }));
  const typedRules = rules.map((row) => ({ id: String(row.id), rule_type: String(row.rule_type), value: String(row.value), enabled: Boolean(row.enabled) }));
  return <main className="mx-auto w-full max-w-[1280px] px-5 py-7 sm:px-7 lg:px-9 lg:py-9"><PageHeader title="邮件配置" /><EmailManagement initialSmtp={typedSmtp} initialTemplates={typedTemplates} initialJobs={typedJobs} initialRules={typedRules} queueTotal={jobs.total} initialTab={tab} highlightJobId={jobs.highlightedJobId} /></main>;
}
