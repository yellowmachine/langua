CREATE TABLE "listening_attempt" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"target_language" text NOT NULL,
	"passage" text NOT NULL,
	"questions" jsonb NOT NULL,
	"score" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "listening_attempt" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "listening_attempt" ADD CONSTRAINT "listening_attempt_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "listening_attempt_user_idx" ON "listening_attempt" USING btree ("user_id");--> statement-breakpoint
CREATE POLICY "listening_attempt_access" ON "listening_attempt" AS PERMISSIVE FOR ALL TO public USING ("listening_attempt"."user_id" = current_setting('app.current_user_id', true));