ALTER TABLE "profile" ADD COLUMN "country" text DEFAULT 'PH' NOT NULL;--> statement-breakpoint
ALTER TABLE "profile" ADD COLUMN "target_countries" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "profile" ADD COLUMN "work_authorizations" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "profile" ADD COLUMN "salary_currency" text DEFAULT 'PHP' NOT NULL;