CREATE TABLE "vocab_item" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"target_language" text NOT NULL,
	"lemma" text NOT NULL,
	"word" text NOT NULL,
	"part_of_speech" text NOT NULL,
	"translation" text NOT NULL,
	"example_sentence" text NOT NULL,
	"source_conversation_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "vocab_item" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "vocab_item" ADD CONSTRAINT "vocab_item_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vocab_item" ADD CONSTRAINT "vocab_item_source_conversation_id_chat_conversation_id_fk" FOREIGN KEY ("source_conversation_id") REFERENCES "public"."chat_conversation"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "vocab_item_user_idx" ON "vocab_item" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "vocab_item_user_lang_lemma_idx" ON "vocab_item" USING btree ("user_id","target_language","lemma");--> statement-breakpoint
CREATE POLICY "vocab_item_access" ON "vocab_item" AS PERMISSIVE FOR ALL TO public USING ("vocab_item"."user_id" = current_setting('app.current_user_id', true));