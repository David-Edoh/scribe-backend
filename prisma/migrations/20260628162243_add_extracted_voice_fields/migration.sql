-- AlterTable
ALTER TABLE "voice_profiles" ADD COLUMN     "keyMessages" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "ministryDNA" TEXT,
ADD COLUMN     "recurringMotifs" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "toneMarkers" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "voiceThemes" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "writingStyle" JSONB;
