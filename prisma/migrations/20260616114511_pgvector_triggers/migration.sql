-- Create triggers to automatically sync embedding_vector column when embedding is inserted or updated
-- This ensures pgvector queries always have updated vectors

-- Trigger for voice_profile_embeddings
CREATE OR REPLACE FUNCTION sync_voice_profile_embedding_vector()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.embedding IS NOT NULL THEN
    NEW.embedding_vector := NEW.embedding::vector;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS voice_profile_embedding_sync ON voice_profile_embeddings;
CREATE TRIGGER voice_profile_embedding_sync
BEFORE INSERT OR UPDATE ON voice_profile_embeddings
FOR EACH ROW
EXECUTE FUNCTION sync_voice_profile_embedding_vector();

-- Trigger for scripture_embeddings
CREATE OR REPLACE FUNCTION sync_scripture_embedding_vector()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.embedding IS NOT NULL THEN
    NEW.embedding_vector := NEW.embedding::vector;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS scripture_embedding_sync ON scripture_embeddings;
CREATE TRIGGER scripture_embedding_sync
BEFORE INSERT OR UPDATE ON scripture_embeddings
FOR EACH ROW
EXECUTE FUNCTION sync_scripture_embedding_vector();
