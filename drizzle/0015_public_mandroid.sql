ALTER TABLE "app_settings" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "two_factor" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "app_settings" CASCADE;--> statement-breakpoint
DROP TABLE "two_factor" CASCADE;--> statement-breakpoint
ALTER TABLE "user" DROP CONSTRAINT "user_username_unique";--> statement-breakpoint
ALTER TABLE "user" DROP COLUMN "username";--> statement-breakpoint
ALTER TABLE "user" DROP COLUMN "display_username";--> statement-breakpoint
ALTER TABLE "user" DROP COLUMN "role";--> statement-breakpoint
ALTER TABLE "user" DROP COLUMN "two_factor_enabled";