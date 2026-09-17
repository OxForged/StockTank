-- CreateEnum
CREATE TYPE "AnalyticsEventType" AS ENUM ('page_view', 'play_start', 'play_progress', 'play_complete', 'share', 'search', 'download');

-- CreateTable
CREATE TABLE "analytics_events" (
    "id" TEXT NOT NULL,
    "type" "AnalyticsEventType" NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "visitor_hash" TEXT NOT NULL,
    "user_id" TEXT,
    "path" TEXT,
    "referrer_host" TEXT,
    "utm_source" TEXT,
    "utm_medium" TEXT,
    "utm_campaign" TEXT,
    "entity_type" TEXT,
    "entity_id" TEXT,
    "show_id" TEXT,
    "media_kind" TEXT,
    "seconds" INTEGER,
    "query" TEXT,
    "channel" TEXT,

    CONSTRAINT "analytics_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "analytics_events_type_occurred_at_idx" ON "analytics_events"("type", "occurred_at");

-- CreateIndex
CREATE INDEX "analytics_events_occurred_at_idx" ON "analytics_events"("occurred_at");

-- CreateIndex
CREATE INDEX "analytics_events_entity_type_entity_id_occurred_at_idx" ON "analytics_events"("entity_type", "entity_id", "occurred_at");

-- CreateIndex
CREATE INDEX "analytics_events_show_id_occurred_at_idx" ON "analytics_events"("show_id", "occurred_at");

-- CreateIndex
CREATE INDEX "analytics_events_visitor_hash_occurred_at_idx" ON "analytics_events"("visitor_hash", "occurred_at");

