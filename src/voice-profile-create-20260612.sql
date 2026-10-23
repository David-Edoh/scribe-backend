-- Enable required extensions (run these in Supabase SQL editor)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS vector;

-- Voice profiles table
CREATE TABLE IF NOT EXISTS voice_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  biography text,
  signature_phrases jsonb,
  anchor_scriptures jsonb,
  style_attributes jsonb,
  personal_stories jsonb,
  sample_texts text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Embeddings table for voice profile vectors
CREATE TABLE IF NOT EXISTS voice_profile_embeddings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  voice_profile_id uuid NOT NULL,
  embedding vector(1536),
  metadata jsonb,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT fk_voice_profile FOREIGN KEY(voice_profile_id) REFERENCES voice_profiles(id) ON DELETE CASCADE
);

-- Index for vector search (ivfflat)
CREATE INDEX IF NOT EXISTS idx_voice_profile_embedding_vector ON voice_profile_embeddings USING ivfflat (embedding vector_l2_ops) WITH (lists = 100);

-- Trigger to set updated_at timestamp
CREATE OR REPLACE FUNCTION trigger_set_timestamp() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_timestamp ON voice_profiles;
CREATE TRIGGER set_timestamp
BEFORE UPDATE ON voice_profiles
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();
