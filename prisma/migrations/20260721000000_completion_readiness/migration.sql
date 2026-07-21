ALTER TABLE "notification_events"
ADD COLUMN IF NOT EXISTS "processed_at" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "processing_error" TEXT;

ALTER TABLE "notifications"
ADD COLUMN IF NOT EXISTS "source_event_id" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "notifications_source_event_id_key"
ON "notifications"("source_event_id");

CREATE INDEX IF NOT EXISTS "notification_events_processed_at_created_at_idx"
ON "notification_events"("processed_at", "created_at");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'notifications_source_event_id_fkey'
  ) THEN
    ALTER TABLE "notifications"
    ADD CONSTRAINT "notifications_source_event_id_fkey"
    FOREIGN KEY ("source_event_id") REFERENCES "notification_events"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "push_registrations" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "platform" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "last_error" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "push_registrations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "push_registrations_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "push_registrations_token_key"
ON "push_registrations"("token");

CREATE INDEX IF NOT EXISTS "push_registrations_user_id_active_idx"
ON "push_registrations"("user_id", "active");

CREATE UNIQUE INDEX IF NOT EXISTS "episode_summaries_user_period_key"
ON "episode_summaries"("user_id", "period_type", "period_start", "period_end");
