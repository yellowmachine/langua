CREATE TABLE "chat_conversation" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"title" text,
	"target_language" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chat_conversation" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "chat_message" (
	"id" text PRIMARY KEY NOT NULL,
	"conversation_id" text NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chat_message" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "chat_conversation" ADD CONSTRAINT "chat_conversation_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_message" ADD CONSTRAINT "chat_message_conversation_id_chat_conversation_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."chat_conversation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chat_conversation_user_idx" ON "chat_conversation" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "chat_message_conversation_idx" ON "chat_message" USING btree ("conversation_id");--> statement-breakpoint
CREATE POLICY "chat_conversation_access" ON "chat_conversation" AS PERMISSIVE FOR ALL TO public USING ("chat_conversation"."user_id" = current_setting('app.current_user_id', true));--> statement-breakpoint
CREATE POLICY "chat_message_access" ON "chat_message" AS PERMISSIVE FOR ALL TO public USING (
				EXISTS (
					SELECT 1 FROM chat_conversation
					WHERE chat_conversation.id = "chat_message"."conversation_id"
					AND chat_conversation.user_id = current_setting('app.current_user_id', true)
				)
			);