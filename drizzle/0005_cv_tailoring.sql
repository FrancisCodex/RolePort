ALTER TABLE "profile" ADD COLUMN "cv_contact" jsonb DEFAULT '{"email":"","phone":"","links":[]}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "cv_prompt" text;