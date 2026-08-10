import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  customType,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type {
  ActorType,
  CampaignStatus,
  DomainRuleType,
  DrawMethod,
  DrawRunStatus,
  DrawTrigger,
  DrawTriggerSource,
  EmailJobStatus,
  FaceValue,
  PrizeItemStatus,
  RateLimitScope,
  SmtpProvider,
  SmtpSecurityMode,
  SystemJobStatus,
  SystemJobType,
} from "./types";

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return "bytea";
  },
});

const faceValueCheck = (column: unknown) =>
  sql`${column} in (1, 5, 10, 20, 50, 100)`;

export const appSettings = pgTable(
  "app_settings",
  {
    id: smallint("id").primaryKey().default(1),
    timezone: text("timezone").notNull().default("Asia/Shanghai"),
    defaultTargetUniqueEmails: integer("default_target_unique_emails")
      .notNull()
      .default(40),
    defaultMinCodeFaceValue: smallint("default_min_code_face_value")
      .$type<FaceValue>()
      .notNull()
      .default(1),
    defaultDrawMethod: text("default_draw_method")
      .$type<DrawMethod>()
      .notNull()
      .default("FACE_VALUE_PRIORITY"),
    defaultWinnerCooldownPeriods: integer("default_winner_cooldown_periods")
      .notNull()
      .default(3),
    defaultCleanupDelayMinutes: integer("default_cleanup_delay_minutes")
      .notNull()
      .default(60),
    rejectPlusAlias: boolean("reject_plus_alias").notNull().default(true),
    gmailDotNormalization: boolean("gmail_dot_normalization")
      .notNull()
      .default(true),
    publicShowProgress: boolean("public_show_progress").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("app_settings_single_row_check", sql`${table.id} = 1`),
    check(
      "app_settings_target_positive_check",
      sql`${table.defaultTargetUniqueEmails} > 0`,
    ),
    check(
      "app_settings_face_value_check",
      faceValueCheck(table.defaultMinCodeFaceValue),
    ),
    check(
      "app_settings_draw_method_check",
      sql`${table.defaultDrawMethod} in ('FACE_VALUE_PRIORITY', 'CODE_EQUAL')`,
    ),
    check(
      "app_settings_cooldown_nonnegative_check",
      sql`${table.defaultWinnerCooldownPeriods} >= 0`,
    ),
    check(
      "app_settings_cleanup_nonnegative_check",
      sql`${table.defaultCleanupDelayMinutes} >= 0`,
    ),
  ],
);

export const adminSessions = pgTable(
  "admin_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tokenHash: bytea("token_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    ipHash: bytea("ip_hash"),
    userAgent: text("user_agent"),
  },
  (table) => [
    uniqueIndex("admin_sessions_token_hash_unique").on(table.tokenHash),
    index("admin_sessions_expires_at_idx").on(table.expiresAt),
  ],
);

export const campaigns = pgTable(
  "campaigns",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    issueNo: serial("issue_no").notNull(),
    name: text("name").notNull(),
    status: text("status").$type<CampaignStatus>().notNull().default("DRAFT"),
    targetUniqueEmails: integer("target_unique_emails").notNull(),
    minCodeFaceValue: smallint("min_code_face_value").$type<FaceValue>().notNull(),
    drawMethod: text("draw_method").$type<DrawMethod>().notNull(),
    drawTrigger: text("draw_trigger").$type<DrawTrigger>().notNull(),
    drawAt: timestamp("draw_at", { withTimezone: true }),
    winnerCooldownPeriods: integer("winner_cooldown_periods").notNull(),
    cleanupDelayMinutes: integer("cleanup_delay_minutes").notNull(),
    timezone: text("timezone").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("campaigns_issue_no_unique").on(table.issueNo),
    uniqueIndex("campaigns_single_running_unique")
      .on(sql`(true)`)
      .where(sql`${table.status} in ('ACTIVE', 'LOCKED', 'DRAWING')`),
    index("campaigns_status_idx").on(table.status),
    index("campaigns_scheduled_due_idx")
      .on(table.drawAt)
      .where(
        sql`${table.status} = 'ACTIVE' and ${table.drawTrigger} = 'SCHEDULED'`,
      ),
    check(
      "campaigns_status_check",
      sql`${table.status} in ('DRAFT', 'ACTIVE', 'LOCKED', 'DRAWING', 'COMPLETED', 'DRAW_FAILED', 'ARCHIVED', 'CANCELED')`,
    ),
    check("campaigns_target_positive_check", sql`${table.targetUniqueEmails} > 0`),
    check("campaigns_face_value_check", faceValueCheck(table.minCodeFaceValue)),
    check(
      "campaigns_draw_method_check",
      sql`${table.drawMethod} in ('FACE_VALUE_PRIORITY', 'CODE_EQUAL')`,
    ),
    check(
      "campaigns_draw_trigger_check",
      sql`${table.drawTrigger} in ('PARTICIPANT_TARGET', 'SCHEDULED', 'MANUAL_ONLY')`,
    ),
    check(
      "campaigns_scheduled_draw_at_check",
      sql`${table.drawTrigger} <> 'SCHEDULED' or ${table.drawAt} is not null`,
    ),
    check(
      "campaigns_cooldown_nonnegative_check",
      sql`${table.winnerCooldownPeriods} >= 0`,
    ),
    check(
      "campaigns_cleanup_nonnegative_check",
      sql`${table.cleanupDelayMinutes} >= 0`,
    ),
  ],
);

export const prizeTiers = pgTable(
  "prize_tiers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    publicDescription: text("public_description").notNull(),
    rawContentCiphertext: text("raw_content_ciphertext"),
    sortOrder: integer("sort_order").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("prize_tiers_campaign_sort_idx").on(table.campaignId, table.sortOrder),
    check("prize_tiers_sort_nonnegative_check", sql`${table.sortOrder} >= 0`),
  ],
);

export const prizeItems = pgTable(
  "prize_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    prizeTierId: uuid("prize_tier_id")
      .notNull()
      .references(() => prizeTiers.id, { onDelete: "cascade" }),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    sequenceNo: integer("sequence_no").notNull(),
    contentCiphertext: text("content_ciphertext").notNull(),
    status: text("status")
      .$type<PrizeItemStatus>()
      .notNull()
      .default("AVAILABLE"),
    unawardedReason: text("unawarded_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("prize_items_tier_sequence_unique").on(
      table.prizeTierId,
      table.sequenceNo,
    ),
    index("prize_items_campaign_status_idx").on(table.campaignId, table.status),
    check("prize_items_sequence_positive_check", sql`${table.sequenceNo} > 0`),
    check(
      "prize_items_status_check",
      sql`${table.status} in ('AVAILABLE', 'AWARDED', 'UNAWARDED')`,
    ),
  ],
);

export const campaignParticipants = pgTable(
  "campaign_participants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    originalEmail: text("original_email").notNull(),
    canonicalEmail: text("canonical_email").notNull(),
    codeCount: integer("code_count").notNull().default(0),
    totalFaceValue: integer("total_face_value").notNull().default(0),
    firstSubmittedAt: timestamp("first_submitted_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastSubmittedAt: timestamp("last_submitted_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("campaign_participants_campaign_email_unique").on(
      table.campaignId,
      table.canonicalEmail,
    ),
    index("campaign_participants_campaign_value_idx").on(
      table.campaignId,
      table.totalFaceValue,
    ),
    check("campaign_participants_code_count_check", sql`${table.codeCount} >= 0`),
    check(
      "campaign_participants_total_value_check",
      sql`${table.totalFaceValue} >= 0`,
    ),
  ],
);

export const campaignCodes = pgTable(
  "campaign_codes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    codeHash: bytea("code_hash").notNull(),
    faceValue: smallint("face_value").$type<FaceValue>().notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    usedByParticipantId: uuid("used_by_participant_id").references(
      () => campaignParticipants.id,
    ),
    importedAt: timestamp("imported_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("campaign_codes_campaign_hash_unique").on(
      table.campaignId,
      table.codeHash,
    ),
    index("campaign_codes_campaign_used_idx").on(table.campaignId, table.usedAt),
    index("campaign_codes_campaign_value_used_idx").on(
      table.campaignId,
      table.faceValue,
      table.usedAt,
    ),
    index("campaign_codes_hash_idx").on(table.codeHash),
    check("campaign_codes_face_value_check", faceValueCheck(table.faceValue)),
    check(
      "campaign_codes_use_pair_check",
      sql`(${table.usedAt} is null and ${table.usedByParticipantId} is null) or (${table.usedAt} is not null and ${table.usedByParticipantId} is not null)`,
    ),
  ],
);

export const usedCodes = pgTable(
  "used_codes",
  {
    codeHash: bytea("code_hash").primaryKey(),
    faceValue: smallint("face_value").$type<FaceValue>().notNull(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id),
    participantId: uuid("participant_id")
      .notNull()
      .references(() => campaignParticipants.id),
    usedAt: timestamp("used_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("used_codes_campaign_idx").on(table.campaignId),
    index("used_codes_participant_idx").on(table.participantId),
    check("used_codes_face_value_check", faceValueCheck(table.faceValue)),
  ],
);

export const drawRuns = pgTable(
  "draw_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id),
    attemptNo: integer("attempt_no").notNull(),
    triggerSource: text("trigger_source").$type<DrawTriggerSource>().notNull(),
    algorithm: text("algorithm").$type<DrawMethod>().notNull(),
    algorithmVersion: text("algorithm_version").notNull(),
    status: text("status").$type<DrawRunStatus>().notNull(),
    participantCount: integer("participant_count").notNull(),
    eligibleCount: integer("eligible_count").notNull(),
    usedCodeCount: integer("used_code_count").notNull(),
    prizeItemCount: integer("prize_item_count").notNull(),
    winnerCount: integer("winner_count").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
  },
  (table) => [
    index("draw_runs_campaign_attempt_idx").on(table.campaignId, table.attemptNo),
    check("draw_runs_attempt_positive_check", sql`${table.attemptNo} > 0`),
    check(
      "draw_runs_trigger_source_check",
      sql`${table.triggerSource} in ('AUTO_TARGET', 'AUTO_SCHEDULE', 'ADMIN_MANUAL', 'ADMIN_RETRY')`,
    ),
    check(
      "draw_runs_algorithm_check",
      sql`${table.algorithm} in ('FACE_VALUE_PRIORITY', 'CODE_EQUAL')`,
    ),
    check(
      "draw_runs_status_check",
      sql`${table.status} in ('RUNNING', 'SUCCEEDED', 'FAILED')`,
    ),
    check(
      "draw_runs_counts_nonnegative_check",
      sql`${table.participantCount} >= 0 and ${table.eligibleCount} >= 0 and ${table.usedCodeCount} >= 0 and ${table.prizeItemCount} >= 0 and ${table.winnerCount} >= 0`,
    ),
  ],
);

export const winners = pgTable(
  "winners",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id),
    drawRunId: uuid("draw_run_id")
      .notNull()
      .references(() => drawRuns.id),
    participantId: uuid("participant_id")
      .notNull()
      .references(() => campaignParticipants.id),
    prizeTierId: uuid("prize_tier_id")
      .notNull()
      .references(() => prizeTiers.id),
    prizeItemId: uuid("prize_item_id")
      .notNull()
      .references(() => prizeItems.id),
    originalEmailSnapshot: text("original_email_snapshot").notNull(),
    canonicalEmailSnapshot: text("canonical_email_snapshot").notNull(),
    totalFaceValueSnapshot: integer("total_face_value_snapshot").notNull(),
    codeCountSnapshot: integer("code_count_snapshot").notNull(),
    wonAt: timestamp("won_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("winners_prize_item_unique").on(table.prizeItemId),
    uniqueIndex("winners_campaign_participant_unique").on(
      table.campaignId,
      table.participantId,
    ),
    index("winners_campaign_won_at_idx").on(table.campaignId, table.wonAt),
    uniqueIndex("winners_campaign_email_unique").on(
      table.campaignId,
      table.canonicalEmailSnapshot,
    ),
    check(
      "winners_snapshots_nonnegative_check",
      sql`${table.totalFaceValueSnapshot} >= 0 and ${table.codeCountSnapshot} >= 0`,
    ),
  ],
);

export const emailDomainRules = pgTable(
  "email_domain_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ruleType: text("rule_type").$type<DomainRuleType>().notNull(),
    value: text("value").notNull(),
    enabled: boolean("enabled").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("email_domain_rules_type_value_unique").on(
      table.ruleType,
      table.value,
    ),
    check(
      "email_domain_rules_type_check",
      sql`${table.ruleType} in ('EXACT', 'WILDCARD_SUFFIX')`,
    ),
  ],
);

export const smtpConfig = pgTable(
  "smtp_config",
  {
    id: smallint("id").primaryKey().default(1),
    provider: text("provider").$type<SmtpProvider>().notNull(),
    host: text("host").notNull(),
    port: integer("port").notNull(),
    security: text("security").$type<SmtpSecurityMode>().notNull(),
    username: text("username").notNull(),
    passwordCiphertext: text("password_ciphertext").notNull(),
    fromEmail: text("from_email").notNull(),
    fromName: text("from_name").notNull(),
    enabled: boolean("enabled").notNull().default(false),
    lastTestAt: timestamp("last_test_at", { withTimezone: true }),
    lastTestOk: boolean("last_test_ok"),
    lastTestError: text("last_test_error"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("smtp_config_single_row_check", sql`${table.id} = 1`),
    check("smtp_config_provider_check", sql`${table.provider} in ('QQ', 'CUSTOM')`),
    check(
      "smtp_config_security_check",
      sql`${table.security} in ('TLS', 'STARTTLS', 'NONE')`,
    ),
    check("smtp_config_port_check", sql`${table.port} > 0 and ${table.port} <= 65535`),
  ],
);

export const emailTemplates = pgTable(
  "email_templates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    templateKey: text("template_key").notNull(),
    subjectTemplate: text("subject_template").notNull(),
    textTemplate: text("text_template").notNull(),
    htmlTemplate: text("html_template"),
    enabled: boolean("enabled").notNull().default(true),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("email_templates_key_unique").on(table.templateKey),
  ],
);

export const emailJobs = pgTable(
  "email_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    winnerId: uuid("winner_id")
      .notNull()
      .references(() => winners.id),
    recipientEmail: text("recipient_email").notNull(),
    status: text("status").$type<EmailJobStatus>().notNull().default("PENDING"),
    renderedSubject: text("rendered_subject").notNull(),
    renderedTextCiphertext: text("rendered_text_ciphertext").notNull(),
    renderedHtmlCiphertext: text("rendered_html_ciphertext"),
    attempts: integer("attempts").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(3),
    nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    lockedBy: text("locked_by"),
    lastError: text("last_error"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("email_jobs_winner_unique").on(table.winnerId),
    index("email_jobs_status_next_attempt_idx").on(table.status, table.nextAttemptAt),
    check(
      "email_jobs_status_check",
      sql`${table.status} in ('PENDING', 'SENDING', 'SENT', 'FAILED')`,
    ),
    check(
      "email_jobs_attempts_check",
      sql`${table.attempts} >= 0 and ${table.maxAttempts} > 0 and ${table.attempts} <= ${table.maxAttempts}`,
    ),
  ],
);

export const systemJobs = pgTable(
  "system_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    type: text("type").$type<SystemJobType>().notNull(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id),
    drawTriggerSource: text("draw_trigger_source").$type<DrawTriggerSource>(),
    status: text("status").$type<SystemJobStatus>().notNull().default("PENDING"),
    availableAt: timestamp("available_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    attempts: integer("attempts").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(3),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    lockedBy: text("locked_by"),
    uniqueKey: text("unique_key").notNull(),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("system_jobs_unique_key_unique").on(table.uniqueKey),
    index("system_jobs_claim_idx").on(table.status, table.availableAt),
    check(
      "system_jobs_type_check",
      sql`${table.type} in ('DRAW_CAMPAIGN', 'CLEANUP_CAMPAIGN_CODES')`,
    ),
    check(
      "system_jobs_status_check",
      sql`${table.status} in ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED')`,
    ),
    check(
      "system_jobs_attempts_check",
      sql`${table.attempts} >= 0 and ${table.maxAttempts} > 0 and ${table.attempts} <= ${table.maxAttempts}`,
    ),
    check(
      "system_jobs_draw_source_check",
      sql`(${table.type} = 'DRAW_CAMPAIGN' and ${table.drawTriggerSource} in ('AUTO_TARGET', 'AUTO_SCHEDULE', 'ADMIN_MANUAL', 'ADMIN_RETRY')) or (${table.type} = 'CLEANUP_CAMPAIGN_CODES' and ${table.drawTriggerSource} is null)`,
    ),
  ],
);

export const operationLogs = pgTable(
  "operation_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorType: text("actor_type").$type<ActorType>().notNull(),
    action: text("action").notNull(),
    entityType: text("entity_type"),
    entityId: text("entity_id"),
    ipHash: bytea("ip_hash"),
    userAgent: text("user_agent"),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("operation_logs_created_at_idx").on(table.createdAt),
    index("operation_logs_action_idx").on(table.action),
    check(
      "operation_logs_actor_type_check",
      sql`${table.actorType} in ('ADMIN', 'SYSTEM')`,
    ),
  ],
);

export const securityRateLimits = pgTable(
  "security_rate_limits",
  {
    bucketKey: text("bucket_key").primaryKey(),
    scope: text("scope").$type<RateLimitScope>().notNull(),
    windowStartedAt: timestamp("window_started_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    counter: integer("counter").notNull().default(0),
    blockedUntil: timestamp("blocked_until", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("security_rate_limits_blocked_until_idx").on(table.blockedUntil),
    check(
      "security_rate_limits_scope_check",
      sql`${table.scope} in ('LOGIN', 'PARTICIPATION')`,
    ),
    check("security_rate_limits_counter_check", sql`${table.counter} >= 0`),
  ],
);

export const workerHeartbeats = pgTable(
  "worker_heartbeats",
  {
    workerId: text("worker_id").primaryKey(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    version: text("version").notNull(),
  },
  (table) => [index("worker_heartbeats_last_seen_idx").on(table.lastSeenAt)],
);

export * from "./types";
