CREATE TABLE "speaking_attempt" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"target_language" text NOT NULL,
	"prompt" text NOT NULL,
	"transcript" text NOT NULL,
	"score" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "speaking_attempt" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "speaking_attempt" ADD CONSTRAINT "speaking_attempt_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "speaking_attempt_user_idx" ON "speaking_attempt" USING btree ("user_id");--> statement-breakpoint
CREATE POLICY "speaking_attempt_access" ON "speaking_attempt" AS PERMISSIVE FOR ALL TO public USING ("speaking_attempt"."user_id" = current_setting('app.current_user_id', true));