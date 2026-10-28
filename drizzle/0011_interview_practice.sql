ALTER TABLE "application" ADD COLUMN "interview_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "interview_session" ADD COLUMN "style" text DEFAULT 'standard' NOT NULL;--> statement-breakpoint
ALTER TABLE "interview_session" ADD COLUMN "drill" jsonb;--> statement-breakpoint
ALTER TABLE "user_settings" ADD COLUMN "interview_prompt" text;