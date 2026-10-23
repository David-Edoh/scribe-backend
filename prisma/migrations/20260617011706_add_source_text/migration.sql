-- Add sourceText column to voice_profile_embeddings
-- Using camelCase to match existing column naming convention
ALTER TABLE voice_profile_embeddings
ADD COLUMN "sourceText" TEXT;

