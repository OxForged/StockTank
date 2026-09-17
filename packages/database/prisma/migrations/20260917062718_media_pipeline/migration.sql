-- CreateEnum
CREATE TYPE "MediaKind" AS ENUM ('video', 'audio');

-- CreateEnum
CREATE TYPE "MediaStatus" AS ENUM ('pending_upload', 'uploaded', 'processing', 'ready', 'failed');

-- AlterTable
ALTER TABLE "clips" ADD COLUMN     "render_error" TEXT,
ADD COLUMN     "render_status" "MediaStatus",
ADD COLUMN     "renditions" JSONB;

-- AlterTable
ALTER TABLE "episodes" ADD COLUMN     "media_asset_id" TEXT;

-- CreateTable
CREATE TABLE "media_assets" (
    "id" TEXT NOT NULL,
    "kind" "MediaKind" NOT NULL,
    "status" "MediaStatus" NOT NULL DEFAULT 'pending_upload',
    "original_key" TEXT NOT NULL,
    "original_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" BIGINT NOT NULL,
    "duration_seconds" DOUBLE PRECISION,
    "width" INTEGER,
    "height" INTEGER,
    "renditions" JSONB,
    "error" TEXT,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "created_by_id" TEXT,
    "processing_started_at" TIMESTAMP(3),
    "ready_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "media_assets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "media_assets_original_key_key" ON "media_assets"("original_key");

-- CreateIndex
CREATE INDEX "media_assets_status_created_at_idx" ON "media_assets"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "episodes_media_asset_id_key" ON "episodes"("media_asset_id");

-- AddForeignKey
ALTER TABLE "episodes" ADD CONSTRAINT "episodes_media_asset_id_fkey" FOREIGN KEY ("media_asset_id") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

