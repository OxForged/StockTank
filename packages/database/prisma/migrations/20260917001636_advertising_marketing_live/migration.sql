-- CreateEnum
CREATE TYPE "LivestreamStatus" AS ENUM ('scheduled', 'live', 'ended', 'cancelled');

-- CreateEnum
CREATE TYPE "AdvertiserStatus" AS ENUM ('pending_review', 'approved', 'suspended');

-- CreateEnum
CREATE TYPE "PlacementSurface" AS ENUM ('web', 'newsletter', 'audio', 'video');

-- CreateEnum
CREATE TYPE "PlacementFormat" AS ENUM ('sponsor_banner', 'native_card', 'leaderboard', 'sidebar_card', 'audio_read', 'video_preroll', 'show_sponsorship', 'newsletter_slot');

-- CreateEnum
CREATE TYPE "PricingModel" AS ENUM ('cpm', 'flat_week', 'flat_episode', 'flat_issue');

-- CreateEnum
CREATE TYPE "RateVisibility" AS ENUM ('public', 'on_request');

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('draft', 'in_review', 'approved', 'rejected', 'paused', 'completed');

-- CreateEnum
CREATE TYPE "CreativeKind" AS ENUM ('display', 'native', 'audio_script', 'video');

-- CreateEnum
CREATE TYPE "InquiryStatus" AS ENUM ('new', 'contacted', 'qualified', 'proposal_sent', 'won', 'lost', 'spam');

-- CreateEnum
CREATE TYPE "BudgetRange" AS ENUM ('under_5k', 'from_5k_to_25k', 'from_25k_to_100k', 'over_100k', 'undisclosed');

-- CreateEnum
CREATE TYPE "SubscriberStatus" AS ENUM ('pending', 'confirmed', 'unsubscribed');

-- CreateTable
CREATE TABLE "livestreams" (
    "id" TEXT NOT NULL,
    "show_id" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "LivestreamStatus" NOT NULL DEFAULT 'scheduled',
    "scheduled_start" TIMESTAMP(3) NOT NULL,
    "scheduled_end" TIMESTAMP(3),
    "started_at" TIMESTAMP(3),
    "ended_at" TIMESTAMP(3),
    "stream_url" TEXT,
    "is_demo" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "livestreams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "livestream_segments" (
    "id" TEXT NOT NULL,
    "livestream_id" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "title" TEXT NOT NULL,

    CONSTRAINT "livestream_segments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "advertisers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "website" TEXT,
    "contact_name" TEXT,
    "contact_email" TEXT,
    "industry" TEXT,
    "status" "AdvertiserStatus" NOT NULL DEFAULT 'pending_review',
    "compliance_notes" TEXT,
    "is_house" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "advertisers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ad_placements" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "surface" "PlacementSurface" NOT NULL,
    "format" "PlacementFormat" NOT NULL,
    "specs" TEXT NOT NULL,
    "pricing_model" "PricingModel" NOT NULL,
    "rate_cents" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "rate_visibility" "RateVisibility" NOT NULL DEFAULT 'on_request',
    "max_active_campaigns" INTEGER NOT NULL DEFAULT 1,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ad_placements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaigns" (
    "id" TEXT NOT NULL,
    "advertiser_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "objective" TEXT,
    "status" "CampaignStatus" NOT NULL DEFAULT 'draft',
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3) NOT NULL,
    "pricing_model" "PricingModel" NOT NULL,
    "rate_cents" INTEGER NOT NULL,
    "budget_cents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "impression_goal" INTEGER,
    "frequency_cap_per_day" INTEGER,
    "weight" INTEGER NOT NULL DEFAULT 1,
    "created_by_id" TEXT,
    "submitted_at" TIMESTAMP(3),
    "reviewed_by_id" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "rejection_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaign_placements" (
    "campaign_id" TEXT NOT NULL,
    "placement_id" TEXT NOT NULL,

    CONSTRAINT "campaign_placements_pkey" PRIMARY KEY ("campaign_id","placement_id")
);

-- CreateTable
CREATE TABLE "creative_assets" (
    "id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "kind" "CreativeKind" NOT NULL,
    "headline" TEXT NOT NULL,
    "body" TEXT,
    "image_url" TEXT,
    "alt_text" TEXT,
    "cta_label" TEXT NOT NULL DEFAULT 'Learn more',
    "click_url" TEXT NOT NULL,
    "disclosure_label" TEXT NOT NULL DEFAULT 'Sponsored',
    "review_status" "PublishStatus" NOT NULL DEFAULT 'draft',
    "policy_flags" TEXT[],
    "review_notes" TEXT,
    "reviewed_by_id" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "creative_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ad_impressions" (
    "id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "creative_id" TEXT NOT NULL,
    "placement_id" TEXT NOT NULL,
    "visitor_hash" TEXT,
    "user_id" TEXT,
    "page_path" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ad_impressions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ad_clicks" (
    "id" TEXT NOT NULL,
    "impression_id" TEXT,
    "campaign_id" TEXT NOT NULL,
    "creative_id" TEXT NOT NULL,
    "placement_id" TEXT NOT NULL,
    "visitor_hash" TEXT,
    "user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ad_clicks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "advertising_inquiries" (
    "id" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "contact_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "website" TEXT,
    "budget_range" "BudgetRange" NOT NULL,
    "placement_keys" TEXT[],
    "message" TEXT NOT NULL,
    "status" "InquiryStatus" NOT NULL DEFAULT 'new',
    "notes" TEXT,
    "advertiser_id" TEXT,
    "assigned_to_id" TEXT,
    "utm_source" TEXT,
    "utm_medium" TEXT,
    "utm_campaign" TEXT,
    "referrer" TEXT,
    "ip_hash" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "advertising_inquiries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "newsletter_subscribers" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "status" "SubscriberStatus" NOT NULL DEFAULT 'pending',
    "source" TEXT,
    "utm_source" TEXT,
    "utm_medium" TEXT,
    "utm_campaign" TEXT,
    "consent_at" TIMESTAMP(3) NOT NULL,
    "confirm_token_hash" TEXT,
    "confirm_sent_at" TIMESTAMP(3),
    "confirmed_at" TIMESTAMP(3),
    "unsubscribe_token_hash" TEXT NOT NULL,
    "unsubscribed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "newsletter_subscribers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "livestreams_status_scheduled_start_idx" ON "livestreams"("status", "scheduled_start");

-- CreateIndex
CREATE UNIQUE INDEX "livestream_segments_livestream_id_position_key" ON "livestream_segments"("livestream_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "advertisers_slug_key" ON "advertisers"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "ad_placements_key_key" ON "ad_placements"("key");

-- CreateIndex
CREATE INDEX "campaigns_status_starts_at_ends_at_idx" ON "campaigns"("status", "starts_at", "ends_at");

-- CreateIndex
CREATE INDEX "campaigns_advertiser_id_idx" ON "campaigns"("advertiser_id");

-- CreateIndex
CREATE INDEX "creative_assets_campaign_id_review_status_idx" ON "creative_assets"("campaign_id", "review_status");

-- CreateIndex
CREATE INDEX "ad_impressions_campaign_id_created_at_idx" ON "ad_impressions"("campaign_id", "created_at");

-- CreateIndex
CREATE INDEX "ad_impressions_placement_id_created_at_idx" ON "ad_impressions"("placement_id", "created_at");

-- CreateIndex
CREATE INDEX "ad_clicks_campaign_id_created_at_idx" ON "ad_clicks"("campaign_id", "created_at");

-- CreateIndex
CREATE INDEX "advertising_inquiries_status_created_at_idx" ON "advertising_inquiries"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "newsletter_subscribers_email_key" ON "newsletter_subscribers"("email");

-- CreateIndex
CREATE UNIQUE INDEX "newsletter_subscribers_confirm_token_hash_key" ON "newsletter_subscribers"("confirm_token_hash");

-- CreateIndex
CREATE UNIQUE INDEX "newsletter_subscribers_unsubscribe_token_hash_key" ON "newsletter_subscribers"("unsubscribe_token_hash");

-- CreateIndex
CREATE INDEX "newsletter_subscribers_status_idx" ON "newsletter_subscribers"("status");

-- AddForeignKey
ALTER TABLE "livestreams" ADD CONSTRAINT "livestreams_show_id_fkey" FOREIGN KEY ("show_id") REFERENCES "shows"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "livestream_segments" ADD CONSTRAINT "livestream_segments_livestream_id_fkey" FOREIGN KEY ("livestream_id") REFERENCES "livestreams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_advertiser_id_fkey" FOREIGN KEY ("advertiser_id") REFERENCES "advertisers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_placements" ADD CONSTRAINT "campaign_placements_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_placements" ADD CONSTRAINT "campaign_placements_placement_id_fkey" FOREIGN KEY ("placement_id") REFERENCES "ad_placements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "creative_assets" ADD CONSTRAINT "creative_assets_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_impressions" ADD CONSTRAINT "ad_impressions_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_impressions" ADD CONSTRAINT "ad_impressions_creative_id_fkey" FOREIGN KEY ("creative_id") REFERENCES "creative_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_impressions" ADD CONSTRAINT "ad_impressions_placement_id_fkey" FOREIGN KEY ("placement_id") REFERENCES "ad_placements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_clicks" ADD CONSTRAINT "ad_clicks_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_clicks" ADD CONSTRAINT "ad_clicks_creative_id_fkey" FOREIGN KEY ("creative_id") REFERENCES "creative_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_clicks" ADD CONSTRAINT "ad_clicks_placement_id_fkey" FOREIGN KEY ("placement_id") REFERENCES "ad_placements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "advertising_inquiries" ADD CONSTRAINT "advertising_inquiries_advertiser_id_fkey" FOREIGN KEY ("advertiser_id") REFERENCES "advertisers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
