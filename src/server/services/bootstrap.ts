import { getDb } from "@/db/client";
import { appSettings, emailDomainRules, emailTemplates } from "@/db/schema";

const defaultDomainRules = [
  { ruleType: "EXACT" as const, value: "qq.com" },
  { ruleType: "EXACT" as const, value: "gmail.com" },
  { ruleType: "EXACT" as const, value: "163.com" },
  { ruleType: "WILDCARD_SUFFIX" as const, value: "edu.cn" },
];

export async function ensureBootstrapDefaults() {
  const db = getDb();
  await db.insert(appSettings).values({ id: 1 }).onConflictDoNothing();
  await db
    .insert(emailDomainRules)
    .values(defaultDomainRules)
    .onConflictDoNothing();
  await db
    .insert(emailTemplates)
    .values({
      templateKey: "WINNER_NOTICE",
      subjectTemplate: "恭喜您获得 {{campaign_name}} {{prize_level}}",
      textTemplate:
        "您好 {{winner_email}}，恭喜您在第 {{issue_no}} 期 {{campaign_name}} 中获得 {{prize_level}}（{{prize_public_name}}）。\n\n获奖内容：\n{{prize_content}}\n\n开奖时间：{{draw_time}}",
      htmlTemplate: null,
      enabled: true,
    })
    .onConflictDoNothing();
}
