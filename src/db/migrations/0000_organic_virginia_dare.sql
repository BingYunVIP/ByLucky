CREATE TABLE "admin_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token_hash" "bytea" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_hash" "bytea",
	"user_agent" text
);
--> statement-breakpoint
CREATE TABLE "app_settings" (
	"id" smallint PRIMARY KEY DEFAULT 1 NOT NULL,
	"timezone" text DEFAULT 'Asia/Shanghai' NOT NULL,
	"default_target_unique_emails" integer DEFAULT 40 NOT NULL,
	"default_min_code_face_value" smallint DEFAULT 1 NOT NULL,
	"default_draw_method" text DEFAULT 'FACE_VALUE_PRIORITY' NOT NULL,
	"default_winner_cooldown_periods" integer DEFAULT 3 NOT NULL,
	"default_cleanup_delay_minutes" integer DEFAULT 60 NOT NULL,
	"reject_plus_alias" boolean DEFAULT true NOT NULL,
	"gmail_dot_normalization" boolean DEFAULT true NOT NULL,
	"public_show_progress" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "app_settings_single_row_check" CHECK ("app_settings"."id" = 1),
	CONSTRAINT "app_settings_target_positive_check" CHECK ("app_settings"."default_target_unique_emails" > 0),
	CONSTRAINT "app_settings_face_value_check" CHECK ("app_settings"."default_min_code_face_value" in (1, 5, 10, 20, 50, 100)),
	CONSTRAINT "app_settings_draw_method_check" CHECK ("app_settings"."default_draw_method" in ('FACE_VALUE_PRIORITY', 'CODE_EQUAL')),
	CONSTRAINT "app_settings_cooldown_nonnegative_check" CHECK ("app_settings"."default_winner_cooldown_periods" >= 0),
	CONSTRAINT "app_settings_cleanup_nonnegative_check" CHECK ("app_settings"."default_cleanup_delay_minutes" >= 0)
);
--> statement-breakpoint
CREATE TABLE "campaign_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"code_hash" "bytea" NOT NULL,
	"face_value" smallint NOT NULL,
	"used_at" timestamp with time zone,
	"used_by_participant_id" uuid,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "campaign_codes_face_value_check" CHECK ("campaign_codes"."face_value" in (1, 5, 10, 20, 50, 100)),
	CONSTRAINT "campaign_codes_use_pair_check" CHECK (("campaign_codes"."used_at" is null and "campaign_codes"."used_by_participant_id" is null) or ("campaign_codes"."used_at" is not null and "campaign_codes"."used_by_participant_id" is not null))
);
--> statement-breakpoint
CREATE TABLE "campaign_participants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"original_email" text NOT NULL,
	"canonical_email" text NOT NULL,
	"code_count" integer DEFAULT 0 NOT NULL,
	"total_face_value" integer DEFAULT 0 NOT NULL,
	"first_submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "campaign_participants_code_count_check" CHECK ("campaign_participants"."code_count" >= 0),
	CONSTRAINT "campaign_participants_total_value_check" CHECK ("campaign_participants"."total_face_value" >= 0)
);
--> statement-breakpoint
CREATE TABLE "campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"issue_no" serial NOT NULL,
	"name" text NOT NULL,
	"status" text DEFAULT 'DRAFT' NOT NULL,
	"target_unique_emails" integer NOT NULL,
	"min_code_face_value" smallint NOT NULL,
	"draw_method" text NOT NULL,
	"draw_trigger" text NOT NULL,
	"draw_at" timestamp with time zone,
	"winner_cooldown_periods" integer NOT NULL,
	"cleanup_delay_minutes" integer NOT NULL,
	"timezone" text NOT NULL,
	"started_at" timestamp with time zone,
	"locked_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "campaigns_status_check" CHECK ("campaigns"."status" in ('DRAFT', 'ACTIVE', 'LOCKED', 'DRAWING', 'COMPLETED', 'DRAW_FAILED', 'ARCHIVED', 'CANCELED')),
	CONSTRAINT "campaigns_target_positive_check" CHECK ("campaigns"."target_unique_emails" > 0),
	CONSTRAINT "campaigns_face_value_check" CHECK ("campaigns"."min_code_face_value" in (1, 5, 10, 20, 50, 100)),
	CONSTRAINT "campaigns_draw_method_check" CHECK ("campaigns"."draw_method" in ('FACE_VALUE_PRIORITY', 'CODE_EQUAL')),
	CONSTRAINT "campaigns_draw_trigger_check" CHECK ("campaigns"."draw_trigger" in ('PARTICIPANT_TARGET', 'SCHEDULED', 'MANUAL_ONLY')),
	CONSTRAINT "campaigns_scheduled_draw_at_check" CHECK ("campaigns"."draw_trigger" <> 'SCHEDULED' or "campaigns"."draw_at" is not null),
	CONSTRAINT "campaigns_cooldown_nonnegative_check" CHECK ("campaigns"."winner_cooldown_periods" >= 0),
	CONSTRAINT "campaigns_cleanup_nonnegative_check" CHECK ("campaigns"."cleanup_delay_minutes" >= 0)
);
--> statement-breakpoint
CREATE TABLE "draw_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"attempt_no" integer NOT NULL,
	"trigger_source" text NOT NULL,
	"algorithm" text NOT NULL,
	"algorithm_version" text NOT NULL,
	"status" text NOT NULL,
	"participant_count" integer NOT NULL,
	"eligible_count" integer NOT NULL,
	"used_code_count" integer NOT NULL,
	"prize_item_count" integer NOT NULL,
	"winner_count" integer NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"error_code" text,
	"error_message" text,
	CONSTRAINT "draw_runs_attempt_positive_check" CHECK ("draw_runs"."attempt_no" > 0),
	CONSTRAINT "draw_runs_trigger_source_check" CHECK ("draw_runs"."trigger_source" in ('AUTO_TARGET', 'AUTO_SCHEDULE', 'ADMIN_MANUAL', 'ADMIN_RETRY')),
	CONSTRAINT "draw_runs_algorithm_check" CHECK ("draw_runs"."algorithm" in ('FACE_VALUE_PRIORITY', 'CODE_EQUAL')),
	CONSTRAINT "draw_runs_status_check" CHECK ("draw_runs"."status" in ('RUNNING', 'SUCCEEDED', 'FAILED')),
	CONSTRAINT "draw_runs_counts_nonnegative_check" CHECK ("draw_runs"."participant_count" >= 0 and "draw_runs"."eligible_count" >= 0 and "draw_runs"."used_code_count" >= 0 and "draw_runs"."prize_item_count" >= 0 and "draw_runs"."winner_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "email_domain_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rule_type" text NOT NULL,
	"value" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "email_domain_rules_type_check" CHECK ("email_domain_rules"."rule_type" in ('EXACT', 'WILDCARD_SUFFIX'))
);
--> statement-breakpoint
CREATE TABLE "email_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"winner_id" uuid NOT NULL,
	"recipient_email" text NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"rendered_subject" text NOT NULL,
	"rendered_text_ciphertext" text NOT NULL,
	"rendered_html_ciphertext" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 3 NOT NULL,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"locked_at" timestamp with time zone,
	"locked_by" text,
	"last_error" text,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "email_jobs_status_check" CHECK ("email_jobs"."status" in ('PENDING', 'SENDING', 'SENT', 'FAILED')),
	CONSTRAINT "email_jobs_attempts_check" CHECK ("email_jobs"."attempts" >= 0 and "email_jobs"."max_attempts" > 0 and "email_jobs"."attempts" <= "email_jobs"."max_attempts")
);
--> statement-breakpoint
CREATE TABLE "email_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_key" text NOT NULL,
	"subject_template" text NOT NULL,
	"text_template" text NOT NULL,
	"html_template" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "operation_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_type" text NOT NULL,
	"action" text NOT NULL,
	"entity_type" text,
	"entity_id" text,
	"ip_hash" "bytea",
	"user_agent" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "operation_logs_actor_type_check" CHECK ("operation_logs"."actor_type" in ('ADMIN', 'SYSTEM'))
);
--> statement-breakpoint
CREATE TABLE "prize_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"prize_tier_id" uuid NOT NULL,
	"campaign_id" uuid NOT NULL,
	"sequence_no" integer NOT NULL,
	"content_ciphertext" text NOT NULL,
	"status" text DEFAULT 'AVAILABLE' NOT NULL,
	"unawarded_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "prize_items_sequence_positive_check" CHECK ("prize_items"."sequence_no" > 0),
	CONSTRAINT "prize_items_status_check" CHECK ("prize_items"."status" in ('AVAILABLE', 'AWARDED', 'UNAWARDED'))
);
--> statement-breakpoint
CREATE TABLE "prize_tiers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"name" text NOT NULL,
	"public_description" text NOT NULL,
	"sort_order" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "prize_tiers_sort_nonnegative_check" CHECK ("prize_tiers"."sort_order" >= 0)
);
--> statement-breakpoint
CREATE TABLE "security_rate_limits" (
	"bucket_key" text PRIMARY KEY NOT NULL,
	"scope" text NOT NULL,
	"window_started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"counter" integer DEFAULT 0 NOT NULL,
	"blocked_until" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "security_rate_limits_scope_check" CHECK ("security_rate_limits"."scope" in ('LOGIN', 'PARTICIPATION')),
	CONSTRAINT "security_rate_limits_counter_check" CHECK ("security_rate_limits"."counter" >= 0)
);
--> statement-breakpoint
CREATE TABLE "smtp_config" (
	"id" smallint PRIMARY KEY DEFAULT 1 NOT NULL,
	"provider" text NOT NULL,
	"host" text NOT NULL,
	"port" integer NOT NULL,
	"security" text NOT NULL,
	"username" text NOT NULL,
	"password_ciphertext" text NOT NULL,
	"from_email" text NOT NULL,
	"from_name" text NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"last_test_at" timestamp with time zone,
	"last_test_ok" boolean,
	"last_test_error" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "smtp_config_single_row_check" CHECK ("smtp_config"."id" = 1),
	CONSTRAINT "smtp_config_provider_check" CHECK ("smtp_config"."provider" in ('QQ', 'CUSTOM')),
	CONSTRAINT "smtp_config_security_check" CHECK ("smtp_config"."security" in ('TLS', 'STARTTLS', 'NONE')),
	CONSTRAINT "smtp_config_port_check" CHECK ("smtp_config"."port" > 0 and "smtp_config"."port" <= 65535)
);
--> statement-breakpoint
CREATE TABLE "system_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" text NOT NULL,
	"campaign_id" uuid NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 3 NOT NULL,
	"locked_at" timestamp with time zone,
	"locked_by" text,
	"unique_key" text NOT NULL,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "system_jobs_type_check" CHECK ("system_jobs"."type" in ('DRAW_CAMPAIGN', 'CLEANUP_CAMPAIGN_CODES')),
	CONSTRAINT "system_jobs_status_check" CHECK ("system_jobs"."status" in ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED')),
	CONSTRAINT "system_jobs_attempts_check" CHECK ("system_jobs"."attempts" >= 0 and "system_jobs"."max_attempts" > 0 and "system_jobs"."attempts" <= "system_jobs"."max_attempts")
);
--> statement-breakpoint
CREATE TABLE "used_codes" (
	"code_hash" "bytea" PRIMARY KEY NOT NULL,
	"face_value" smallint NOT NULL,
	"campaign_id" uuid NOT NULL,
	"participant_id" uuid NOT NULL,
	"used_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "used_codes_face_value_check" CHECK ("used_codes"."face_value" in (1, 5, 10, 20, 50, 100))
);
--> statement-breakpoint
CREATE TABLE "winners" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"draw_run_id" uuid NOT NULL,
	"participant_id" uuid NOT NULL,
	"prize_tier_id" uuid NOT NULL,
	"prize_item_id" uuid NOT NULL,
	"original_email_snapshot" text NOT NULL,
	"canonical_email_snapshot" text NOT NULL,
	"total_face_value_snapshot" integer NOT NULL,
	"code_count_snapshot" integer NOT NULL,
	"won_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "winners_snapshots_nonnegative_check" CHECK ("winners"."total_face_value_snapshot" >= 0 and "winners"."code_count_snapshot" >= 0)
);
--> statement-breakpoint
CREATE TABLE "worker_heartbeats" (
	"worker_id" text PRIMARY KEY NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "campaign_codes" ADD CONSTRAINT "campaign_codes_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_codes" ADD CONSTRAINT "campaign_codes_used_by_participant_id_campaign_participants_id_fk" FOREIGN KEY ("used_by_participant_id") REFERENCES "public"."campaign_participants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_participants" ADD CONSTRAINT "campaign_participants_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "draw_runs" ADD CONSTRAINT "draw_runs_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_jobs" ADD CONSTRAINT "email_jobs_winner_id_winners_id_fk" FOREIGN KEY ("winner_id") REFERENCES "public"."winners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prize_items" ADD CONSTRAINT "prize_items_prize_tier_id_prize_tiers_id_fk" FOREIGN KEY ("prize_tier_id") REFERENCES "public"."prize_tiers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prize_items" ADD CONSTRAINT "prize_items_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prize_tiers" ADD CONSTRAINT "prize_tiers_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system_jobs" ADD CONSTRAINT "system_jobs_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "used_codes" ADD CONSTRAINT "used_codes_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "used_codes" ADD CONSTRAINT "used_codes_participant_id_campaign_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."campaign_participants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "winners" ADD CONSTRAINT "winners_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "winners" ADD CONSTRAINT "winners_draw_run_id_draw_runs_id_fk" FOREIGN KEY ("draw_run_id") REFERENCES "public"."draw_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "winners" ADD CONSTRAINT "winners_participant_id_campaign_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."campaign_participants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "winners" ADD CONSTRAINT "winners_prize_tier_id_prize_tiers_id_fk" FOREIGN KEY ("prize_tier_id") REFERENCES "public"."prize_tiers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "winners" ADD CONSTRAINT "winners_prize_item_id_prize_items_id_fk" FOREIGN KEY ("prize_item_id") REFERENCES "public"."prize_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "admin_sessions_token_hash_unique" ON "admin_sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "admin_sessions_expires_at_idx" ON "admin_sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "campaign_codes_campaign_hash_unique" ON "campaign_codes" USING btree ("campaign_id","code_hash");--> statement-breakpoint
CREATE INDEX "campaign_codes_campaign_used_idx" ON "campaign_codes" USING btree ("campaign_id","used_at");--> statement-breakpoint
CREATE INDEX "campaign_codes_campaign_value_used_idx" ON "campaign_codes" USING btree ("campaign_id","face_value","used_at");--> statement-breakpoint
CREATE INDEX "campaign_codes_hash_idx" ON "campaign_codes" USING btree ("code_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "campaign_participants_campaign_email_unique" ON "campaign_participants" USING btree ("campaign_id","canonical_email");--> statement-breakpoint
CREATE UNIQUE INDEX "campaigns_issue_no_unique" ON "campaigns" USING btree ("issue_no");--> statement-breakpoint
CREATE UNIQUE INDEX "campaigns_single_running_unique" ON "campaigns" USING btree ((true)) WHERE "campaigns"."status" in ('ACTIVE', 'LOCKED', 'DRAWING');--> statement-breakpoint
CREATE INDEX "campaigns_status_idx" ON "campaigns" USING btree ("status");--> statement-breakpoint
CREATE INDEX "draw_runs_campaign_attempt_idx" ON "draw_runs" USING btree ("campaign_id","attempt_no");--> statement-breakpoint
CREATE UNIQUE INDEX "email_domain_rules_type_value_unique" ON "email_domain_rules" USING btree ("rule_type","value");--> statement-breakpoint
CREATE UNIQUE INDEX "email_jobs_winner_unique" ON "email_jobs" USING btree ("winner_id");--> statement-breakpoint
CREATE INDEX "email_jobs_status_next_attempt_idx" ON "email_jobs" USING btree ("status","next_attempt_at");--> statement-breakpoint
CREATE UNIQUE INDEX "email_templates_key_unique" ON "email_templates" USING btree ("template_key");--> statement-breakpoint
CREATE INDEX "operation_logs_created_at_idx" ON "operation_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "operation_logs_action_idx" ON "operation_logs" USING btree ("action");--> statement-breakpoint
CREATE UNIQUE INDEX "prize_items_tier_sequence_unique" ON "prize_items" USING btree ("prize_tier_id","sequence_no");--> statement-breakpoint
CREATE INDEX "prize_items_campaign_status_idx" ON "prize_items" USING btree ("campaign_id","status");--> statement-breakpoint
CREATE INDEX "prize_tiers_campaign_sort_idx" ON "prize_tiers" USING btree ("campaign_id","sort_order");--> statement-breakpoint
CREATE INDEX "security_rate_limits_blocked_until_idx" ON "security_rate_limits" USING btree ("blocked_until");--> statement-breakpoint
CREATE UNIQUE INDEX "system_jobs_unique_key_unique" ON "system_jobs" USING btree ("unique_key");--> statement-breakpoint
CREATE INDEX "system_jobs_claim_idx" ON "system_jobs" USING btree ("status","available_at");--> statement-breakpoint
CREATE INDEX "used_codes_campaign_idx" ON "used_codes" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "used_codes_participant_idx" ON "used_codes" USING btree ("participant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "winners_prize_item_unique" ON "winners" USING btree ("prize_item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "winners_campaign_participant_unique" ON "winners" USING btree ("campaign_id","participant_id");--> statement-breakpoint
CREATE INDEX "winners_campaign_won_at_idx" ON "winners" USING btree ("campaign_id","won_at");--> statement-breakpoint
CREATE INDEX "worker_heartbeats_last_seen_idx" ON "worker_heartbeats" USING btree ("last_seen_at");