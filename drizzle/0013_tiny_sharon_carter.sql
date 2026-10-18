CREATE TABLE "clip" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"source" text NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"series" text,
	"season" integer,
	"episode" integer,
	"year" integer,
	"start_sec" real NOT NULL,
	"end_sec" real NOT NULL,
	"language" text,
	"transcript" text,
	"cues" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"transcription_status" text DEFAULT 'ready' NOT NULL,
	"audio_key" text NOT NULL,
	"audio_size" integer NOT NULL,
	"audio_type" text NOT NULL,
	"captured_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "clip" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "integration_token" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"token_hash" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"last_used_at" timestamp,
	CONSTRAINT "integration_token_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "integration_token" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "vocab_item" ADD COLUMN "source_clip_id" text;--> statement-breakpoint
ALTER TABLE "clip" ADD CONSTRAINT "clip_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_token" ADD CONSTRAINT "integration_token_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "clip_user_idx" ON "clip" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "integration_token_user_idx" ON "integration_token" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "vocab_item" ADD CONSTRAINT "vocab_item_source_clip_id_clip_id_fk" FOREIGN KEY ("source_clip_id") REFERENCES "public"."clip"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE POLICY "clip_access" ON "clip" AS PERMISSIVE FOR ALL TO public USING ("clip"."user_id" = current_setting('app.current_user_id', true));--> statement-breakpoint
CREATE POLICY "integration_token_access" ON "integration_token" AS PERMISSIVE FOR ALL TO public USING ("integration_token"."user_id" = current_setting('app.current_user_id', true));--> statement-breakpoint
CREATE POLICY "integration_token_lookup" ON "integration_token" AS PERMISSIVE FOR SELECT TO public USING ("integration_token"."token_hash" = current_setting('app.token_hash', true));