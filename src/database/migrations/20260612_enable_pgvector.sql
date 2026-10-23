-- Enable pgvector extension and add embedding vector column
CREATE EXTENSION IF NOT EXISTS vector;

-- If using Prisma's embedding as Float[] keep that; additionally add a native vector column
ALTER TABLE IF EXISTS voice_profile_embeddings ADD COLUMN IF NOT EXISTS embedding_vector vector(1536);

-- Create ivfflat index for fast nearest-neighbor searches
CREATE INDEX IF NOT EXISTS idx_voice_profile_embedding_vector ON voice_profile_embeddings USING ivfflat (embedding_vector vector_l2_ops) WITH (lists = 100);

-- Note: populate embedding_vector from existing embedding arrays as needed, e.g.:
-- UPDATE voice_profile_embeddings SET embedding_vector = embedding::vector;
-- Depending on your Postgres setup, you may need to transform arrays into vector format.
