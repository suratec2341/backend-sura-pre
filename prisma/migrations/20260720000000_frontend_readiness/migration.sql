-- Fields collected by the mobile onboarding and profile flows.
ALTER TABLE "user_profiles"
ADD COLUMN IF NOT EXISTS "birthday" DATE,
ADD COLUMN IF NOT EXISTS "primary_footwear" TEXT,
ADD COLUMN IF NOT EXISTS "foot_size_left" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "foot_size_right" DOUBLE PRECISION;

-- Age becomes stale every year. Birthday is the persisted source of truth;
-- API responses calculate the current age dynamically.
ALTER TABLE "user_profiles"
DROP COLUMN IF EXISTS "age";

ALTER TABLE "user_health_notes"
ADD COLUMN IF NOT EXISTS "medical_conditions" JSONB,
ADD COLUMN IF NOT EXISTS "injury_history" TEXT,
ADD COLUMN IF NOT EXISTS "current_medications" JSONB,
ADD COLUMN IF NOT EXISTS "pain_level" INTEGER,
ADD COLUMN IF NOT EXISTS "pain_points" JSONB;

ALTER TABLE "device_calibrations"
ADD COLUMN IF NOT EXISTS "foot_size_left" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "foot_size_right" DOUBLE PRECISION;

-- Keep pairing history while preventing the same physical serial from being
-- actively owned by two accounts during concurrent requests.
CREATE UNIQUE INDEX IF NOT EXISTS "user_devices_active_serial_key"
ON "user_devices"("device_serial") WHERE "unpaired_at" IS NULL;

-- A client-generated id only needs to be unique within its owner. This also
-- prevents one account from reserving an id that another account may generate.
DROP INDEX IF EXISTS "activity_sessions_client_session_uuid_key";
CREATE UNIQUE INDEX IF NOT EXISTS "activity_sessions_user_id_client_session_uuid_key"
ON "activity_sessions"("user_id", "client_session_uuid");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_health_notes_pain_level_check'
  ) THEN
    ALTER TABLE "user_health_notes"
    ADD CONSTRAINT "user_health_notes_pain_level_check"
    CHECK ("pain_level" IS NULL OR "pain_level" BETWEEN 0 AND 10);
  END IF;
END $$;

-- Protocol-neutral storage lets the API safely accept JSON/NDJSON sensor data
-- before the insole packet format and derived algorithms are finalized.
CREATE TABLE IF NOT EXISTS "session_sensor_samples" (
  "id" UUID NOT NULL,
  "session_id" UUID NOT NULL,
  "sequence" INTEGER,
  "recorded_at" TIMESTAMP(3) NOT NULL,
  "source" TEXT NOT NULL DEFAULT 'api',
  "payload" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "session_sensor_samples_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "session_sensor_samples_session_id_fkey"
    FOREIGN KEY ("session_id") REFERENCES "activity_sessions"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "session_sensor_samples_session_id_recorded_at_idx"
ON "session_sensor_samples"("session_id", "recorded_at");

CREATE UNIQUE INDEX IF NOT EXISTS "session_sensor_samples_session_id_sequence_key"
ON "session_sensor_samples"("session_id", "sequence");
