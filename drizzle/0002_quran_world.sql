-- Additive Drizzle Migration 0002: Quran World (عالم القرآن الكريم)
-- Strictly additive: creates 6 normalized quran_* tables and indexes.
-- Zero destructive statements (no DROP, TRUNCATE, DELETE, or ALTER on existing 43 tables).

CREATE TABLE IF NOT EXISTS "quran_child_settings" (
	"child_id" text PRIMARY KEY NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"allowed_surah_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"surah_order" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"preferred_reciter_id" text DEFAULT 'adult-husary-muallim' NOT NULL,
	"prefer_child_reciter_fallback" boolean DEFAULT true NOT NULL,
	"repeat_count" integer DEFAULT 2 NOT NULL,
	"listen_only_mode" boolean DEFAULT false NOT NULL,
	"daily_max_minutes" integer DEFAULT 15 NOT NULL,
	"gentle_reminder_enabled" boolean DEFAULT false NOT NULL,
	"updated_by_user_id" text,
	"updated_at" text NOT NULL,
	CONSTRAINT "quran_child_settings_child_id_children_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."children"("id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "quran_child_settings_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action,
	CONSTRAINT "quran_settings_repeat_range" CHECK ("repeat_count" >= 1 AND "repeat_count" <= 5),
	CONSTRAINT "quran_settings_minutes_range" CHECK ("daily_max_minutes" >= 5 AND "daily_max_minutes" <= 60)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "quran_surah_progress" (
	"id" text PRIMARY KEY NOT NULL,
	"child_id" text NOT NULL,
	"surah_id" text NOT NULL,
	"listen_count" integer DEFAULT 0 NOT NULL,
	"repeat_sessions_count" integer DEFAULT 0 NOT NULL,
	"ayahs_practiced" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text DEFAULT 'not_started' NOT NULL,
	"parent_confirmed_memorization" boolean DEFAULT false NOT NULL,
	"parent_confirmed_at" text,
	"parent_confirmed_by_user_id" text,
	"parent_note" text,
	"last_listened_at" text,
	"updated_at" text NOT NULL,
	CONSTRAINT "quran_surah_progress_child_id_children_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."children"("id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "quran_surah_progress_parent_confirmed_by_user_id_users_id_fk" FOREIGN KEY ("parent_confirmed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action,
	CONSTRAINT "quran_surah_listen_non_negative" CHECK ("listen_count" >= 0),
	CONSTRAINT "quran_surah_repeat_non_negative" CHECK ("repeat_sessions_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "quran_story_progress" (
	"id" text PRIMARY KEY NOT NULL,
	"child_id" text NOT NULL,
	"story_id" text NOT NULL,
	"completed_count" integer DEFAULT 0 NOT NULL,
	"last_read_at" text NOT NULL,
	CONSTRAINT "quran_story_progress_child_id_children_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."children"("id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "quran_story_completed_non_negative" CHECK ("completed_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "quran_manners_progress" (
	"id" text PRIMARY KEY NOT NULL,
	"child_id" text NOT NULL,
	"manner_id" text NOT NULL,
	"practiced_count" integer DEFAULT 0 NOT NULL,
	"last_practiced_at" text NOT NULL,
	CONSTRAINT "quran_manners_progress_child_id_children_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."children"("id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "quran_manners_practiced_non_negative" CHECK ("practiced_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "quran_activity_events" (
	"id" text PRIMARY KEY NOT NULL,
	"child_id" text NOT NULL,
	"event_type" text NOT NULL,
	"target_id" text NOT NULL,
	"duration_seconds" integer DEFAULT 0 NOT NULL,
	"ayah_count" integer DEFAULT 0 NOT NULL,
	"reciter_id" text,
	"recorded_by_user_id" text,
	"occurred_at" text NOT NULL,
	CONSTRAINT "quran_activity_events_child_id_children_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."children"("id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "quran_activity_events_recorded_by_user_id_users_id_fk" FOREIGN KEY ("recorded_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action,
	CONSTRAINT "quran_event_duration_non_negative" CHECK ("duration_seconds" >= 0),
	CONSTRAINT "quran_event_ayahs_non_negative" CHECK ("ayah_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "quran_content_verifications" (
	"id" text PRIMARY KEY NOT NULL,
	"content_type" text NOT NULL,
	"content_key" text NOT NULL,
	"source_name" text NOT NULL,
	"license_or_permission" text NOT NULL,
	"tajweed_reviewed_by" text,
	"tajweed_reviewed_at" text,
	"verification_status" text NOT NULL,
	"audio_urls_json" jsonb,
	"notes" text,
	"updated_by_user_id" text,
	"updated_at" text NOT NULL,
	CONSTRAINT "quran_content_verifications_content_key_unique" UNIQUE("content_key"),
	CONSTRAINT "quran_content_verifications_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "quran_surah_progress_child_surah_uidx" ON "quran_surah_progress" USING btree ("child_id","surah_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "quran_surah_progress_child_idx" ON "quran_surah_progress" USING btree ("child_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "quran_story_progress_child_story_uidx" ON "quran_story_progress" USING btree ("child_id","story_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "quran_story_progress_child_idx" ON "quran_story_progress" USING btree ("child_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "quran_manners_progress_child_manner_uidx" ON "quran_manners_progress" USING btree ("child_id","manner_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "quran_manners_progress_child_idx" ON "quran_manners_progress" USING btree ("child_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "quran_activity_events_child_idx" ON "quran_activity_events" USING btree ("child_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "quran_activity_events_occurred_idx" ON "quran_activity_events" USING btree ("occurred_at");
