import "server-only";

import nodemailer from "nodemailer";
import { z } from "zod";
import { getSqlClient } from "@/db/client";
import { decryptSensitiveText, encryptSensitiveText } from "@/server/crypto/sensitive";
import { BusinessError } from "./errors";

export const settingsInputSchema = z.object({
  timezone: z.string().trim().min(1).max(80),
  defaultTargetUniqueEmails: z.number().int().min(1).max(1_000_000),
  defaultMinCodeFaceValue: z.number().int().refine((value) => [1, 5, 10, 20, 50, 100].includes(value)),
  defaultDrawMethod: z.enum(["FACE_VALUE_PRIORITY", "CODE_EQUAL"]),
  defaultWinnerCooldownPeriods: z.number().int().min(0).max(1000),
  defaultCleanupDelayMinutes: z.number().int().min(0).max(525_600),
  rejectPlusAlias: z.boolean(),
  gmailDotNormalization: z.boolean(),
});

export const domainRuleInputSchema = z.object({
  ruleType: z.enum(["EXACT", "WILDCARD_SUFFIX"]),
  value: z.string().trim().min(3).max(255),
  enabled: z.boolean().default(true),
});

export const smtpInputSchema = z.object({
  provider: z.enum(["QQ", "CUSTOM"]),
  host: z.string().trim().min(1).max(255),
  port: z.number().int().min(1).max(65_535),
  security: z.enum(["TLS", "STARTTLS", "NONE"]),
  username: z.string().trim().min(1).max(255),
  password: z.string().max(4096).optional(),
  fromEmail: z.string().trim().email().max(255),
  fromName: z.string().trim().min(1).max(255),
  enabled: z.boolean(),
});

export const smtpTestInputSchema = z.object({
  recipientEmail: z.string().trim().email().max(255),
  smtp: smtpInputSchema,
});

export const emailTemplateInputSchema = z.object({
  subjectTemplate: z.string().min(1).max(1000),
  textTemplate: z.string().min(1).max(50_000),
  htmlTemplate: z.string().max(100_000).nullable().optional(),
  enabled: z.boolean().default(true),
});

const allowedTemplateVariables = new Set([
  "winner_email",
  "campaign_name",
  "issue_no",
  "prize_level",
  "prize_public_name",
  "prize_content",
  "draw_time",
]);

function toNumber(value: number | string | null | undefined) {
  return typeof value === "number" ? value : Number(value ?? 0);
}

function normalizeDomainValue(ruleType: "EXACT" | "WILDCARD_SUFFIX", value: string) {
  const normalized = value.toLowerCase().replace(/^\.+/, "");
  if (ruleType === "WILDCARD_SUFFIX") return normalized.replace(/^\*\./, "");
  return normalized;
}

function validateTemplateVariables(value: string) {
  for (const match of value.matchAll(/\{\{\s*([a-z_]+)\s*\}\}/g)) {
    if (!allowedTemplateVariables.has(match[1])) {
      throw new BusinessError("UNKNOWN_TEMPLATE_VARIABLE", `邮件模板变量 ${match[1]} 不受支持。`, 400);
    }
  }
}

export async function getSettingsData() {
  const sql = getSqlClient();
  const [row] = await sql<Record<string, unknown>[]>`
    select id, timezone, default_target_unique_emails, default_min_code_face_value,
      default_draw_method, default_winner_cooldown_periods, default_cleanup_delay_minutes,
      reject_plus_alias, gmail_dot_normalization, updated_at
    from app_settings where id = 1
  `;
  return row ?? null;
}

export async function updateSettings(input: z.infer<typeof settingsInputSchema>) {
  const sql = getSqlClient();
  const [row] = await sql<Record<string, unknown>[]>`
    update app_settings set
      timezone = ${input.timezone},
      default_target_unique_emails = ${input.defaultTargetUniqueEmails},
      default_min_code_face_value = ${input.defaultMinCodeFaceValue},
      default_draw_method = ${input.defaultDrawMethod},
      default_winner_cooldown_periods = ${input.defaultWinnerCooldownPeriods},
      default_cleanup_delay_minutes = ${input.defaultCleanupDelayMinutes},
      reject_plus_alias = ${input.rejectPlusAlias},
      gmail_dot_normalization = ${input.gmailDotNormalization},
      updated_at = now()
    where id = 1
    returning id, timezone, default_target_unique_emails, default_min_code_face_value,
      default_draw_method, default_winner_cooldown_periods, default_cleanup_delay_minutes,
      reject_plus_alias, gmail_dot_normalization, updated_at
  `;
  return row ?? null;
}

export async function listEmailDomainRules() {
  const sql = getSqlClient();
  return sql<Record<string, unknown>[]>`
    select id, rule_type, value, enabled, created_at
    from email_domain_rules order by value
  `;
}

export async function createEmailDomainRule(input: z.infer<typeof domainRuleInputSchema>) {
  const value = normalizeDomainValue(input.ruleType, input.value);
  const sql = getSqlClient();
  try {
    const [row] = await sql<Record<string, unknown>[]>`
      insert into email_domain_rules (rule_type, value, enabled)
      values (${input.ruleType}, ${value}, ${input.enabled})
      returning id, rule_type, value, enabled, created_at
    `;
    return row;
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && (error as { code?: unknown }).code === "23505") {
      throw new BusinessError("DOMAIN_RULE_EXISTS", "该邮箱域名规则已经存在。", 409);
    }
    throw error;
  }
}

export async function updateEmailDomainRule(id: string, enabled: boolean) {
  const sql = getSqlClient();
  const [row] = await sql<Record<string, unknown>[]>`
    update email_domain_rules set enabled = ${enabled}
    where id = ${id}
    returning id, rule_type, value, enabled, created_at
  `;
  if (!row) throw new BusinessError("DOMAIN_RULE_NOT_FOUND", "邮箱域名规则不存在。", 404);
  return row;
}

export async function deleteEmailDomainRule(id: string) {
  const sql = getSqlClient();
  const rows = await sql<Record<string, unknown>[]>`
    delete from email_domain_rules where id = ${id} returning id
  `;
  if (!rows[0]) throw new BusinessError("DOMAIN_RULE_NOT_FOUND", "邮箱域名规则不存在。", 404);
}

export async function getSmtpConfig() {
  const sql = getSqlClient();
  const [row] = await sql<Record<string, unknown>[]>`
    select id, provider, host, port, security, username, from_email, from_name,
      enabled, last_test_at, last_test_ok, last_test_error, updated_at,
      (password_ciphertext <> '') as password_configured
    from smtp_config where id = 1
  `;
  return row ?? null;
}

export async function updateSmtpConfig(input: z.infer<typeof smtpInputSchema>) {
  const sql = getSqlClient();
  const [existing] = await sql<{ password_ciphertext: string }[]>`
    select password_ciphertext from smtp_config where id = 1
  `;
  const passwordCiphertext =
    input.password !== undefined
      ? encryptSensitiveText(input.password)
      : existing?.password_ciphertext ?? encryptSensitiveText("");
  const [row] = await sql<Record<string, unknown>[]>`
    insert into smtp_config (
      id, provider, host, port, security, username, password_ciphertext,
      from_email, from_name, enabled, updated_at
    ) values (
      1, ${input.provider}, ${input.host}, ${input.port}, ${input.security},
      ${input.username}, ${passwordCiphertext}, ${input.fromEmail}, ${input.fromName},
      ${input.enabled}, now()
    )
    on conflict (id) do update set
      provider = excluded.provider, host = excluded.host, port = excluded.port,
      security = excluded.security, username = excluded.username,
      password_ciphertext = excluded.password_ciphertext,
      from_email = excluded.from_email, from_name = excluded.from_name,
      enabled = excluded.enabled, updated_at = now()
    returning id, provider, host, port, security, username, from_email, from_name,
      enabled, last_test_at, last_test_ok, last_test_error, updated_at,
      (password_ciphertext <> '') as password_configured
  `;
  return row;
}

function smtpTestFailureMessage(error: unknown) {
  const detail = error as { code?: string; responseCode?: number; message?: string } | null;
  if (detail?.code === "EAUTH") return "认证失败，请检查 SMTP 用户名和授权码。";
  if (["ETIMEDOUT", "ESOCKET", "ECONNREFUSED", "ENOTFOUND", "ECONNECTION"].includes(detail?.code ?? "")) {
    return "连接超时或无法连接 SMTP 服务器，请检查主机、端口和网络。";
  }
  if ((detail?.responseCode ?? 0) >= 400 || detail?.code === "EENVELOPE") {
    return "SMTP 服务器拒绝了测试邮件，请检查发件人与收件邮箱。";
  }
  return "SMTP 服务器暂时无法发送测试邮件，请稍后再试。";
}

async function recordSmtpTestResult(ok: boolean, errorMessage: string | null) {
  const sql = getSqlClient();
  await sql`
    update smtp_config
    set last_test_at = now(), last_test_ok = ${ok}, last_test_error = ${errorMessage}
    where id = 1
  `;
}

export async function sendSmtpTestEmail(input: z.infer<typeof smtpTestInputSchema>) {
  const sql = getSqlClient();
  let password = input.smtp.password;
  if (password === undefined) {
    const [stored] = await sql<{ password_ciphertext: string }[]>`
      select password_ciphertext from smtp_config where id = 1
    `;
    if (!stored?.password_ciphertext) {
      throw new BusinessError("SMTP_PASSWORD_REQUIRED", "请先填写完整 SMTP 配置。", 400);
    }
    password = decryptSensitiveText(stored.password_ciphertext);
  }
  if (!password) throw new BusinessError("SMTP_PASSWORD_REQUIRED", "请先填写完整 SMTP 配置。", 400);

  const transport = nodemailer.createTransport({
    host: input.smtp.host,
    port: input.smtp.port,
    secure: input.smtp.security === "TLS",
    requireTLS: input.smtp.security === "STARTTLS",
    ignoreTLS: input.smtp.security === "NONE",
    auth: { user: input.smtp.username, pass: password },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
    disableFileAccess: true,
    disableUrlAccess: true,
  });

  try {
    await transport.sendMail({
      from: { name: input.smtp.fromName, address: input.smtp.fromEmail },
      to: input.recipientEmail,
      subject: "ByLucky SMTP 测试邮件",
      text: "如果你收到这封邮件，说明 ByLucky 邮件发送配置正常。",
    });
    await recordSmtpTestResult(true, null);
    return { sent: true };
  } catch (error) {
    const message = smtpTestFailureMessage(error);
    await recordSmtpTestResult(false, message);
    throw new BusinessError("SMTP_TEST_FAILED", message, 502);
  } finally {
    transport.close();
  }
}

export async function listEmailTemplates() {
  const sql = getSqlClient();
  return sql<Record<string, unknown>[]>`
    select id, template_key, subject_template, text_template, html_template, enabled, updated_at
    from email_templates order by template_key
  `;
}

export async function updateEmailTemplate(
  key: string,
  input: z.infer<typeof emailTemplateInputSchema>,
) {
  validateTemplateVariables(input.subjectTemplate);
  validateTemplateVariables(input.textTemplate);
  if (input.htmlTemplate) validateTemplateVariables(input.htmlTemplate);
  const sql = getSqlClient();
  const [row] = await sql<Record<string, unknown>[]>`
    insert into email_templates (
      template_key, subject_template, text_template, html_template, enabled, updated_at
    ) values (
      ${key}, ${input.subjectTemplate}, ${input.textTemplate}, ${input.htmlTemplate ?? null},
      ${input.enabled}, now()
    )
    on conflict (template_key) do update set
      subject_template = excluded.subject_template,
      text_template = excluded.text_template,
      html_template = excluded.html_template,
      enabled = excluded.enabled,
      updated_at = now()
    returning id, template_key, subject_template, text_template, html_template, enabled, updated_at
  `;
  return row;
}

export async function listEmailJobs(page = 1, highlightJobId?: string) {
  const sql = getSqlClient();
  const safePage = Math.max(1, page);
  const offset = (safePage - 1) * 25;
  const safeHighlightJobId = typeof highlightJobId === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(highlightJobId)
    ? highlightJobId
    : null;
  const [rows, countRows, highlightedRows] = await Promise.all([
    sql<Record<string, unknown>[]>`
      select email_jobs.id, email_jobs.recipient_email, email_jobs.status,
        email_jobs.attempts, email_jobs.max_attempts, email_jobs.next_attempt_at,
        email_jobs.last_error, email_jobs.sent_at, email_jobs.created_at,
        campaigns.issue_no, prize_tiers.name as prize_name
      from email_jobs
      join winners on winners.id = email_jobs.winner_id
      join campaigns on campaigns.id = winners.campaign_id
      join prize_tiers on prize_tiers.id = winners.prize_tier_id
      order by email_jobs.created_at desc limit 25 offset ${offset}
    `,
    sql<{ count: number | string }[]>`select count(*) as count from email_jobs`,
    safeHighlightJobId
      ? sql<Record<string, unknown>[]>`
          select email_jobs.id, email_jobs.recipient_email, email_jobs.status,
            email_jobs.attempts, email_jobs.max_attempts, email_jobs.next_attempt_at,
            email_jobs.last_error, email_jobs.sent_at, email_jobs.created_at,
            campaigns.issue_no, prize_tiers.name as prize_name
          from email_jobs
          join winners on winners.id = email_jobs.winner_id
          join campaigns on campaigns.id = winners.campaign_id
          join prize_tiers on prize_tiers.id = winners.prize_tier_id
          where email_jobs.id = ${safeHighlightJobId}
        `
      : Promise.resolve([] as Record<string, unknown>[]),
  ]);
  const highlighted = highlightedRows[0];
  const items = highlighted && !rows.some((row) => String(row.id) === String(highlighted.id))
    ? [highlighted, ...rows.slice(0, 24)]
    : rows;
  return {
    page: safePage,
    pageSize: 25,
    total: toNumber(countRows[0]?.count),
    items,
    highlightedJobId: highlighted ? String(highlighted.id) : null,
  };
}

export async function retryEmailJob(id: string) {
  const sql = getSqlClient();
  const [row] = await sql<Record<string, unknown>[]>`
    update email_jobs
    set status = 'PENDING', next_attempt_at = now(), locked_at = null,
      locked_by = null, last_error = null, updated_at = now()
    where id = ${id} and status in ('FAILED', 'PENDING')
    returning id, status, next_attempt_at
  `;
  if (!row) throw new BusinessError("EMAIL_JOB_NOT_FOUND", "邮件任务不存在或不可重试。", 404);
  return row;
}
