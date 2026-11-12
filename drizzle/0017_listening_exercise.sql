CREATE TABLE "listening_exercise" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"target_language" text NOT NULL,
	"passage" text NOT NULL,
	"questions" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "listening_exercise" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "listening_exercise" ADD CONSTRAINT "listening_exercise_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "listening_exercise_user_idx" ON "listening_exercise" USING btree ("user_id");--> statement-breakpoint
CREATE POLICY "listening_exercise_access" ON "listening_exercise" AS PERMISSIVE FOR ALL TO public USING ("listening_exercise"."user_id" = current_setting('app.current_user_id', true));