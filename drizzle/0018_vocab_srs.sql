CREATE TABLE "vocab_review" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"vocab_item_id" text NOT NULL,
	"rating" integer NOT NULL,
	"reviewed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "vocab_review" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "vocab_item" ADD COLUMN "due_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "vocab_item" ADD COLUMN "srs" jsonb;--> statement-breakpoint
ALTER TABLE "vocab_review" ADD CONSTRAINT "vocab_review_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vocab_review" ADD CONSTRAINT "vocab_review_vocab_item_id_vocab_item_id_fk" FOREIGN KEY ("vocab_item_id") REFERENCES "public"."vocab_item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "vocab_review_user_idx" ON "vocab_review" USING btree ("user_id","reviewed_at");--> statement-breakpoint
CREATE INDEX "vocab_item_user_due_idx" ON "vocab_item" USING btree ("user_id","due_at");--> statement-breakpoint
CREATE POLICY "vocab_review_access" ON "vocab_review" AS PERMISSIVE FOR ALL TO public USING ("vocab_review"."user_id" = current_setting('app.current_user_id', true));