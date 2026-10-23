-- Enable pgvector extension (idempotent)
CREATE EXTENSION IF NOT EXISTS vector;

-- Add native vector columns for pgvector (flexible dimensions)
ALTER TABLE voice_profile_embeddings 
  ADD COLUMN IF NOT EXISTS embedding_vector vector;

ALTER TABLE scripture_embeddings 
  ADD COLUMN IF NOT EXISTS embedding_vector vector;

-- Migrate existing embeddings from DOUBLE PRECISION[] to vector type
UPDATE voice_profile_embeddings 
SET embedding_vector = embedding::vector
WHERE embedding_vector IS NULL AND embedding IS NOT NULL;

UPDATE scripture_embeddings 
SET embedding_vector = embedding::vector
WHERE embedding_vector IS NULL AND embedding IS NOT NULL;

-- Note: Indexes will be created after data migration to ensure dimension consistency
-- Use: CREATE INDEX idx_voice_profile_embedding_ivfflat ON voice_profile_embeddings USING ivfflat (embedding_vector vector_cosine_ops) WITH (lists = 100);





