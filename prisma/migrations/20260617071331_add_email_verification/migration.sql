/*
  Warnings:

  - You are about to drop the column `embedding_vector` on the `scripture_embeddings` table. All the data in the column will be lost.
  - You are about to drop the column `embedding_vector` on the `voice_profile_embeddings` table. All the data in the column will be lost.
  - You are about to drop the column `source_text` on the `voice_profile_embeddings` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "scripture_embeddings" DROP COLUMN "embedding_vector";

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "emailVerificationSentAt" TIMESTAMP(3),
ADD COLUMN     "emailVerificationToken" TEXT,
ADD COLUMN     "emailVerified" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "voice_profile_embeddings" DROP COLUMN "embedding_vector",
DROP COLUMN "source_text";
