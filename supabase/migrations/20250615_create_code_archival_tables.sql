-- Create code archival tracking tables
-- Purpose: Track code archival operations for continuous improvement cleanup

-- Table for archival operations (each archival run)
CREATE TABLE IF NOT EXISTS sys_code_archival_operations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    operation_date DATE NOT NULL DEFAULT CURRENT_DATE,
    phase VARCHAR(10) NOT NULL CHECK (phase IN ('A', 'B', 'C')),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewing', 'executed', 'completed', 'cancelled')),
    archive_path TEXT NOT NULL,
    reason TEXT NOT NULL,
    manifest_path TEXT,
    total_items INTEGER DEFAULT 0,
    total_size_bytes BIGINT DEFAULT 0,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    executed_by TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table for individual archived items
CREATE TABLE IF NOT EXISTS sys_code_archival_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    operation_id UUID NOT NULL REFERENCES sys_code_archival_operations(id) ON DELETE CASCADE,
    original_path TEXT NOT NULL,
    archived_path TEXT NOT NULL,
    item_type VARCHAR(20) NOT NULL CHECK (item_type IN ('service', 'script', 'pipeline', 'package', 'document', 'test', 'other')),
    reason TEXT NOT NULL,
    confidence VARCHAR(10) NOT NULL CHECK (confidence IN ('high', 'medium', 'low')),
    size_bytes BIGINT NOT NULL,
    last_modified TIMESTAMPTZ NOT NULL,
    duplicate_of TEXT,
    usage_count INTEGER DEFAULT 0,
    import_count INTEGER DEFAULT 0,
    days_since_modified INTEGER,
    restoration_status VARCHAR(20) DEFAULT 'archived' CHECK (restoration_status IN ('archived', 'restored', 'permanently_deleted')),
    restored_at TIMESTAMPTZ,
    restored_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX idx_archival_operations_status ON sys_code_archival_operations(status);
CREATE INDEX idx_archival_operations_date ON sys_code_archival_operations(operation_date);
CREATE INDEX idx_archival_items_operation ON sys_code_archival_items(operation_id);
CREATE INDEX idx_archival_items_type ON sys_code_archival_items(item_type);
CREATE INDEX idx_archival_items_confidence ON sys_code_archival_items(confidence);
CREATE INDEX idx_archival_items_original_path ON sys_code_archival_items(original_path);

-- Create view for archival statistics
CREATE OR REPLACE VIEW sys_code_archival_stats_view AS
SELECT 
    o.id,
    o.operation_date,
    o.phase,
    o.status,
    o.reason,
    o.total_items,
    o.total_size_bytes,
    ROUND(o.total_size_bytes::numeric / 1048576, 2) as total_size_mb,
    o.started_at,
    o.completed_at,
    EXTRACT(EPOCH FROM (o.completed_at - o.started_at))::INTEGER as duration_seconds,
    COUNT(DISTINCT i.item_type) as unique_item_types,
    COUNT(CASE WHEN i.confidence = 'high' THEN 1 END) as high_confidence_items,
    COUNT(CASE WHEN i.confidence = 'medium' THEN 1 END) as medium_confidence_items,
    COUNT(CASE WHEN i.confidence = 'low' THEN 1 END) as low_confidence_items,
    COUNT(CASE WHEN i.duplicate_of IS NOT NULL THEN 1 END) as duplicate_items,
    COUNT(CASE WHEN i.restoration_status = 'restored' THEN 1 END) as restored_items
FROM sys_code_archival_operations o
LEFT JOIN sys_code_archival_items i ON i.operation_id = o.id
GROUP BY o.id;

-- Create view for recent archival activity
CREATE OR REPLACE VIEW sys_recent_archival_activity_view AS
SELECT 
    i.original_path,
    i.item_type,
    i.reason,
    i.confidence,
    i.size_bytes,
    ROUND(i.size_bytes::numeric / 1024, 2) as size_kb,
    i.days_since_modified,
    i.duplicate_of,
    o.operation_date,
    o.phase,
    o.archive_path
FROM sys_code_archival_items i
JOIN sys_code_archival_operations o ON o.id = i.operation_id
WHERE o.operation_date >= CURRENT_DATE - INTERVAL '30 days'
ORDER BY o.operation_date DESC, i.confidence DESC, i.size_bytes DESC;

-- Add RLS policies (public read for monitoring)
ALTER TABLE sys_code_archival_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE sys_code_archival_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all users" ON sys_code_archival_operations
    FOR SELECT USING (true);

CREATE POLICY "Enable read access for all users" ON sys_code_archival_items
    FOR SELECT USING (true);

-- Add helpful comments
COMMENT ON TABLE sys_code_archival_operations IS 'Tracks code archival operations for continuous improvement cleanup';
COMMENT ON TABLE sys_code_archival_items IS 'Individual items archived in each operation';
COMMENT ON VIEW sys_code_archival_stats_view IS 'Statistics for archival operations';
COMMENT ON VIEW sys_recent_archival_activity_view IS 'Recent archival activity for monitoring';

-- Add to sys_table_definitions
INSERT INTO sys_table_definitions (table_schema, table_name, description, purpose, created_date)
VALUES 
    ('public', 'sys_code_archival_operations', 'Tracks code archival operations', 'Monitor and manage code archival for continuous improvement', CURRENT_DATE),
    ('public', 'sys_code_archival_items', 'Individual archived code items', 'Track specific files/folders archived in each operation', CURRENT_DATE)
ON CONFLICT (table_schema, table_name) DO NOTHING;