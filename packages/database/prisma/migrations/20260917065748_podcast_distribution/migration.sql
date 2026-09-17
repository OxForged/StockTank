-- CreateEnum
CREATE TYPE "PodcastEpisodeType" AS ENUM ('full', 'trailer', 'bonus');

-- CreateEnum
CREATE TYPE "PodcastSyncStatus" AS ENUM ('queued', 'syncing', 'synced', 'failed');

-- AlterTable
ALTER TABLE "episodes" ADD COLUMN     "castopod_episode_id" INTEGER,
ADD COLUMN     "episode_type" "PodcastEpisodeType" NOT NULL DEFAULT 'full',
ADD COLUMN     "podcast_sync_error" TEXT,
ADD COLUMN     "podcast_sync_status" "PodcastSyncStatus",
ADD COLUMN     "podcast_synced_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "shows" ADD COLUMN     "castopod_podcast_id" INTEGER,
ADD COLUMN     "podcast_author" TEXT,
ADD COLUMN     "podcast_category" TEXT,
ADD COLUMN     "podcast_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "podcast_explicit" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "podcast_language" TEXT NOT NULL DEFAULT 'en',
ADD COLUMN     "podcast_subcategory" TEXT;

