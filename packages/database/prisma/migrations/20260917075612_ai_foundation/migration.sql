-- CreateEnum
CREATE TYPE "AiBudgetScope" AS ENUM ('global', 'feature', 'personality');

-- CreateTable
CREATE TABLE "ai_personalities" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "avatar_url" TEXT,
    "voice_id" TEXT,
    "description" TEXT,
    "personality_prompt" TEXT NOT NULL,
    "prompt_version" INTEGER NOT NULL DEFAULT 1,
    "tone" TEXT,
    "expertise" TEXT[],
    "disclosures" TEXT NOT NULL,
    "status" "PublishStatus" NOT NULL DEFAULT 'draft',
    "host_id" TEXT,
    "is_demo" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_personalities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_prompt_versions" (
    "id" TEXT NOT NULL,
    "personality_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "note" TEXT,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_prompt_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_usage" (
    "id" TEXT NOT NULL,
    "feature" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "personality_id" TEXT,
    "input_tokens" INTEGER NOT NULL DEFAULT 0,
    "output_tokens" INTEGER NOT NULL DEFAULT 0,
    "audio_seconds" DOUBLE PRECISION,
    "cost_micros" BIGINT,
    "latency_ms" INTEGER NOT NULL,
    "success" BOOLEAN NOT NULL,
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_usage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_budgets" (
    "id" TEXT NOT NULL,
    "scope" "AiBudgetScope" NOT NULL,
    "scope_key" TEXT NOT NULL DEFAULT '',
    "monthly_limit_micros" BIGINT NOT NULL,
    "hard_limit" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_budgets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ai_personalities_slug_key" ON "ai_personalities"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "ai_personalities_host_id_key" ON "ai_personalities"("host_id");

-- CreateIndex
CREATE UNIQUE INDEX "ai_prompt_versions_personality_id_version_key" ON "ai_prompt_versions"("personality_id", "version");

-- CreateIndex
CREATE INDEX "ai_usage_created_at_idx" ON "ai_usage"("created_at");

-- CreateIndex
CREATE INDEX "ai_usage_feature_created_at_idx" ON "ai_usage"("feature", "created_at");

-- CreateIndex
CREATE INDEX "ai_usage_personality_id_created_at_idx" ON "ai_usage"("personality_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "ai_budgets_scope_scope_key_key" ON "ai_budgets"("scope", "scope_key");

-- AddForeignKey
ALTER TABLE "ai_prompt_versions" ADD CONSTRAINT "ai_prompt_versions_personality_id_fkey" FOREIGN KEY ("personality_id") REFERENCES "ai_personalities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_usage" ADD CONSTRAINT "ai_usage_personality_id_fkey" FOREIGN KEY ("personality_id") REFERENCES "ai_personalities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

