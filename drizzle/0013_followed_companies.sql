CREATE TABLE "followed_company" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"ats" text NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"careers_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "followed_company" ADD CONSTRAINT "followed_company_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "followed_company_user_board_idx" ON "followed_company" USING btree ("user_id","ats","slug");