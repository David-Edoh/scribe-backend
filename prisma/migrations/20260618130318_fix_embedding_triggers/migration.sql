-- Drop the problematic triggers that reference non-existent embedding_vector column
-- The triggers were created to sync embedding to embedding_vector (pgvector type)
-- but embedding_vector was never created, causing INSERT operations to fail

DROP TRIGGER IF EXISTS voice_profile_embedding_sync ON voice_profile_embeddings;
DROP TRIGGER IF EXISTS scripture_embedding_sync ON scripture_embeddings;

DROP FUNCTION IF EXISTS sync_voice_profile_embedding_vector();
DROP FUNCTION IF EXISTS sync_scripture_embedding_vector();

-- The embedding column (Float[] / DOUBLE PRECISION[]) is sufficient for vector operations
-- Vector search is handled in-application using cosine similarity calculation
