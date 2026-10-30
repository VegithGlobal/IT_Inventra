-- Subscription categories become free text so users can add their own.
-- Existing rows keep their built-in codes (ISP, CLOUD, ...) as plain text.
ALTER TABLE "Subscription" ALTER COLUMN "category" TYPE TEXT USING "category"::text;

DROP TYPE "SubscriptionCategory";
