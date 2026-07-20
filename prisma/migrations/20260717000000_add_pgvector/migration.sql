-- Create pgvector extension if it doesn't exist
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding column to rag_embeddings
ALTER TABLE "rag_embeddings"
ADD COLUMN IF NOT EXISTS "embedding" vector(1536);

-- Approximate nearest-neighbour index for cosine-distance retrieval.
CREATE INDEX IF NOT EXISTS "rag_embeddings_embedding_hnsw_idx"
ON "rag_embeddings"
USING hnsw ("embedding" vector_cosine_ops)
WHERE "embedding" IS NOT NULL;
