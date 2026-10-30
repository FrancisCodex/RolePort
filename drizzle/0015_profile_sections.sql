ALTER TABLE "profile" ADD COLUMN "sections" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "profile_prompt" text;