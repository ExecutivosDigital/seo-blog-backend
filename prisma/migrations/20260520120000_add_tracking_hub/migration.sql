-- CreateEnum
CREATE TYPE "TrackingLeadStatus" AS ENUM ('NEW', 'CONTACTED', 'QUALIFIED', 'CONVERTED', 'LOST');

-- AlterTable
ALTER TABLE "sites" ADD COLUMN     "public_key" UUID NOT NULL DEFAULT gen_random_uuid(),
ADD COLUMN     "tracking_enabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "tracking_sessions" (
    "id" UUID NOT NULL,
    "site_id" UUID NOT NULL,
    "anonymous_id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMP(3),
    "first_referrer" TEXT,
    "first_landing_path" TEXT,
    "user_agent" TEXT,
    "device_type" TEXT,
    "locale" TEXT,
    "ip_hash" TEXT,
    "country" TEXT,
    "city" TEXT,
    "is_bot" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tracking_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tracking_events" (
    "id" UUID NOT NULL,
    "event_id" TEXT NOT NULL,
    "site_id" UUID NOT NULL,
    "session_id" TEXT NOT NULL,
    "anonymous_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "path" TEXT,
    "element_id" TEXT,
    "properties" JSONB NOT NULL DEFAULT '{}',
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "schema_version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "tracking_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tracking_attribution" (
    "session_id" TEXT NOT NULL,
    "site_id" UUID NOT NULL,
    "anonymous_id" TEXT NOT NULL,
    "utm_source" TEXT,
    "utm_medium" TEXT,
    "utm_campaign" TEXT,
    "utm_term" TEXT,
    "utm_content" TEXT,
    "gclid" TEXT,
    "fbclid" TEXT,
    "referrer" TEXT,
    "landing_path" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tracking_attribution_pkey" PRIMARY KEY ("session_id")
);

-- CreateTable
CREATE TABLE "tracking_leads" (
    "id" UUID NOT NULL,
    "site_id" UUID NOT NULL,
    "session_id" TEXT,
    "anonymous_id" TEXT,
    "name" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "source" TEXT,
    "button_id" TEXT,
    "destination" TEXT,
    "source_url" TEXT,
    "utm_source" TEXT,
    "utm_medium" TEXT,
    "utm_campaign" TEXT,
    "status" "TrackingLeadStatus" NOT NULL DEFAULT 'NEW',
    "notes" TEXT,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "consent_lgpd" BOOLEAN NOT NULL DEFAULT false,
    "dedupe_hash" TEXT,
    "ip_hash" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tracking_leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tracking_consent_log" (
    "id" UUID NOT NULL,
    "site_id" UUID NOT NULL,
    "anonymous_id" TEXT NOT NULL,
    "session_id" TEXT,
    "consent_analytics" BOOLEAN NOT NULL,
    "consent_marketing" BOOLEAN NOT NULL,
    "consent_version" TEXT NOT NULL,
    "ip_hash" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tracking_consent_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tracking_sessions_session_id_key" ON "tracking_sessions"("session_id");

-- CreateIndex
CREATE INDEX "tracking_sessions_site_id_started_at_idx" ON "tracking_sessions"("site_id", "started_at");

-- CreateIndex
CREATE INDEX "tracking_sessions_anonymous_id_idx" ON "tracking_sessions"("anonymous_id");

-- CreateIndex
CREATE UNIQUE INDEX "tracking_events_event_id_key" ON "tracking_events"("event_id");

-- CreateIndex
CREATE INDEX "tracking_events_site_id_name_occurred_at_idx" ON "tracking_events"("site_id", "name", "occurred_at");

-- CreateIndex
CREATE INDEX "tracking_events_session_id_occurred_at_idx" ON "tracking_events"("session_id", "occurred_at");

-- CreateIndex
CREATE INDEX "tracking_attribution_site_id_utm_source_utm_campaign_idx" ON "tracking_attribution"("site_id", "utm_source", "utm_campaign");

-- CreateIndex
CREATE INDEX "tracking_attribution_anonymous_id_created_at_idx" ON "tracking_attribution"("anonymous_id", "created_at");

-- CreateIndex
CREATE INDEX "tracking_leads_site_id_created_at_idx" ON "tracking_leads"("site_id", "created_at");

-- CreateIndex
CREATE INDEX "tracking_leads_site_id_status_idx" ON "tracking_leads"("site_id", "status");

-- CreateIndex
CREATE INDEX "tracking_leads_email_idx" ON "tracking_leads"("email");

-- CreateIndex
CREATE INDEX "tracking_leads_dedupe_hash_idx" ON "tracking_leads"("dedupe_hash");

-- CreateIndex
CREATE INDEX "tracking_consent_log_site_id_anonymous_id_idx" ON "tracking_consent_log"("site_id", "anonymous_id");

-- CreateIndex
CREATE UNIQUE INDEX "sites_public_key_key" ON "sites"("public_key");
