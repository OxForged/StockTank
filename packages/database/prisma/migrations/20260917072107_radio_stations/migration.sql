-- CreateTable
CREATE TABLE "radio_stations" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "azuracast_shortcode" TEXT NOT NULL,
    "status" "PublishStatus" NOT NULL DEFAULT 'draft',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_demo" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "radio_stations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "radio_stations_slug_key" ON "radio_stations"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "radio_stations_azuracast_shortcode_key" ON "radio_stations"("azuracast_shortcode");

-- CreateIndex
CREATE INDEX "radio_stations_status_sort_order_idx" ON "radio_stations"("status", "sort_order");

