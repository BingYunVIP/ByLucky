export const FACE_VALUES = [1, 5, 10, 20, 50, 100] as const;
export type FaceValue = (typeof FACE_VALUES)[number];

export const DRAW_METHODS = ["FACE_VALUE_PRIORITY", "CODE_EQUAL"] as const;
export type DrawMethod = (typeof DRAW_METHODS)[number];

export const CAMPAIGN_STATUSES = [
  "DRAFT",
  "ACTIVE",
  "LOCKED",
  "DRAWING",
  "COMPLETED",
  "DRAW_FAILED",
  "ARCHIVED",
  "CANCELED",
] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

export const DRAW_TRIGGERS = [
  "PARTICIPANT_TARGET",
  "SCHEDULED",
  "MANUAL_ONLY",
] as const;
export type DrawTrigger = (typeof DRAW_TRIGGERS)[number];

export const PRIZE_ITEM_STATUSES = ["AVAILABLE", "AWARDED", "UNAWARDED"] as const;
export type PrizeItemStatus = (typeof PRIZE_ITEM_STATUSES)[number];

export const DRAW_TRIGGER_SOURCES = [
  "AUTO_TARGET",
  "AUTO_SCHEDULE",
  "ADMIN_MANUAL",
  "ADMIN_RETRY",
] as const;
export type DrawTriggerSource = (typeof DRAW_TRIGGER_SOURCES)[number];

export const DRAW_RUN_STATUSES = ["RUNNING", "SUCCEEDED", "FAILED"] as const;
export type DrawRunStatus = (typeof DRAW_RUN_STATUSES)[number];

export const DOMAIN_RULE_TYPES = ["EXACT", "WILDCARD_SUFFIX"] as const;
export type DomainRuleType = (typeof DOMAIN_RULE_TYPES)[number];

export const SMTP_PROVIDERS = ["QQ", "CUSTOM"] as const;
export type SmtpProvider = (typeof SMTP_PROVIDERS)[number];

export const SMTP_SECURITY_MODES = ["TLS", "STARTTLS", "NONE"] as const;
export type SmtpSecurityMode = (typeof SMTP_SECURITY_MODES)[number];

export const EMAIL_JOB_STATUSES = ["PENDING", "SENDING", "SENT", "FAILED"] as const;
export type EmailJobStatus = (typeof EMAIL_JOB_STATUSES)[number];

export const SYSTEM_JOB_TYPES = ["DRAW_CAMPAIGN", "CLEANUP_CAMPAIGN_CODES"] as const;
export type SystemJobType = (typeof SYSTEM_JOB_TYPES)[number];

export const SYSTEM_JOB_STATUSES = ["PENDING", "RUNNING", "SUCCEEDED", "FAILED"] as const;
export type SystemJobStatus = (typeof SYSTEM_JOB_STATUSES)[number];

export const ACTOR_TYPES = ["ADMIN", "SYSTEM"] as const;
export type ActorType = (typeof ACTOR_TYPES)[number];

export const RATE_LIMIT_SCOPES = ["LOGIN", "PARTICIPATION"] as const;
export type RateLimitScope = (typeof RATE_LIMIT_SCOPES)[number];
