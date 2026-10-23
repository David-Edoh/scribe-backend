-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "voice_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "biography" TEXT,
    "signaturePhrases" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "anchorScriptures" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "theologicalFramework" TEXT,
    "sampleTexts" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "voice_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "voice_profile_embeddings" (
    "id" TEXT NOT NULL,
    "voiceProfileId" TEXT NOT NULL,
    "embedding" DOUBLE PRECISION[],
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "voice_profile_embeddings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scripture_embeddings" (
    "id" TEXT NOT NULL,
    "scriptureRef" TEXT NOT NULL,
    "scriptureText" TEXT NOT NULL,
    "embedding" DOUBLE PRECISION[],
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scripture_embeddings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "voice_profiles_userId_idx" ON "voice_profiles"("userId");

-- CreateIndex
CREATE INDEX "voice_profile_embeddings_voiceProfileId_idx" ON "voice_profile_embeddings"("voiceProfileId");

-- CreateIndex
CREATE INDEX "scripture_embeddings_scriptureRef_idx" ON "scripture_embeddings"("scriptureRef");

-- AddForeignKey
ALTER TABLE "voice_profiles" ADD CONSTRAINT "voice_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voice_profile_embeddings" ADD CONSTRAINT "voice_profile_embeddings_voiceProfileId_fkey" FOREIGN KEY ("voiceProfileId") REFERENCES "voice_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
