-- Enable pgvector extension for vector similarity search
CREATE EXTENSION IF NOT EXISTS vector;

-- Add support for vector operations
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Convert voice_profile_embeddings.embedding from float8[] to vector
-- Requires consistent dimensions - pgvector requires all vectors in a column to have same dimensions
ALTER TABLE "voice_profile_embeddings"
ALTER COLUMN "embedding" TYPE vector USING 
  CASE 
    WHEN "embedding" IS NULL THEN NULL::vector
    WHEN array_length("embedding", 1) = 0 THEN NULL::vector
    ELSE "embedding"::vector 
  END;

-- Convert scripture_embeddings.embedding from float8[] to vector
ALTER TABLE "scripture_embeddings"
ALTER COLUMN "embedding" TYPE vector USING 
  CASE 
    WHEN "embedding" IS NULL THEN NULL::vector
    WHEN array_length("embedding", 1) = 0 THEN NULL::vector
    ELSE "embedding"::vector 
  END;



