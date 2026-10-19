ALTER TABLE "job_match" ADD COLUMN "eligibility_note" text;--> statement-breakpoint
ALTER TABLE "job_match" ADD COLUMN "language_note" text;--> statement-breakpoint
ALTER TABLE "job_match" ADD COLUMN "location_note" text;--> statement-breakpoint
ALTER TABLE "job_match" ADD COLUMN "recommendation" text;--> statement-breakpoint
ALTER TABLE "job_match" ADD COLUMN "deadline" date;--> statement-breakpoint
ALTER TABLE "job_match" ADD COLUMN "posting_closed" boolean DEFAULT false NOT NULL;