ALTER TABLE "device_tokens"
  ADD COLUMN "session_active" BOOLEAN NOT NULL DEFAULT false;
