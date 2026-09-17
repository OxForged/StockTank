-- AlterTable
ALTER TABLE "media_assets" ADD COLUMN     "target_episode_id" TEXT;

-- CreateIndex
CREATE INDEX "media_assets_target_episode_id_idx" ON "media_assets"("target_episode_id");

