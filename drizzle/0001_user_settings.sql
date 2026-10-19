CREATE TYPE "public"."ai_provider" AS ENUM('anthropic', 'openai_compatible');--> statement-breakpoint
CREATE TABLE "user_settings" (
	"user_id" text PRIMARY KEY NOT NULL,
	"ai_provider" "ai_provider",
	"ai_preset" text,
	"ai_base_url" text,
	"ai_model" text,
	"ai_api_key_enc" text,
	"ai_reasoning_effort" text,
	"rapid_api_key_enc" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;