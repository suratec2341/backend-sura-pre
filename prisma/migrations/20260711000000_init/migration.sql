-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- Enable pgvector for RAG embeddings.
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_providers" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "provider_uid" TEXT NOT NULL,

    CONSTRAINT "auth_providers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_profiles" (
    "user_id" TEXT NOT NULL,
    "name" TEXT,
    "age" INTEGER,
    "gender" TEXT,
    "weight_kg" DOUBLE PRECISION,
    "height_cm" DOUBLE PRECISION,
    "activity_level" TEXT,
    "exercise_frequency" TEXT,
    "sedentary_hours_per_day" DOUBLE PRECISION,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "user_health_notes" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "condition_note" TEXT,
    "pain_area" TEXT,
    "reported_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_health_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_goals" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "goal_type" TEXT NOT NULL,
    "target_value" DOUBLE PRECISION,
    "start_date" TIMESTAMP(3),
    "end_date" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'active',

    CONSTRAINT "user_goals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_settings" (
    "user_id" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'th',
    "dark_mode" BOOLEAN NOT NULL DEFAULT false,
    "unit_system" TEXT NOT NULL DEFAULT 'metric',
    "time_format" TEXT NOT NULL DEFAULT '24h',
    "date_format" TEXT NOT NULL DEFAULT 'dd/MM/yyyy',

    CONSTRAINT "user_settings_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "quiet_hours_start" TEXT,
    "quiet_hours_end" TEXT,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_consents" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "consent_type" TEXT NOT NULL,
    "granted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMP(3),
    "version" TEXT NOT NULL,

    CONSTRAINT "user_consents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "devices" (
    "id" TEXT NOT NULL,
    "device_model" TEXT NOT NULL,
    "hardware_version" TEXT NOT NULL,

    CONSTRAINT "devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_devices" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "device_id" TEXT NOT NULL,
    "device_serial" TEXT NOT NULL,
    "paired_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unpaired_at" TIMESTAMP(3),
    "auto_reconnect" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "user_devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_status_logs" (
    "id" TEXT NOT NULL,
    "user_device_id" TEXT NOT NULL,
    "sensor_status" TEXT,
    "bluetooth_status" TEXT,
    "signal_strength" INTEGER,
    "logged_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "device_status_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_battery_logs" (
    "id" TEXT NOT NULL,
    "user_device_id" TEXT NOT NULL,
    "battery_left" INTEGER,
    "battery_right" INTEGER,
    "logged_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "device_battery_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_sync_logs" (
    "id" TEXT NOT NULL,
    "user_device_id" TEXT NOT NULL,
    "sync_type" TEXT NOT NULL,
    "steps_synced" INTEGER,
    "distance_synced" DOUBLE PRECISION,
    "pressure_data_synced" BOOLEAN,
    "status" TEXT NOT NULL,
    "synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "device_sync_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "firmware_versions" (
    "id" TEXT NOT NULL,
    "device_model" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "release_notes" TEXT,
    "released_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "firmware_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_calibrations" (
    "id" TEXT NOT NULL,
    "user_device_id" TEXT NOT NULL,
    "foot_size" DOUBLE PRECISION,
    "weight_at_calibration_kg" DOUBLE PRECISION,
    "baseline_pressure_map" TEXT,
    "calibrated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "device_calibrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "device_id" TEXT,
    "activity_type" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL,
    "ended_at" TIMESTAMP(3),
    "duration_sec" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'recording',
    "sync_status" TEXT NOT NULL DEFAULT 'synced',
    "client_session_uuid" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session_routes" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "route_storage_url" TEXT NOT NULL,
    "checksum" TEXT NOT NULL,
    "points_count" INTEGER NOT NULL,

    CONSTRAINT "session_routes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session_metrics" (
    "session_id" TEXT NOT NULL,
    "steps" INTEGER,
    "distance_km" DOUBLE PRECISION,
    "calories" DOUBLE PRECISION,
    "speed_kmh" DOUBLE PRECISION,
    "pace" DOUBLE PRECISION,
    "cadence" DOUBLE PRECISION,
    "ground_contact_ms" DOUBLE PRECISION,
    "foot_lift_height_cm" DOUBLE PRECISION,
    "walk_quality_score" DOUBLE PRECISION,
    "balance_score" DOUBLE PRECISION,
    "algorithm_version" TEXT NOT NULL,

    CONSTRAINT "session_metrics_pkey" PRIMARY KEY ("session_id")
);

-- CreateTable
CREATE TABLE "session_pressure_maps" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "storage_url" TEXT NOT NULL,
    "checksum" TEXT NOT NULL,
    "algorithm_version" TEXT NOT NULL,
    "captured_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "session_pressure_maps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session_pressure_zones" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "foot_side" TEXT NOT NULL,
    "forefoot_percent" DOUBLE PRECISION NOT NULL,
    "midfoot_percent" DOUBLE PRECISION NOT NULL,
    "heel_percent" DOUBLE PRECISION NOT NULL,
    "max_pressure" DOUBLE PRECISION NOT NULL,
    "avg_pressure" DOUBLE PRECISION NOT NULL,
    "hotspot_area" TEXT,
    "pressure_level" TEXT NOT NULL,
    "algorithm_version" TEXT NOT NULL,

    CONSTRAINT "session_pressure_zones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session_gait_metrics" (
    "session_id" TEXT NOT NULL,
    "cadence" DOUBLE PRECISION,
    "step_length" DOUBLE PRECISION,
    "step_time" DOUBLE PRECISION,
    "stance_time" DOUBLE PRECISION,
    "swing_time" DOUBLE PRECISION,
    "double_support_time" DOUBLE PRECISION,
    "stride_length" DOUBLE PRECISION,
    "gait_speed" DOUBLE PRECISION,
    "variability_cv" DOUBLE PRECISION,
    "gait_score" DOUBLE PRECISION,
    "algorithm_version" TEXT NOT NULL,

    CONSTRAINT "session_gait_metrics_pkey" PRIMARY KEY ("session_id")
);

-- CreateTable
CREATE TABLE "session_gait_phases" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "phase_name" TEXT NOT NULL,
    "start_pct" DOUBLE PRECISION NOT NULL,
    "end_pct" DOUBLE PRECISION NOT NULL,
    "foot_side" TEXT NOT NULL,

    CONSTRAINT "session_gait_phases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session_alerts" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "alert_type" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "session_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "risk_assessments" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "assessment_type" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "source_session_id" TEXT,
    "score" DOUBLE PRECISION NOT NULL,
    "risk_level" TEXT NOT NULL,
    "computed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "algorithm_version" TEXT NOT NULL,

    CONSTRAINT "risk_assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_summaries" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "summary_text" TEXT NOT NULL,
    "model_version" TEXT NOT NULL,
    "prompt_version" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_summaries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_insights" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "session_id" TEXT,
    "insight_text" TEXT NOT NULL,
    "insight_type" TEXT NOT NULL,
    "model_version" TEXT NOT NULL,
    "prompt_version" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_insights_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_chat_threads" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "title" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archived_at" TIMESTAMP(3),

    CONSTRAINT "ai_chat_threads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_chat_messages" (
    "id" TEXT NOT NULL,
    "thread_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "context_snapshot_ref" TEXT,
    "model_version" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_recommendations" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "session_id" TEXT,
    "recommendation_text" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "model_version" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_recommendations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_memory_facts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "fact_text" TEXT NOT NULL,
    "fact_category" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "derived_from_episode_ids" TEXT[],
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "superseded_at" TIMESTAMP(3),

    CONSTRAINT "user_memory_facts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "episode_summaries" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "period_type" TEXT NOT NULL,
    "period_start" TIMESTAMP(3) NOT NULL,
    "period_end" TIMESTAMP(3) NOT NULL,
    "summary_text" TEXT NOT NULL,
    "key_metrics_json" JSONB,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "algorithm_version" TEXT NOT NULL,

    CONSTRAINT "episode_summaries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_percentile_stats" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "cohort_key" TEXT NOT NULL,
    "metric_name" TEXT NOT NULL,
    "percentile_rank" DOUBLE PRECISION NOT NULL,
    "computed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_percentile_stats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rag_documents" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "related_condition_tags" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rag_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rag_chunks" (
    "id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "chunk_text" TEXT NOT NULL,
    "chunk_index" INTEGER NOT NULL,

    CONSTRAINT "rag_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rag_embeddings" (
    "id" TEXT NOT NULL,
    "chunk_id" TEXT NOT NULL,
    "embedding_model_version" TEXT NOT NULL,

    CONSTRAINT "rag_embeddings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exercise_programs" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "duration_weeks" INTEGER,
    "difficulty" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "version" TEXT NOT NULL DEFAULT '1.0',
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "published_at" TIMESTAMP(3),

    CONSTRAINT "exercise_programs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exercise_videos" (
    "id" TEXT NOT NULL,
    "program_id" TEXT,
    "order_index" INTEGER NOT NULL DEFAULT 0,
    "youtube_url" TEXT NOT NULL,
    "youtube_video_id" TEXT NOT NULL,
    "source_type" TEXT NOT NULL DEFAULT 'own_channel',
    "title" TEXT NOT NULL,
    "ai_description" TEXT,
    "thumbnail_url" TEXT,
    "duration_sec" INTEGER,
    "language" TEXT NOT NULL DEFAULT 'th',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "link_status" TEXT NOT NULL DEFAULT 'active',
    "last_link_checked_at" TIMESTAMP(3),
    "created_by" TEXT,
    "reviewed_by" TEXT,
    "published_at" TIMESTAMP(3),

    CONSTRAINT "exercise_videos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_tags" (
    "id" TEXT NOT NULL,
    "tag_name" TEXT NOT NULL,
    "category" TEXT NOT NULL,

    CONSTRAINT "content_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "program_tags" (
    "program_id" TEXT NOT NULL,
    "tag_id" TEXT NOT NULL,

    CONSTRAINT "program_tags_pkey" PRIMARY KEY ("program_id","tag_id")
);

-- CreateTable
CREATE TABLE "program_recommendation_rules" (
    "id" TEXT NOT NULL,
    "condition_tag" TEXT NOT NULL,
    "severity_min" DOUBLE PRECISION,
    "severity_max" DOUBLE PRECISION,
    "target_program_id" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "program_recommendation_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_program_assignments" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "program_id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'in_progress',
    "user_feedback" TEXT,

    CONSTRAINT "user_program_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_review_logs" (
    "id" TEXT NOT NULL,
    "content_id" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "reviewer_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "note" TEXT,
    "reviewed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_review_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_events" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "payload_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_rules" (
    "id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "condition_json" JSONB,
    "cooldown_minutes" INTEGER NOT NULL,

    CONSTRAINT "notification_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_delivery_logs" (
    "id" TEXT NOT NULL,
    "notification_id" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "provider_message_id" TEXT,
    "status" TEXT NOT NULL,
    "delivered_at" TIMESTAMP(3),

    CONSTRAINT "notification_delivery_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "health_integrations" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'connected',
    "connected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "health_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "health_sync_logs" (
    "id" TEXT NOT NULL,
    "integration_id" TEXT NOT NULL,
    "sync_started_at" TIMESTAMP(3) NOT NULL,
    "sync_finished_at" TIMESTAMP(3),
    "status" TEXT NOT NULL,
    "records_synced" INTEGER,

    CONSTRAINT "health_sync_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "health_daily_summaries" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "steps" INTEGER,
    "distance_km" DOUBLE PRECISION,
    "calories" DOUBLE PRECISION,
    "heart_rate_avg" DOUBLE PRECISION,

    CONSTRAINT "health_daily_summaries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_access_logs" (
    "id" TEXT NOT NULL,
    "staff_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "target_id" TEXT,
    "details" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_access_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "auth_providers_provider_provider_uid_key" ON "auth_providers"("provider", "provider_uid");

-- CreateIndex
CREATE UNIQUE INDEX "notification_preferences_user_id_channel_category_key" ON "notification_preferences"("user_id", "channel", "category");

-- CreateIndex
CREATE UNIQUE INDEX "devices_device_model_key" ON "devices"("device_model");

-- CreateIndex
CREATE UNIQUE INDEX "firmware_versions_device_model_version_key" ON "firmware_versions"("device_model", "version");

-- CreateIndex
CREATE UNIQUE INDEX "activity_sessions_client_session_uuid_key" ON "activity_sessions"("client_session_uuid");

-- CreateIndex
CREATE INDEX "activity_sessions_user_id_started_at_idx" ON "activity_sessions"("user_id", "started_at");

-- CreateIndex
CREATE UNIQUE INDEX "session_routes_session_id_key" ON "session_routes"("session_id");

-- CreateIndex
CREATE INDEX "risk_assessments_user_id_computed_at_idx" ON "risk_assessments"("user_id", "computed_at");

-- CreateIndex
CREATE UNIQUE INDEX "ai_summaries_session_id_key" ON "ai_summaries"("session_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_percentile_stats_user_id_cohort_key_metric_name_key" ON "user_percentile_stats"("user_id", "cohort_key", "metric_name");

-- CreateIndex
CREATE UNIQUE INDEX "rag_embeddings_chunk_id_key" ON "rag_embeddings"("chunk_id");

-- CreateIndex
CREATE UNIQUE INDEX "content_tags_tag_name_key" ON "content_tags"("tag_name");

-- CreateIndex
CREATE INDEX "content_review_logs_content_type_content_id_idx" ON "content_review_logs"("content_type", "content_id");

-- CreateIndex
CREATE INDEX "notifications_user_id_created_at_idx" ON "notifications"("user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "health_daily_summaries_user_id_date_key" ON "health_daily_summaries"("user_id", "date");

-- AddForeignKey
ALTER TABLE "auth_providers" ADD CONSTRAINT "auth_providers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_health_notes" ADD CONSTRAINT "user_health_notes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_goals" ADD CONSTRAINT "user_goals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_consents" ADD CONSTRAINT "user_consents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_devices" ADD CONSTRAINT "user_devices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_devices" ADD CONSTRAINT "user_devices_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_status_logs" ADD CONSTRAINT "device_status_logs_user_device_id_fkey" FOREIGN KEY ("user_device_id") REFERENCES "user_devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_battery_logs" ADD CONSTRAINT "device_battery_logs_user_device_id_fkey" FOREIGN KEY ("user_device_id") REFERENCES "user_devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_sync_logs" ADD CONSTRAINT "device_sync_logs_user_device_id_fkey" FOREIGN KEY ("user_device_id") REFERENCES "user_devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "firmware_versions" ADD CONSTRAINT "firmware_versions_device_model_fkey" FOREIGN KEY ("device_model") REFERENCES "devices"("device_model") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_calibrations" ADD CONSTRAINT "device_calibrations_user_device_id_fkey" FOREIGN KEY ("user_device_id") REFERENCES "user_devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_sessions" ADD CONSTRAINT "activity_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_sessions" ADD CONSTRAINT "activity_sessions_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "user_devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_routes" ADD CONSTRAINT "session_routes_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "activity_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_metrics" ADD CONSTRAINT "session_metrics_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "activity_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_pressure_maps" ADD CONSTRAINT "session_pressure_maps_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "activity_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_pressure_zones" ADD CONSTRAINT "session_pressure_zones_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "activity_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_gait_metrics" ADD CONSTRAINT "session_gait_metrics_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "activity_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_gait_phases" ADD CONSTRAINT "session_gait_phases_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "activity_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_alerts" ADD CONSTRAINT "session_alerts_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "activity_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_assessments" ADD CONSTRAINT "risk_assessments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_summaries" ADD CONSTRAINT "ai_summaries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_summaries" ADD CONSTRAINT "ai_summaries_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "activity_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_insights" ADD CONSTRAINT "ai_insights_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_insights" ADD CONSTRAINT "ai_insights_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "activity_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_chat_threads" ADD CONSTRAINT "ai_chat_threads_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_chat_messages" ADD CONSTRAINT "ai_chat_messages_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "ai_chat_threads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_recommendations" ADD CONSTRAINT "ai_recommendations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_memory_facts" ADD CONSTRAINT "user_memory_facts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "episode_summaries" ADD CONSTRAINT "episode_summaries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_percentile_stats" ADD CONSTRAINT "user_percentile_stats_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rag_chunks" ADD CONSTRAINT "rag_chunks_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "rag_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rag_embeddings" ADD CONSTRAINT "rag_embeddings_chunk_id_fkey" FOREIGN KEY ("chunk_id") REFERENCES "rag_chunks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercise_videos" ADD CONSTRAINT "exercise_videos_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "exercise_programs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "program_tags" ADD CONSTRAINT "program_tags_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "exercise_programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "program_tags" ADD CONSTRAINT "program_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "content_tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "program_recommendation_rules" ADD CONSTRAINT "program_recommendation_rules_target_program_id_fkey" FOREIGN KEY ("target_program_id") REFERENCES "exercise_programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_program_assignments" ADD CONSTRAINT "user_program_assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_program_assignments" ADD CONSTRAINT "user_program_assignments_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "exercise_programs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_delivery_logs" ADD CONSTRAINT "notification_delivery_logs_notification_id_fkey" FOREIGN KEY ("notification_id") REFERENCES "notifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "health_integrations" ADD CONSTRAINT "health_integrations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "health_sync_logs" ADD CONSTRAINT "health_sync_logs_integration_id_fkey" FOREIGN KEY ("integration_id") REFERENCES "health_integrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

