-- Authentication fields used by JWT RBAC and server-side 2FA.
ALTER TABLE "users"
ADD COLUMN IF NOT EXISTS "role" TEXT NOT NULL DEFAULT 'user',
ADD COLUMN IF NOT EXISTS "two_factor_secret" TEXT,
ADD COLUMN IF NOT EXISTS "two_factor_enabled" BOOLEAN NOT NULL DEFAULT false;

-- Relations declared in schema.prisma but absent from the initial migration.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'notification_events_user_id_fkey'
  ) THEN
    ALTER TABLE "notification_events"
    ADD CONSTRAINT "notification_events_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'health_daily_summaries_user_id_fkey'
  ) THEN
    ALTER TABLE "health_daily_summaries"
    ADD CONSTRAINT "health_daily_summaries_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
