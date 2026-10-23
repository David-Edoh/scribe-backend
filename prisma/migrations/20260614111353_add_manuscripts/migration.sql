-- CreateTable
CREATE TABLE "manuscripts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "voiceProfileId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "outline" JSONB,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "manuscripts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chapters" (
    "id" TEXT NOT NULL,
    "manuscriptId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "outlineSection" TEXT,
    "order" INTEGER NOT NULL,
    "content" TEXT,
    "generatedFrom" TEXT,
    "voiceStyle" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chapters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "manuscript_versions" (
    "id" TEXT NOT NULL,
    "manuscriptId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "fullContent" JSONB NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "manuscript_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chapter_versions" (
    "id" TEXT NOT NULL,
    "chapterId" TEXT NOT NULL,
    "versionNum" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chapter_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "manuscripts_userId_idx" ON "manuscripts"("userId");

-- CreateIndex
CREATE INDEX "manuscripts_voiceProfileId_idx" ON "manuscripts"("voiceProfileId");

-- CreateIndex
CREATE INDEX "chapters_manuscriptId_idx" ON "chapters"("manuscriptId");

-- CreateIndex
CREATE UNIQUE INDEX "chapters_manuscriptId_order_key" ON "chapters"("manuscriptId", "order");

-- CreateIndex
CREATE INDEX "manuscript_versions_manuscriptId_idx" ON "manuscript_versions"("manuscriptId");

-- CreateIndex
CREATE INDEX "manuscript_versions_userId_idx" ON "manuscript_versions"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "manuscript_versions_manuscriptId_versionNumber_key" ON "manuscript_versions"("manuscriptId", "versionNumber");

-- CreateIndex
CREATE INDEX "chapter_versions_chapterId_idx" ON "chapter_versions"("chapterId");

-- CreateIndex
CREATE UNIQUE INDEX "chapter_versions_chapterId_versionNum_key" ON "chapter_versions"("chapterId", "versionNum");

-- AddForeignKey
ALTER TABLE "manuscripts" ADD CONSTRAINT "manuscripts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manuscripts" ADD CONSTRAINT "manuscripts_voiceProfileId_fkey" FOREIGN KEY ("voiceProfileId") REFERENCES "voice_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chapters" ADD CONSTRAINT "chapters_manuscriptId_fkey" FOREIGN KEY ("manuscriptId") REFERENCES "manuscripts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manuscript_versions" ADD CONSTRAINT "manuscript_versions_manuscriptId_fkey" FOREIGN KEY ("manuscriptId") REFERENCES "manuscripts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manuscript_versions" ADD CONSTRAINT "manuscript_versions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chapter_versions" ADD CONSTRAINT "chapter_versions_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "chapters"("id") ON DELETE CASCADE ON UPDATE CASCADE;
