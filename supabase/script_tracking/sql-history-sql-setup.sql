-- Main Query History Table
CREATE TABLE sql_query_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    query_text TEXT NOT NULL,
    query_name TEXT,
    description TEXT,
    tags TEXT[], -- Array of string tags for quick access
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID REFERENCES auth.users(id),
    execution_count INTEGER DEFAULT 0,
    last_executed_at TIMESTAMPTZ,
    is_favorite BOOLEAN DEFAULT false,
    execution_status TEXT -- 'success', 'error', etc.
);

-- Tags Table
CREATE TABLE sql_query_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tag_name TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Junction Table for Many-to-Many Relationship
CREATE TABLE sql_query_tag_mappings (
    query_id UUID REFERENCES sql_query_history(id) ON DELETE CASCADE,
    tag_id UUID REFERENCES sql_query_tags(id) ON DELETE CASCADE,
    PRIMARY KEY (query_id, tag_id)
);

-- Indexes for sql_query_history
CREATE INDEX idx_query_history_created_by ON sql_query_history(created_by);
CREATE INDEX idx_query_history_created_at ON sql_query_history(created_at);
CREATE INDEX idx_query_history_is_favorite ON sql_query_history(is_favorite);
CREATE INDEX idx_query_history_last_executed ON sql_query_history(last_executed_at);
CREATE INDEX idx_query_history_tags ON sql_query_history USING GIN(tags); -- For array of tags

-- Full text search index for query text and name
CREATE INDEX idx_query_history_text_search ON sql_query_history 
    USING GIN(to_tsvector('english', query_text || ' ' || COALESCE(query_name, '')));

-- Index for tag junction table
CREATE INDEX idx_tag_mappings_query_id ON sql_query_tag_mappings(query_id);
CREATE INDEX idx_tag_mappings_tag_id ON sql_query_tag_mappings(tag_id);

-- Index for tag names
CREATE INDEX idx_tag_name ON sql_query_tags(tag_name);