-- Migration: Create Documentation Monitoring Tables
-- Description: Tables for continuous documentation monitoring and intelligent archiving system
-- Created: 2025-06-08

-- Table: doc_continuous_monitoring
-- Purpose: Track living documents that are continuously monitored and updated
CREATE TABLE IF NOT EXISTS doc_continuous_monitoring (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_path TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    area TEXT NOT NULL, -- e.g., 'cli-pipeline', 'shared-services', 'deployment'
    description TEXT,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    next_review_date DATE NOT NULL,
    review_frequency_days INTEGER DEFAULT 30,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'needs-review', 'updating', 'deprecated')),
    priority TEXT DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
    owner TEXT, -- responsible party
    metadata JSONB DEFAULT '{}', -- flexible storage for additional data
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX idx_doc_monitoring_area ON doc_continuous_monitoring(area);
CREATE INDEX idx_doc_monitoring_status ON doc_continuous_monitoring(status);
CREATE INDEX idx_doc_monitoring_next_review ON doc_continuous_monitoring(next_review_date);
CREATE INDEX idx_doc_monitoring_priority ON doc_continuous_monitoring(priority);

-- Table: doc_archives
-- Purpose: Store archived documentation with relationships to living documents
CREATE TABLE IF NOT EXISTS doc_archives (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    original_path TEXT NOT NULL,
    archive_path TEXT NOT NULL,
    title TEXT,
    description TEXT,
    content_hash TEXT, -- for deduplication
    file_size INTEGER,
    archive_reason TEXT,
    related_living_docs UUID[], -- Array of doc_continuous_monitoring IDs
    tags TEXT[],
    searchable_content TEXT, -- Extracted text for full-text search
    metadata JSONB DEFAULT '{}',
    archived_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for archives
CREATE INDEX idx_doc_archives_tags ON doc_archives USING GIN(tags);
CREATE INDEX idx_doc_archives_living_docs ON doc_archives USING GIN(related_living_docs);
CREATE INDEX idx_doc_archives_content ON doc_archives USING GIN(to_tsvector('english', searchable_content));
CREATE INDEX idx_doc_archives_original_path ON doc_archives(original_path);

-- Table: doc_monitoring_history
-- Purpose: Track all changes and reviews to living documents
CREATE TABLE IF NOT EXISTS doc_monitoring_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    doc_id UUID REFERENCES doc_continuous_monitoring(id) ON DELETE CASCADE,
    action TEXT NOT NULL CHECK (action IN ('created', 'updated', 'reviewed', 'archived', 'status_changed')),
    changes JSONB, -- What changed
    performed_by TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for history queries
CREATE INDEX idx_doc_monitoring_history_doc_id ON doc_monitoring_history(doc_id);
CREATE INDEX idx_doc_monitoring_history_action ON doc_monitoring_history(action);
CREATE INDEX idx_doc_monitoring_history_created_at ON doc_monitoring_history(created_at DESC);

-- RLS Policies
ALTER TABLE doc_continuous_monitoring ENABLE ROW LEVEL SECURITY;
ALTER TABLE doc_archives ENABLE ROW LEVEL SECURITY;
ALTER TABLE doc_monitoring_history ENABLE ROW LEVEL SECURITY;

-- Everyone can read documentation monitoring data
CREATE POLICY "Enable read access for all users" ON doc_continuous_monitoring
    FOR SELECT USING (true);

CREATE POLICY "Enable read access for all users" ON doc_archives
    FOR SELECT USING (true);

CREATE POLICY "Enable read access for all users" ON doc_monitoring_history
    FOR SELECT USING (true);

-- Only authenticated users can modify
CREATE POLICY "Enable insert for authenticated users" ON doc_continuous_monitoring
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable update for authenticated users" ON doc_continuous_monitoring
    FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Enable insert for authenticated users" ON doc_archives
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Enable insert for authenticated users" ON doc_monitoring_history
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Function to automatically update next_review_date
CREATE OR REPLACE FUNCTION update_next_review_date()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'active' AND (TG_OP = 'INSERT' OR OLD.last_updated IS DISTINCT FROM NEW.last_updated) THEN
        NEW.next_review_date := (NEW.last_updated::date + NEW.review_frequency_days);
    END IF;
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update next review date
CREATE TRIGGER update_doc_monitoring_review_date
    BEFORE INSERT OR UPDATE ON doc_continuous_monitoring
    FOR EACH ROW
    EXECUTE FUNCTION update_next_review_date();

-- Function to record history
CREATE OR REPLACE FUNCTION record_doc_monitoring_history()
RETURNS TRIGGER AS $$
DECLARE
    v_action TEXT;
    v_changes JSONB := '{}';
BEGIN
    -- Determine action
    IF TG_OP = 'INSERT' THEN
        v_action := 'created';
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.status IS DISTINCT FROM NEW.status THEN
            v_action := 'status_changed';
        ELSIF OLD.last_updated IS DISTINCT FROM NEW.last_updated THEN
            v_action := 'updated';
        ELSE
            v_action := 'reviewed';
        END IF;
        
        -- Record what changed
        SELECT jsonb_object_agg(key, value) INTO v_changes
        FROM (
            SELECT key, to_jsonb(NEW) -> key as value
            FROM jsonb_object_keys(to_jsonb(OLD)) key
            WHERE (to_jsonb(OLD) -> key) IS DISTINCT FROM (to_jsonb(NEW) -> key)
        ) changes;
    END IF;
    
    -- Insert history record
    INSERT INTO doc_monitoring_history (doc_id, action, changes, performed_by)
    VALUES (NEW.id, v_action, v_changes, current_setting('app.current_user', true));
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to record history
CREATE TRIGGER record_doc_monitoring_changes
    AFTER INSERT OR UPDATE ON doc_continuous_monitoring
    FOR EACH ROW
    EXECUTE FUNCTION record_doc_monitoring_history();

-- Helper function to find documents needing review
CREATE OR REPLACE FUNCTION get_docs_needing_review()
RETURNS TABLE (
    id UUID,
    file_path TEXT,
    title TEXT,
    area TEXT,
    last_updated TIMESTAMP WITH TIME ZONE,
    next_review_date DATE,
    days_overdue INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        dcm.id,
        dcm.file_path,
        dcm.title,
        dcm.area,
        dcm.last_updated,
        dcm.next_review_date,
        (CURRENT_DATE - dcm.next_review_date)::INTEGER as days_overdue
    FROM doc_continuous_monitoring dcm
    WHERE dcm.status = 'active'
    AND dcm.next_review_date <= CURRENT_DATE
    ORDER BY dcm.priority DESC, days_overdue DESC;
END;
$$ LANGUAGE plpgsql;

-- Helper function to search archives
CREATE OR REPLACE FUNCTION search_doc_archives(search_query TEXT)
RETURNS TABLE (
    id UUID,
    original_path TEXT,
    title TEXT,
    description TEXT,
    tags TEXT[],
    related_living_docs UUID[],
    rank REAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        da.id,
        da.original_path,
        da.title,
        da.description,
        da.tags,
        da.related_living_docs,
        ts_rank(to_tsvector('english', da.searchable_content), plainto_tsquery('english', search_query)) as rank
    FROM doc_archives da
    WHERE to_tsvector('english', da.searchable_content) @@ plainto_tsquery('english', search_query)
    OR da.title ILIKE '%' || search_query || '%'
    OR da.original_path ILIKE '%' || search_query || '%'
    ORDER BY rank DESC, da.archived_at DESC
    LIMIT 50;
END;
$$ LANGUAGE plpgsql;

-- Add entries to sys_table_definitions
INSERT INTO sys_table_definitions (table_schema, table_name, description, purpose, created_date)
VALUES 
    ('public', 'doc_continuous_monitoring', 'Tracks living documentation files for continuous monitoring', 'Manage core documentation that needs regular updates and review', CURRENT_DATE),
    ('public', 'doc_archives', 'Stores archived documentation with relationships to living docs', 'Preserve historical documentation while reducing active clutter', CURRENT_DATE),
    ('public', 'doc_monitoring_history', 'Audit trail for documentation monitoring changes', 'Track all updates and reviews to living documents', CURRENT_DATE)
ON CONFLICT (table_schema, table_name) DO NOTHING;

-- Add initial living documents (examples)
INSERT INTO doc_continuous_monitoring (file_path, title, area, description, review_frequency_days, priority)
VALUES 
    ('docs/continuously-updated/cli-pipelines-documentation.md', 'CLI Pipeline Architecture', 'cli-pipeline', 'Central documentation for all CLI pipelines and commands', 14, 'high'),
    ('docs/continuously-updated/apps-documentation.md', 'Applications Overview', 'apps', 'Overview of all applications in the monorepo', 30, 'high')
ON CONFLICT (file_path) DO NOTHING;