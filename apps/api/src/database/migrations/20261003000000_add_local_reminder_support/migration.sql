ALTER TABLE "device_tokens"
ADD COLUMN "supports_local_reminders" BOOLEAN NOT NULL DEFAULT false;
