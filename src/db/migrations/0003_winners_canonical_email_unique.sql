DROP INDEX "winners_campaign_email_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "winners_campaign_email_unique" ON "winners" USING btree ("campaign_id","canonical_email_snapshot");
