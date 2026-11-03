ALTER TYPE "public"."ai_provider" ADD VALUE 'chatgpt';--> statement-breakpoint
CREATE TABLE "chatgpt_account" (
	"user_id" text PRIMARY KEY NOT NULL,
	"host_id" text NOT NULL,
	"client_id" text,
	"email" text,
	"subject" text,
	"id_token_enc" text,
	"access_token_enc" text,
	"refresh_token_enc" text,
	"expires_at" timestamp with time zone,
	"scopes" text,
	"pending_enc" text,
	"problem" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chatgpt_account" ADD CONSTRAINT "chatgpt_account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;