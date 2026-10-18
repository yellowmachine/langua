ALTER TABLE "clip" ADD COLUMN "translation_language" text;--> statement-breakpoint
ALTER TABLE "clip" ADD COLUMN "translation_cues" jsonb DEFAULT '[]'::jsonb NOT NULL;