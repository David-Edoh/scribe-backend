-- Create scripture embeddings table for seeded Bible verses
CREATE TABLE IF NOT EXISTS scripture_embeddings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scripture_ref text,
  scripture_text text,
  embedding_vector vector(1536),
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scripture_embedding_vector ON scripture_embeddings USING ivfflat (embedding_vector vector_l2_ops) WITH (lists = 100);
