-- CreateTable
CREATE UNLOGGED TABLE "app_cache" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_cache_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "idx_cache_expiry" ON "app_cache"("expires_at");
