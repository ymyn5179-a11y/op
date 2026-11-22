CREATE TABLE "action_tokens" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"expires_at" bigint NOT NULL,
	"used" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_usage_daily" (
	"usage_key" text PRIMARY KEY NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_usage_records" (
	"id" text PRIMARY KEY NOT NULL,
	"child_id" text NOT NULL,
	"family_id" text,
	"actor_id" text,
	"mode" text NOT NULL,
	"language" text NOT NULL,
	"topic" text,
	"blocked" boolean DEFAULT false NOT NULL,
	"voice_used" boolean DEFAULT false NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_configs" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "archived_children" (
	"child_id" text PRIMARY KEY NOT NULL,
	"family_id" text NOT NULL,
	"parent_id" text NOT NULL,
	"display_name" text NOT NULL,
	"deleted_by_user_id" text NOT NULL,
	"deleted_at" text NOT NULL,
	"reason" text
);
--> statement-breakpoint
CREATE TABLE "assigned_exam_attempts" (
	"id" text PRIMARY KEY NOT NULL,
	"assignment_id" text NOT NULL,
	"exam_id" text NOT NULL,
	"student_id" text NOT NULL,
	"teacher_id" text NOT NULL,
	"attempt_number" integer NOT NULL,
	"question_ids" jsonb NOT NULL,
	"option_order_map" jsonb NOT NULL,
	"answers" jsonb NOT NULL,
	"status" text NOT NULL,
	"score" integer,
	"total_marks" integer,
	"percentage" integer,
	"passed" boolean,
	"started_at" text NOT NULL,
	"submitted_at" text,
	"review" jsonb
);
--> statement-breakpoint
CREATE TABLE "certificates" (
	"unique_code" text PRIMARY KEY NOT NULL,
	"id" text NOT NULL,
	"child_name" text NOT NULL,
	"world_id" text NOT NULL,
	"world_name" jsonb NOT NULL,
	"achievement_title" jsonb NOT NULL,
	"issued_at" text NOT NULL,
	"level_completed" integer NOT NULL,
	"is_official_exam" boolean,
	"exam_subject" text,
	"score" integer,
	"total_questions" integer,
	"percentage" integer,
	"passing_percentage" integer,
	"age_group" text,
	"verification_url" text,
	"revoked" boolean DEFAULT false
);
--> statement-breakpoint
CREATE TABLE "checkout_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"child_id" text NOT NULL,
	"parent_id" text,
	"subject" text NOT NULL,
	"amount_egp" integer NOT NULL,
	"status" text NOT NULL,
	"payment_token" text,
	"token_consumed" boolean DEFAULT false,
	"created_at" text NOT NULL,
	"verified_at" text
);
--> statement-breakpoint
CREATE TABLE "child_credentials" (
	"child_id" text PRIMARY KEY NOT NULL,
	"family_id" text NOT NULL,
	"access_code_hash" text NOT NULL,
	"access_code_encrypted" text NOT NULL,
	"access_code_last4" text NOT NULL,
	"pin_hash" text NOT NULL,
	"failed_attempts" integer DEFAULT 0 NOT NULL,
	"locked_until" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	"rotated_at" text,
	"last_login_at" text,
	CONSTRAINT "child_credentials_access_code_hash_unique" UNIQUE("access_code_hash")
);
--> statement-breakpoint
CREATE TABLE "children" (
	"id" text PRIMARY KEY NOT NULL,
	"parent_id" text NOT NULL,
	"family_id" text,
	"student_user_id" text,
	"display_name" text NOT NULL,
	"birth_year" integer NOT NULL,
	"birth_month" integer NOT NULL,
	"age_months" integer,
	"age_group" text NOT NULL,
	"language" text DEFAULT 'ar' NOT NULL,
	"interests" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"companion_id" text DEFAULT 'nono' NOT NULL,
	"companion_scarf_color" text DEFAULT '#FF9360' NOT NULL,
	"stars" integer DEFAULT 0 NOT NULL,
	"level" integer DEFAULT 1 NOT NULL,
	"completed_baseline" boolean DEFAULT false NOT NULL,
	"favorite_world_id" text,
	"recent_activity_id" text,
	"unlocked_worlds" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"completed_activity_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"unlocked_characters" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"unlocked_badges" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"unlocked_room_items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"placed_room_items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"saved_drawings" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"certificates" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"skill_progress" jsonb NOT NULL,
	"concept_mastery" jsonb,
	"level1_progress" jsonb,
	"level2_progress" jsonb,
	"level2_unlocked" boolean DEFAULT false,
	"completed_deep_lessons" jsonb,
	"exam_history" jsonb,
	"character_outfits" jsonb,
	"unlocked_fun_rewards" jsonb,
	"attempts" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"assessment_history" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"completed_story_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"completed_missions_today" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"total_learning_minutes" integer DEFAULT 0 NOT NULL,
	"downloaded_world_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"avatar_config" jsonb,
	"room_config" jsonb,
	"pet_state" jsonb,
	"completed_lab_ids" jsonb,
	"lab_history" jsonb,
	"custom_stories" jsonb,
	"creative_projects" jsonb,
	"owned_shop_item_ids" jsonb,
	"reward_transactions" jsonb,
	"claimed_missions_date" text,
	"claimed_mission_ids_today" jsonb,
	"learning_streak_days" integer DEFAULT 0,
	"active_days_history" jsonb,
	"monthly_snapshots" jsonb,
	"parent_schedule" jsonb,
	"next_month_plan" jsonb,
	"activity_timeline" jsonb,
	"ai_assistant_enabled" boolean DEFAULT true,
	"reading_stage_progress" jsonb,
	"family_activities_completed" jsonb,
	"music_compositions" jsonb,
	"build_constructions" jsonb,
	"completed_discovery_themes" jsonb,
	"completed_recipes" jsonb,
	"completed_theater_scenes" jsonb,
	"learning_garden" jsonb,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	CONSTRAINT "children_stars_non_negative" CHECK ("children"."stars" >= 0),
	CONSTRAINT "children_level_positive" CHECK ("children"."level" >= 1)
);
--> statement-breakpoint
CREATE TABLE "classes" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"subject" text NOT NULL,
	"level" text NOT NULL,
	"description" text,
	"age_group" text,
	"recommended_age_range" text,
	"teacher_id" text NOT NULL,
	"student_ids" jsonb NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_policies" (
	"family_id" text PRIMARY KEY NOT NULL,
	"allow_stories" boolean DEFAULT true NOT NULL,
	"allow_songs_audio" boolean DEFAULT true NOT NULL,
	"allow_videos" boolean DEFAULT true NOT NULL,
	"allow_games_creative" boolean DEFAULT true NOT NULL,
	"ai_companion_enabled" boolean DEFAULT true NOT NULL,
	"voice_interaction_enabled" boolean DEFAULT true NOT NULL,
	"age_strict_mode" boolean DEFAULT true NOT NULL,
	"allow_external_content" boolean DEFAULT false NOT NULL,
	"allowed_story_categories" jsonb NOT NULL,
	"blocked_video_ids" jsonb NOT NULL,
	"allowed_video_ids" jsonb NOT NULL,
	"updated_at" text NOT NULL,
	"updated_by" text
);
--> statement-breakpoint
CREATE TABLE "custom_lessons" (
	"id" text PRIMARY KEY NOT NULL,
	"domain" text NOT NULL,
	"title" jsonb NOT NULL,
	"summary" jsonb NOT NULL,
	"age_groups" jsonb NOT NULL,
	"recommended_age_range" text,
	"target_symbol" text NOT NULL,
	"color_hex" text,
	"image_url" text,
	"audio_url" text,
	"examples" jsonb NOT NULL,
	"level" integer,
	"subject" text,
	"published" boolean DEFAULT true NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "custom_questions" (
	"id" text PRIMARY KEY NOT NULL,
	"subject" text NOT NULL,
	"age_groups" jsonb NOT NULL,
	"recommended_age_range" text,
	"type" text NOT NULL,
	"difficulty" integer NOT NULL,
	"lesson_ref_id" text NOT NULL,
	"lesson_title" jsonb NOT NULL,
	"prompt" jsonb NOT NULL,
	"audio_text" text,
	"audio_lang" text,
	"visual_cue" text,
	"options" jsonb NOT NULL,
	"correct_option_id" text NOT NULL,
	"explanation" jsonb NOT NULL,
	"published" boolean DEFAULT true
);
--> statement-breakpoint
CREATE TABLE "data_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"family_id" text NOT NULL,
	"type" text NOT NULL,
	"status" text NOT NULL,
	"requested_by_user_id" text NOT NULL,
	"requested_by_name" text NOT NULL,
	"note" text,
	"requested_at" text NOT NULL,
	"completed_at" text
);
--> statement-breakpoint
CREATE TABLE "exam_assignments" (
	"id" text PRIMARY KEY NOT NULL,
	"exam_id" text NOT NULL,
	"student_id" text NOT NULL,
	"teacher_id" text NOT NULL,
	"class_id" text,
	"assigned_at" text NOT NULL,
	"available_start_date" text NOT NULL,
	"deadline" text NOT NULL,
	"extended_deadline" text,
	"status" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exam_attempts" (
	"id" text PRIMARY KEY NOT NULL,
	"child_id" text NOT NULL,
	"parent_id" text,
	"child_name" text NOT NULL,
	"age_group" text NOT NULL,
	"subject" text NOT NULL,
	"mode" text NOT NULL,
	"question_ids" jsonb NOT NULL,
	"payment_verified" boolean NOT NULL,
	"amount_paid_egp" integer NOT NULL,
	"passing_percentage" integer NOT NULL,
	"submitted" boolean DEFAULT false NOT NULL,
	"summary" jsonb,
	"certificate_code" text,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "families" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"primary_guardian_id" text NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "family_audit_events" (
	"id" text PRIMARY KEY NOT NULL,
	"family_id" text NOT NULL,
	"category" text NOT NULL,
	"action_type" text NOT NULL,
	"actor_id" text,
	"actor_name" text,
	"actor_role" text,
	"child_id" text,
	"child_name" text,
	"device_id" text,
	"severity" text,
	"title" jsonb NOT NULL,
	"description" jsonb NOT NULL,
	"metadata" jsonb,
	"ip" text,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "garden_reward_events" (
	"id" text PRIMARY KEY NOT NULL,
	"child_id" text NOT NULL,
	"milestone_key" text NOT NULL,
	"item_unlocked_id" text NOT NULL,
	"reason" jsonb NOT NULL,
	"awarded_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "guardian_invitations" (
	"id" text PRIMARY KEY NOT NULL,
	"family_id" text NOT NULL,
	"email" text NOT NULL,
	"role" text NOT NULL,
	"permissions" jsonb NOT NULL,
	"invited_by_user_id" text NOT NULL,
	"invited_by_name" text NOT NULL,
	"status" text NOT NULL,
	"token_hash" text NOT NULL,
	"created_at" text NOT NULL,
	"expires_at" text NOT NULL,
	"accepted_at" text,
	CONSTRAINT "guardian_invitations_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "guardian_memberships" (
	"id" text PRIMARY KEY NOT NULL,
	"family_id" text NOT NULL,
	"user_id" text NOT NULL,
	"display_name" text NOT NULL,
	"email" text NOT NULL,
	"role" text NOT NULL,
	"permissions" jsonb NOT NULL,
	"status" text NOT NULL,
	"invited_by_user_id" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	"revoked_at" text
);
--> statement-breakpoint
CREATE TABLE "homework_attachments" (
	"id" text PRIMARY KEY NOT NULL,
	"file_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"kind" text NOT NULL,
	"url" text NOT NULL,
	"stored_path" text NOT NULL,
	"uploaded_by" text NOT NULL,
	"uploaded_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "homework_submissions" (
	"id" text PRIMARY KEY NOT NULL,
	"assignment_id" text NOT NULL,
	"homework_version" integer NOT NULL,
	"student_id" text NOT NULL,
	"teacher_id" text NOT NULL,
	"opened_at" text,
	"started_at" text,
	"submitted_at" text,
	"completed_at" text,
	"attempt_count" integer NOT NULL,
	"extended_deadline" text,
	"extension_reason" text,
	"status" text NOT NULL,
	"answers" jsonb NOT NULL,
	"text_response" text,
	"score" integer,
	"total_marks" integer,
	"percentage" integer,
	"passed" boolean,
	"teacher_feedback" text,
	"graded_at" text,
	"review" jsonb
);
--> statement-breakpoint
CREATE TABLE "homeworks" (
	"id" text PRIMARY KEY NOT NULL,
	"teacher_id" text NOT NULL,
	"title" jsonb NOT NULL,
	"instructions" jsonb NOT NULL,
	"subject" text NOT NULL,
	"level" integer NOT NULL,
	"recommended_age_range" text,
	"lesson_ids" jsonb NOT NULL,
	"homework_type" text NOT NULL,
	"question_ids" jsonb NOT NULL,
	"question_snapshots" jsonb,
	"attachments" jsonb NOT NULL,
	"assigned_class_ids" jsonb NOT NULL,
	"assigned_student_ids" jsonb NOT NULL,
	"start_date" text NOT NULL,
	"deadline" text NOT NULL,
	"max_attempts" integer NOT NULL,
	"passing_percentage" integer NOT NULL,
	"status" text NOT NULL,
	"admin_feedback" text,
	"reviewed_by" text,
	"reviewed_at" text,
	"version" integer DEFAULT 1 NOT NULL,
	"versions" jsonb,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "import_batches" (
	"id" text PRIMARY KEY NOT NULL,
	"teacher_id" text NOT NULL,
	"file_name" text NOT NULL,
	"format" text NOT NULL,
	"stored_upload_path" text NOT NULL,
	"valid_rows" jsonb NOT NULL,
	"invalid_rows" jsonb NOT NULL,
	"committed" boolean DEFAULT false NOT NULL,
	"created_at" text NOT NULL,
	"expires_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "level1_attempts" (
	"id" text PRIMARY KEY NOT NULL,
	"child_id" text NOT NULL,
	"parent_id" text,
	"lesson_id" text NOT NULL,
	"question_ids" jsonb NOT NULL,
	"submitted" boolean DEFAULT false NOT NULL,
	"result" jsonb,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "level2_attempts" (
	"id" text PRIMARY KEY NOT NULL,
	"child_id" text NOT NULL,
	"parent_id" text,
	"lesson_id" text NOT NULL,
	"question_ids" jsonb NOT NULL,
	"submitted" boolean DEFAULT false NOT NULL,
	"result" jsonb,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "parent_gate_credentials" (
	"user_id" text PRIMARY KEY NOT NULL,
	"family_id" text NOT NULL,
	"pin_hash" text NOT NULL,
	"failed_attempts" integer DEFAULT 0 NOT NULL,
	"locked_until" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "privacy_consents" (
	"id" text PRIMARY KEY NOT NULL,
	"family_id" text NOT NULL,
	"consent_key" text NOT NULL,
	"granted" boolean NOT NULL,
	"policy_version" text NOT NULL,
	"granted_by_user_id" text NOT NULL,
	"granted_by_name" text NOT NULL,
	"granted_at" text NOT NULL,
	"withdrawn_at" text
);
--> statement-breakpoint
CREATE TABLE "privacy_settings" (
	"family_id" text PRIMARY KEY NOT NULL,
	"child_profile_visibility" text DEFAULT 'private' NOT NULL,
	"ai_features_consent" boolean DEFAULT true NOT NULL,
	"voice_interaction_consent" boolean DEFAULT true NOT NULL,
	"analytics_consent" boolean DEFAULT true NOT NULL,
	"essential_terms_consent" boolean DEFAULT true NOT NULL,
	"policy_version" text NOT NULL,
	"updated_at" text NOT NULL,
	"updated_by" text
);
--> statement-breakpoint
CREATE TABLE "processed_sync_keys" (
	"idempotency_key" text PRIMARY KEY NOT NULL,
	"child_id" text NOT NULL,
	"processed_at" text NOT NULL,
	"summary" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"timestamps" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"updated_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "schema_migrations" (
	"version" text PRIMARY KEY NOT NULL,
	"description" text NOT NULL,
	"checksum" text NOT NULL,
	"applied_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "security_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"event_type" text NOT NULL,
	"family_id" text,
	"actor_id" text,
	"actor_role" text,
	"role" text,
	"action_type" text,
	"record_type" text,
	"record_id" text,
	"previous_value" jsonb,
	"new_value" jsonb,
	"reason" text,
	"outcome" text,
	"ip" text,
	"summary" text NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"csrf_token" text NOT NULL,
	"created_at" bigint NOT NULL,
	"last_active_at" bigint NOT NULL,
	"expires_at" bigint NOT NULL,
	"ip" text NOT NULL,
	"user_agent" text NOT NULL,
	"session_kind" text,
	"child_id" text,
	"family_id" text,
	"device_id" text,
	"remember_me" boolean DEFAULT false,
	"parent_gate_verified_until" bigint
);
--> statement-breakpoint
CREATE TABLE "smart_assessment_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"child_id" text NOT NULL,
	"parent_id" text,
	"age_group" text NOT NULL,
	"difficulty_tier" text NOT NULL,
	"total_questions" integer NOT NULL,
	"asked_question_ids" jsonb NOT NULL,
	"results" jsonb NOT NULL,
	"streak" integer NOT NULL,
	"consecutive_mistakes" integer NOT NULL,
	"hints_used" integer NOT NULL,
	"finished" boolean DEFAULT false NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teacher_exams" (
	"id" text PRIMARY KEY NOT NULL,
	"teacher_id" text NOT NULL,
	"title" jsonb NOT NULL,
	"description" jsonb NOT NULL,
	"subject" text NOT NULL,
	"level" integer NOT NULL,
	"age_group" text NOT NULL,
	"recommended_age_range" text,
	"lesson_ids" jsonb NOT NULL,
	"question_ids" jsonb NOT NULL,
	"question_snapshots" jsonb,
	"total_questions" integer NOT NULL,
	"total_marks" integer NOT NULL,
	"passing_percentage" integer NOT NULL,
	"duration_minutes" integer NOT NULL,
	"start_date" text NOT NULL,
	"end_date" text NOT NULL,
	"allowed_attempts" integer NOT NULL,
	"randomize_questions" boolean NOT NULL,
	"randomize_answers" boolean NOT NULL,
	"show_results" boolean NOT NULL,
	"show_correct_answers" boolean NOT NULL,
	"status" text NOT NULL,
	"admin_review_note" text,
	"reviewed_by" text,
	"reviewed_at" text,
	"version" integer DEFAULT 1 NOT NULL,
	"versions" jsonb,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teacher_questions" (
	"id" text PRIMARY KEY NOT NULL,
	"teacher_id" text NOT NULL,
	"subject" text NOT NULL,
	"level" integer NOT NULL,
	"lesson_id" text NOT NULL,
	"question_type" text NOT NULL,
	"prompt_ar" text NOT NULL,
	"prompt_en" text NOT NULL,
	"image_url" text,
	"audio_url" text,
	"audio_text" text,
	"options" jsonb NOT NULL,
	"correct_option_id" text,
	"correct_option_ids" jsonb,
	"allow_multiple_correct" boolean,
	"matching_pairs" jsonb,
	"correct_order" jsonb,
	"accepted_answers" jsonb,
	"marks" integer NOT NULL,
	"difficulty" text NOT NULL,
	"recommended_age_range" text,
	"explanation" jsonb NOT NULL,
	"feedback_correct" jsonb NOT NULL,
	"feedback_incorrect" jsonb NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"approval_status" text,
	"admin_feedback" text,
	"reviewed_by" text,
	"reviewed_at" text,
	"quality_flags" jsonb,
	"version" integer DEFAULT 1 NOT NULL,
	"versions" jsonb,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trusted_devices" (
	"id" text PRIMARY KEY NOT NULL,
	"family_id" text NOT NULL,
	"user_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"device_name" text NOT NULL,
	"device_type" text NOT NULL,
	"browser" text NOT NULL,
	"os" text NOT NULL,
	"user_agent" text NOT NULL,
	"ip" text NOT NULL,
	"trusted" boolean DEFAULT false NOT NULL,
	"revoked" boolean DEFAULT false NOT NULL,
	"first_registered_at" text NOT NULL,
	"last_active_at" text NOT NULL,
	"revoked_at" text,
	CONSTRAINT "trusted_devices_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"normalized_email" text NOT NULL,
	"display_name" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"phone" text,
	"bio" text,
	"linked_child_id" text,
	"family_id" text,
	"teacher_profile" jsonb,
	"policy_version" text DEFAULT '2026.04' NOT NULL,
	"terms_accepted_at" text NOT NULL,
	"failed_login_attempts" integer DEFAULT 0 NOT NULL,
	"locked_until" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	CONSTRAINT "users_normalized_email_unique" UNIQUE("normalized_email")
);
--> statement-breakpoint
ALTER TABLE "action_tokens" ADD CONSTRAINT "action_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assigned_exam_attempts" ADD CONSTRAINT "assigned_exam_attempts_assignment_id_exam_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."exam_assignments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assigned_exam_attempts" ADD CONSTRAINT "assigned_exam_attempts_exam_id_teacher_exams_id_fk" FOREIGN KEY ("exam_id") REFERENCES "public"."teacher_exams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assigned_exam_attempts" ADD CONSTRAINT "assigned_exam_attempts_teacher_id_users_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "child_credentials" ADD CONSTRAINT "child_credentials_child_id_children_id_fk" FOREIGN KEY ("child_id") REFERENCES "public"."children"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "child_credentials" ADD CONSTRAINT "child_credentials_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "children" ADD CONSTRAINT "children_parent_id_users_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "children" ADD CONSTRAINT "children_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "children" ADD CONSTRAINT "children_student_user_id_users_id_fk" FOREIGN KEY ("student_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "classes" ADD CONSTRAINT "classes_teacher_id_users_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_policies" ADD CONSTRAINT "content_policies_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_requests" ADD CONSTRAINT "data_requests_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_assignments" ADD CONSTRAINT "exam_assignments_exam_id_teacher_exams_id_fk" FOREIGN KEY ("exam_id") REFERENCES "public"."teacher_exams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_assignments" ADD CONSTRAINT "exam_assignments_teacher_id_users_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "family_audit_events" ADD CONSTRAINT "family_audit_events_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guardian_invitations" ADD CONSTRAINT "guardian_invitations_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guardian_invitations" ADD CONSTRAINT "guardian_invitations_invited_by_user_id_users_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guardian_memberships" ADD CONSTRAINT "guardian_memberships_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guardian_memberships" ADD CONSTRAINT "guardian_memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guardian_memberships" ADD CONSTRAINT "guardian_memberships_invited_by_user_id_users_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "homework_submissions" ADD CONSTRAINT "homework_submissions_assignment_id_homeworks_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."homeworks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "homework_submissions" ADD CONSTRAINT "homework_submissions_teacher_id_users_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "homeworks" ADD CONSTRAINT "homeworks_teacher_id_users_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_teacher_id_users_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parent_gate_credentials" ADD CONSTRAINT "parent_gate_credentials_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parent_gate_credentials" ADD CONSTRAINT "parent_gate_credentials_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "privacy_consents" ADD CONSTRAINT "privacy_consents_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "privacy_settings" ADD CONSTRAINT "privacy_settings_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_exams" ADD CONSTRAINT "teacher_exams_teacher_id_users_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_questions" ADD CONSTRAINT "teacher_questions_teacher_id_users_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trusted_devices" ADD CONSTRAINT "trusted_devices_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trusted_devices" ADD CONSTRAINT "trusted_devices_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_family_id_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."families"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "action_tokens_user_id_idx" ON "action_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "ai_usage_records_child_idx" ON "ai_usage_records" USING btree ("child_id");--> statement-breakpoint
CREATE INDEX "archived_children_family_idx" ON "archived_children" USING btree ("family_id");--> statement-breakpoint
CREATE INDEX "assigned_exam_attempts_assignment_idx" ON "assigned_exam_attempts" USING btree ("assignment_id");--> statement-breakpoint
CREATE INDEX "assigned_exam_attempts_student_idx" ON "assigned_exam_attempts" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "checkout_sessions_child_idx" ON "checkout_sessions" USING btree ("child_id");--> statement-breakpoint
CREATE INDEX "child_credentials_family_idx" ON "child_credentials" USING btree ("family_id");--> statement-breakpoint
CREATE INDEX "children_parent_id_idx" ON "children" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "children_family_id_idx" ON "children" USING btree ("family_id");--> statement-breakpoint
CREATE INDEX "children_student_user_id_idx" ON "children" USING btree ("student_user_id");--> statement-breakpoint
CREATE INDEX "classes_teacher_idx" ON "classes" USING btree ("teacher_id");--> statement-breakpoint
CREATE INDEX "data_requests_family_idx" ON "data_requests" USING btree ("family_id");--> statement-breakpoint
CREATE INDEX "exam_assignments_student_idx" ON "exam_assignments" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "exam_assignments_exam_idx" ON "exam_assignments" USING btree ("exam_id");--> statement-breakpoint
CREATE INDEX "exam_attempts_child_idx" ON "exam_attempts" USING btree ("child_id");--> statement-breakpoint
CREATE INDEX "families_primary_guardian_idx" ON "families" USING btree ("primary_guardian_id");--> statement-breakpoint
CREATE INDEX "family_audit_events_family_created_idx" ON "family_audit_events" USING btree ("family_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "garden_reward_child_milestone_uidx" ON "garden_reward_events" USING btree ("child_id","milestone_key");--> statement-breakpoint
CREATE INDEX "garden_reward_child_idx" ON "garden_reward_events" USING btree ("child_id");--> statement-breakpoint
CREATE INDEX "guardian_invitations_family_idx" ON "guardian_invitations" USING btree ("family_id");--> statement-breakpoint
CREATE UNIQUE INDEX "guardian_memberships_family_user_uidx" ON "guardian_memberships" USING btree ("family_id","user_id");--> statement-breakpoint
CREATE INDEX "guardian_memberships_user_idx" ON "guardian_memberships" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "homework_submissions_assignment_idx" ON "homework_submissions" USING btree ("assignment_id");--> statement-breakpoint
CREATE INDEX "homework_submissions_student_idx" ON "homework_submissions" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "homeworks_teacher_idx" ON "homeworks" USING btree ("teacher_id");--> statement-breakpoint
CREATE INDEX "import_batches_teacher_idx" ON "import_batches" USING btree ("teacher_id");--> statement-breakpoint
CREATE INDEX "level1_attempts_child_idx" ON "level1_attempts" USING btree ("child_id");--> statement-breakpoint
CREATE INDEX "level2_attempts_child_idx" ON "level2_attempts" USING btree ("child_id");--> statement-breakpoint
CREATE INDEX "parent_gate_family_idx" ON "parent_gate_credentials" USING btree ("family_id");--> statement-breakpoint
CREATE INDEX "privacy_consents_family_idx" ON "privacy_consents" USING btree ("family_id");--> statement-breakpoint
CREATE INDEX "processed_sync_keys_child_idx" ON "processed_sync_keys" USING btree ("child_id");--> statement-breakpoint
CREATE INDEX "security_logs_created_idx" ON "security_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "security_logs_family_idx" ON "security_logs" USING btree ("family_id");--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_expires_at_idx" ON "sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "smart_assessment_child_idx" ON "smart_assessment_sessions" USING btree ("child_id");--> statement-breakpoint
CREATE INDEX "teacher_exams_teacher_idx" ON "teacher_exams" USING btree ("teacher_id");--> statement-breakpoint
CREATE INDEX "teacher_questions_teacher_idx" ON "teacher_questions" USING btree ("teacher_id");--> statement-breakpoint
CREATE INDEX "trusted_devices_family_idx" ON "trusted_devices" USING btree ("family_id");--> statement-breakpoint
CREATE INDEX "users_role_status_idx" ON "users" USING btree ("role","status");--> statement-breakpoint
CREATE INDEX "users_family_id_idx" ON "users" USING btree ("family_id");--> statement-breakpoint
CREATE INDEX "users_linked_child_id_idx" ON "users" USING btree ("linked_child_id");