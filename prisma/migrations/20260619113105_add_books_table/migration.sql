-- AlterTable
ALTER TABLE "voice_profile_embeddings" ADD COLUMN     "bookId" TEXT;

-- CreateTable
CREATE TABLE "books" (
    "id" TEXT NOT NULL,
    "voiceProfileId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'interview',
    "fileName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "books_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "books_voiceProfileId_idx" ON "books"("voiceProfileId");

-- CreateIndex
CREATE INDEX "books_userId_idx" ON "books"("userId");

-- CreateIndex
CREATE INDEX "voice_profile_embeddings_bookId_idx" ON "voice_profile_embeddings"("bookId");

-- AddForeignKey
ALTER TABLE "books" ADD CONSTRAINT "books_voiceProfileId_fkey" FOREIGN KEY ("voiceProfileId") REFERENCES "voice_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "books" ADD CONSTRAINT "books_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voice_profile_embeddings" ADD CONSTRAINT "voice_profile_embeddings_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "books"("id") ON DELETE CASCADE ON UPDATE CASCADE;
