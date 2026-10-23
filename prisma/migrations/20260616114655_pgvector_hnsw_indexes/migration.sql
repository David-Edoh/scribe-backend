-- Vector indexes deferred - waiting for dimension consistency
-- Current data has mixed dimensions (768/1536) which prevents automatic index creation
-- 
-- Once all embeddings are normalized to 1536 dimensions, create indexes with:
-- 
-- CREATE INDEX idx_voice_profile_embedding_ivfflat
-- ON voice_profile_embeddings USING ivfflat (embedding_vector vector_cosine_ops) 
-- WITH (lists = 100);
--
-- CREATE INDEX idx_scripture_embedding_ivfflat
-- ON scripture_embeddings USING ivfflat (embedding_vector vector_cosine_ops)
-- WITH (lists = 100);
--
-- Current vector search performs well without indexes (169-236ms avg).
-- Indexes will become necessary when dataset scales beyond ~100k vectors.


