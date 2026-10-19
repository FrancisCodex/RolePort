CREATE TYPE "public"."application_status" AS ENUM('saved', 'applied', 'screening', 'interview', 'offer', 'hired', 'rejected', 'withdrawn', 'offer_declined', 'ghosted');--> statement-breakpoint
CREATE TYPE "public"."document_kind" AS ENUM('uploaded_cv', 'cv', 'cover_letter', 'follow_up');--> statement-breakpoint
CREATE TYPE "public"."employment_type" AS ENUM('full_time', 'part_time', 'contract', 'freelance', 'internship');--> statement-breakpoint
CREATE TYPE "public"."gate_verdict" AS ENUM('pass', 'flag', 'fail', 'unverified');--> statement-breakpoint
CREATE TYPE "public"."salary_period" AS ENUM('hour', 'day', 'month', 'year');--> statement-breakpoint
CREATE TYPE "public"."work_setup" AS ENUM('onsite', 'hybrid', 'remote');--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "application" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"job_id" text,
	"company" text NOT NULL,
	"role" text NOT NULL,
	"status" "application_status" DEFAULT 'saved' NOT NULL,
	"channel" text,
	"applied_at" timestamp with time zone,
	"last_contact_at" timestamp with time zone,
	"next_follow_up_at" timestamp with time zone,
	"follow_up_count" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "application_event" (
	"id" text PRIMARY KEY NOT NULL,
	"application_id" text NOT NULL,
	"status" "application_status" NOT NULL,
	"note" text,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"application_id" text,
	"kind" "document_kind" NOT NULL,
	"title" text NOT NULL,
	"content" jsonb,
	"file_url" text,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job" (
	"id" text PRIMARY KEY NOT NULL,
	"job_key" text NOT NULL,
	"source" text NOT NULL,
	"source_id" text,
	"url" text NOT NULL,
	"title" text NOT NULL,
	"company" text NOT NULL,
	"company_logo" text,
	"location" text,
	"city" text,
	"region" text,
	"work_setup" "work_setup",
	"employment_type" "employment_type",
	"salary_min" integer,
	"salary_max" integer,
	"salary_currency" text DEFAULT 'PHP' NOT NULL,
	"salary_period" "salary_period",
	"description" text,
	"skills" text[] DEFAULT '{}'::text[] NOT NULL,
	"posted_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"raw" jsonb,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "job_job_key_unique" UNIQUE("job_key")
);
--> statement-breakpoint
CREATE TABLE "job_match" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"job_id" text NOT NULL,
	"eligibility_gate" "gate_verdict" NOT NULL,
	"language_gate" "gate_verdict" NOT NULL,
	"location_gate" "gate_verdict" NOT NULL,
	"gate_note" text,
	"skills_score" integer,
	"experience_score" integer,
	"culture_score" integer,
	"career_score" integer,
	"overall_score" integer,
	"strengths" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"gaps" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"summary" text,
	"model" text,
	"scored_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profile" (
	"user_id" text PRIMARY KEY NOT NULL,
	"headline" text,
	"summary" text,
	"city" text,
	"region" text,
	"years_experience" integer,
	"desired_roles" text[] DEFAULT '{}'::text[] NOT NULL,
	"work_setups" "work_setup"[] DEFAULT '{}'::work_setup[] NOT NULL,
	"skills" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"experience" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"education" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"languages" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"career_goals" text[] DEFAULT '{}'::text[] NOT NULL,
	"deal_breakers" text[] DEFAULT '{}'::text[] NOT NULL,
	"salary_min_monthly" integer,
	"salary_max_monthly" integer,
	"cv_text" text,
	"cv_file_name" text,
	"writing_style" text,
	"onboarding_step" integer DEFAULT 0 NOT NULL,
	"onboarded_at" timestamp with time zone,
	"current_streak" integer DEFAULT 0 NOT NULL,
	"longest_streak" integer DEFAULT 0 NOT NULL,
	"last_active_on" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application" ADD CONSTRAINT "application_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application" ADD CONSTRAINT "application_job_id_job_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."job"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_event" ADD CONSTRAINT "application_event_application_id_application_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."application"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document" ADD CONSTRAINT "document_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document" ADD CONSTRAINT "document_application_id_application_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."application"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_match" ADD CONSTRAINT "job_match_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_match" ADD CONSTRAINT "job_match_job_id_job_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."job"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile" ADD CONSTRAINT "profile_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_user_id_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "application_user_job_idx" ON "application" USING btree ("user_id","job_id");--> statement-breakpoint
CREATE INDEX "application_user_status_idx" ON "application" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "application_event_application_idx" ON "application_event" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "document_user_idx" ON "document" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "job_source_source_id_idx" ON "job" USING btree ("source","source_id");--> statement-breakpoint
CREATE INDEX "job_posted_at_idx" ON "job" USING btree ("posted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "job_match_user_job_idx" ON "job_match" USING btree ("user_id","job_id");--> statement-breakpoint
CREATE INDEX "job_match_user_score_idx" ON "job_match" USING btree ("user_id","overall_score");--> statement-breakpoint
CREATE INDEX "session_user_id_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");