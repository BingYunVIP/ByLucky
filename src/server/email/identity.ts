import type { DomainRuleType } from "@/db/schema";
import { BusinessError } from "@/server/services/errors";

export type EmailIdentitySettings = {
  rejectPlusAlias: boolean;
  gmailDotNormalization: boolean;
};

export type EmailDomainRule = {
  ruleType: DomainRuleType;
  value: string;
  enabled: boolean;
};

export type EmailIdentity = {
  originalEmail: string;
  canonicalEmail: string;
  domain: string;
};

const basicEmailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function canonicalizeEmail(
  emailInput: string,
  settings: EmailIdentitySettings,
): EmailIdentity {
  const originalEmail = emailInput.trim();
  if (!basicEmailPattern.test(originalEmail)) {
    throw new BusinessError("INVALID_EMAIL", "邮箱格式不正确。", 400);
  }

  const atIndex = originalEmail.lastIndexOf("@");
  const localPart = originalEmail.slice(0, atIndex).toLowerCase();
  const domain = originalEmail.slice(atIndex + 1).toLowerCase();
  if (!localPart || !domain) {
    throw new BusinessError("INVALID_EMAIL", "邮箱格式不正确。", 400);
  }
  if (settings.rejectPlusAlias && localPart.includes("+")) {
    throw new BusinessError("EMAIL_ALIAS_NOT_ALLOWED", "请使用不含邮箱别名的地址。", 400);
  }

  const canonicalLocal =
    domain === "gmail.com" && settings.gmailDotNormalization
      ? localPart.replaceAll(".", "")
      : localPart;

  return {
    originalEmail,
    canonicalEmail: `${canonicalLocal}@${domain}`,
    domain,
  };
}

export function isEmailDomainAllowed(domain: string, rules: EmailDomainRule[]) {
  return rules.some((rule) => {
    if (!rule.enabled) return false;
    const value = rule.value.toLowerCase();
    if (rule.ruleType === "EXACT") return domain === value;
    return domain.endsWith(`.${value}`);
  });
}
