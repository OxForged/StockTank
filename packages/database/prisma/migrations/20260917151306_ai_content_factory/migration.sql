-- CreateEnum
CREATE TYPE "TranscriptStatus" AS ENUM ('queued', 'processing', 'ready', 'failed');

-- CreateEnum
CREATE TYPE "AiDraftKind" AS ENUM ('summary', 'show_notes', 'seo', 'chapters', 'quotes', 'clip_candidates', 'social_posts', 'newsletter', 'article', 'entities', 'topics');

-- CreateEnum
CREATE TYPE "AiDraftStatus" AS ENUM ('draft', 'review', 'approved', 'rejected', 'published');

-- CreateEnum
CREATE TYPE "AiJobType" AS ENUM ('transcribe', 'content_factory');

-- CreateEnum
CREATE TYPE "AiJobStatus" AS ENUM ('queued', 'running', 'succeeded', 'failed');

-- CreateTable
CREATE TABLE "transcripts" (
    "id" TEXT NOT NULL,
    "episode_id" TEXT NOT NULL,
    "status" "TranscriptStatus" NOT NULL DEFAULT 'queued',
    "provider" TEXT,
    "model" TEXT,
    "language" TEXT,
    "text" TEXT,
    "segments" JSONB,
    "speakers" TEXT[],
    "confidence" DOUBLE PRECISION,
    "duration_seconds" DOUBLE PRECISION,
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transcripts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_drafts" (
    "id" TEXT NOT NULL,
    "episode_id" TEXT NOT NULL,
    "kind" "AiDraftKind" NOT NULL,
    "status" "AiDraftStatus" NOT NULL DEFAULT 'review',
    "content" JSONB NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "prompt_version" TEXT NOT NULL,
    "citations" JSONB,
    "moderation_flags" TEXT[],
    "reviewer_id" TEXT,
    "review_note" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "applied_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_jobs" (
    "id" TEXT NOT NULL,
    "type" "AiJobType" NOT NULL,
    "status" "AiJobStatus" NOT NULL DEFAULT 'queued',
    "episode_id" TEXT,
    "kinds" TEXT[],
    "requested_by" TEXT,
    "error" TEXT,
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "transcripts_episode_id_key" ON "transcripts"("episode_id");

-- CreateIndex
CREATE INDEX "ai_drafts_status_created_at_idx" ON "ai_drafts"("status", "created_at");

-- CreateIndex
CREATE INDEX "ai_drafts_episode_id_kind_idx" ON "ai_drafts"("episode_id", "kind");

-- CreateIndex
CREATE INDEX "ai_jobs_status_created_at_idx" ON "ai_jobs"("status", "created_at");

-- CreateIndex
CREATE INDEX "ai_jobs_episode_id_created_at_idx" ON "ai_jobs"("episode_id", "created_at");

-- AddForeignKey
ALTER TABLE "transcripts" ADD CONSTRAINT "transcripts_episode_id_fkey" FOREIGN KEY ("episode_id") REFERENCES "episodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_drafts" ADD CONSTRAINT "ai_drafts_episode_id_fkey" FOREIGN KEY ("episode_id") REFERENCES "episodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

