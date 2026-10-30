ALTER TABLE "user_settings" ADD COLUMN "email_prompt" text;--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "follow_up_rules" jsonb;