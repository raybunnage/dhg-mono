-- Setup tables for NLP presentation analysis

-- Enable pgvector extension if available
CREATE EXTENSION IF NOT EXISTS vector;

-- Store extracted entities
CREATE TABLE IF NOT EXISTS presentation_entities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    presentation_id UUID REFERENCES presentations(id) ON DELETE CASCADE,
    entity_type TEXT NOT NULL,
    entity_text TEXT NOT NULL,
    confidence_score FLOAT DEFAULT 1.0,
    extraction_method TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Index for fast lookups
    INDEX idx_presentation_entities_presentation_id (presentation_id),
    INDEX idx_presentation_entities_type (entity_type),
    INDEX idx_presentation_entities_text (entity_text)
);

-- Store extracted keywords
CREATE TABLE IF NOT EXISTS presentation_keywords (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    presentation_id UUID REFERENCES presentations(id) ON DELETE CASCADE,
    keyword TEXT NOT NULL,
    score FLOAT DEFAULT 1.0,
    extraction_method TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Index for fast lookups
    INDEX idx_presentation_keywords_presentation_id (presentation_id),
    INDEX idx_presentation_keywords_keyword (keyword),
    INDEX idx_presentation_keywords_score (score DESC)
);

-- Store presentation embeddings
CREATE TABLE IF NOT EXISTS presentation_embeddings (
    presentation_id UUID PRIMARY KEY REFERENCES presentations(id) ON DELETE CASCADE,
    embedding vector(384), -- Adjust dimension based on model
    model_name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Index for similarity search (requires pgvector)
    INDEX idx_presentation_embeddings_vector (embedding vector_cosine_ops)
);

-- Store topic clusters
CREATE TABLE IF NOT EXISTS topic_clusters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cluster_name TEXT NOT NULL,
    cluster_keywords TEXT[],
    presentation_ids UUID[],
    centroid_embedding vector(384),
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Store presentation topic assignments
CREATE TABLE IF NOT EXISTS presentation_topics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    presentation_id UUID REFERENCES presentations(id) ON DELETE CASCADE,
    cluster_id UUID REFERENCES topic_clusters(id) ON DELETE CASCADE,
    confidence_score FLOAT DEFAULT 1.0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(presentation_id, cluster_id)
);

-- Create function to find similar presentations using pgvector
CREATE OR REPLACE FUNCTION find_similar_presentations(
    target_presentation_id UUID,
    limit_count INTEGER DEFAULT 5
)
RETURNS TABLE (
    presentation_id UUID,
    title TEXT,
    summary TEXT,
    similarity_score FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    WITH target_embedding AS (
        SELECT embedding
        FROM presentation_embeddings
        WHERE presentation_id = target_presentation_id
    )
    SELECT 
        p.id,
        p.title,
        p.summary,
        1 - (pe.embedding <=> te.embedding) AS similarity_score
    FROM presentation_embeddings pe
    CROSS JOIN target_embedding te
    JOIN presentations p ON p.id = pe.presentation_id
    WHERE pe.presentation_id != target_presentation_id
    ORDER BY pe.embedding <=> te.embedding
    LIMIT limit_count;
END;
$$;

-- Create view for presentation analysis summary
CREATE OR REPLACE VIEW presentation_analysis_summary AS
SELECT 
    p.id,
    p.title,
    p.created_at,
    COUNT(DISTINCT pe.id) AS entity_count,
    COUNT(DISTINCT pk.id) AS keyword_count,
    EXISTS(SELECT 1 FROM presentation_embeddings WHERE presentation_id = p.id) AS has_embedding,
    COALESCE(p.metadata->>'nlp_processed', 'false')::boolean AS is_processed
FROM presentations p
LEFT JOIN presentation_entities pe ON pe.presentation_id = p.id
LEFT JOIN presentation_keywords pk ON pk.presentation_id = p.id
GROUP BY p.id, p.title, p.created_at, p.metadata;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_presentations_metadata_nlp ON presentations((metadata->>'nlp_processed'));
CREATE INDEX IF NOT EXISTS idx_presentation_entities_composite ON presentation_entities(presentation_id, entity_type);
CREATE INDEX IF NOT EXISTS idx_presentation_keywords_composite ON presentation_keywords(presentation_id, extraction_method);
