CREATE TABLE "interview_session" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"application_id" text,
	"title" text NOT NULL,
	"target_role" text NOT NULL,
	"company" text,
	"focus" text NOT NULL,
	"length" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"context" jsonb NOT NULL,
	"plan" jsonb NOT NULL,
	"turns" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"report" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "interview_session" ADD CONSTRAINT "interview_session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interview_session" ADD CONSTRAINT "interview_session_application_id_application_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."application"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "interview_session_user_idx" ON "interview_session" USING btree ("user_id","created_at");