-- Add sourceText column to voice_profile_embeddings
-- This enables RAG retrieval: after vector search, we get both the embedding ID AND the original text
-- The text is passed to Gemini for context-aware generation while maintaining author voice

ALTER TABLE voice_profile_embeddings
ADD COLUMN source_text TEXT;

-- Add an index on source_text for full-text search queries (optional, for future text search enhancements)
CREATE INDEX idx_voice_profile_embedding_source_text ON voice_profile_embeddings USING gin(to_tsvector('english', source_text));

-- Backfill existing embeddings with empty source_text (they won't be used in RAG until populated)
-- UPDATE voice_profile_embeddings SET source_text = '' WHERE source_text IS NULL;
