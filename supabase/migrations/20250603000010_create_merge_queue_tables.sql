-- Create merge queue tracking tables for managing branch merges

-- Table to track branches and their merge readiness
CREATE TABLE IF NOT EXISTS dev_merge_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_name TEXT NOT NULL,
    worktree_path TEXT,
    source_branch TEXT DEFAULT 'development',
    merge_status TEXT CHECK (merge_status IN ('pending', 'ready', 'in_progress', 'merged', 'failed', 'conflicts')),
    priority INTEGER DEFAULT 0,
    task_ids UUID[], -- Reference to related dev_tasks
    conflicts_detected BOOLEAN DEFAULT false,
    conflict_details JSONB,
    tests_passed BOOLEAN,
    last_updated_from_source TIMESTAMPTZ,
    merge_started_at TIMESTAMPTZ,
    merge_completed_at TIMESTAMPTZ,
    merge_commit_sha TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES auth.users(id),
    notes TEXT
);

-- Table to track merge checklist items
CREATE TABLE IF NOT EXISTS dev_merge_checklist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merge_queue_id UUID REFERENCES dev_merge_queue(id) ON DELETE CASCADE,
    check_type TEXT NOT NULL CHECK (check_type IN (
        'update_from_source',
        'run_tests',
        'check_conflicts',
        'run_linter',
        'run_typecheck',
        'update_documentation',
        'review_changes',
        'integration_tests'
    )),
    status TEXT CHECK (status IN ('pending', 'passed', 'failed', 'skipped')),
    executed_at TIMESTAMPTZ,
    result JSONB,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Table to track merge dependencies
CREATE TABLE IF NOT EXISTS dev_merge_dependencies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merge_queue_id UUID REFERENCES dev_merge_queue(id) ON DELETE CASCADE,
    depends_on_branch TEXT NOT NULL,
    dependency_type TEXT CHECK (dependency_type IN ('must_merge_first', 'should_merge_first', 'test_together')),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX idx_merge_queue_status ON dev_merge_queue(merge_status);
CREATE INDEX idx_merge_queue_branch ON dev_merge_queue(branch_name);
CREATE INDEX idx_merge_queue_priority ON dev_merge_queue(priority DESC);
CREATE INDEX idx_merge_checklist_queue ON dev_merge_checklist(merge_queue_id);
CREATE INDEX idx_merge_dependencies_queue ON dev_merge_dependencies(merge_queue_id);

-- Create RLS policies
ALTER TABLE dev_merge_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE dev_merge_checklist ENABLE ROW LEVEL SECURITY;
ALTER TABLE dev_merge_dependencies ENABLE ROW LEVEL SECURITY;

-- Basic RLS policies (can be refined based on your auth needs)
CREATE POLICY "merge_queue_all_access" ON dev_merge_queue FOR ALL USING (true);
CREATE POLICY "merge_checklist_all_access" ON dev_merge_checklist FOR ALL USING (true);
CREATE POLICY "merge_dependencies_all_access" ON dev_merge_dependencies FOR ALL USING (true);

-- Function to update merge queue status based on checklist
CREATE OR REPLACE FUNCTION update_merge_queue_status()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if all required checks have passed
    IF NOT EXISTS (
        SELECT 1 FROM dev_merge_checklist
        WHERE merge_queue_id = NEW.merge_queue_id
        AND check_type IN ('update_from_source', 'run_tests', 'check_conflicts')
        AND status != 'passed'
    ) THEN
        UPDATE dev_merge_queue
        SET merge_status = 'ready',
            updated_at = CURRENT_TIMESTAMP
        WHERE id = NEW.merge_queue_id
        AND merge_status = 'pending';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update merge status
CREATE TRIGGER update_merge_status_on_checklist_change
AFTER INSERT OR UPDATE ON dev_merge_checklist
FOR EACH ROW
EXECUTE FUNCTION update_merge_queue_status();

-- Helper function to get next branch to merge
CREATE OR REPLACE FUNCTION get_next_merge_candidate()
RETURNS TABLE (
    id UUID,
    branch_name TEXT,
    priority INTEGER,
    pending_dependencies INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        mq.id,
        mq.branch_name,
        mq.priority,
        COUNT(md.id)::INTEGER as pending_dependencies
    FROM dev_merge_queue mq
    LEFT JOIN dev_merge_dependencies md ON md.merge_queue_id = mq.id
    LEFT JOIN dev_merge_queue dep_mq ON dep_mq.branch_name = md.depends_on_branch 
        AND dep_mq.merge_status != 'merged'
    WHERE mq.merge_status = 'ready'
    GROUP BY mq.id, mq.branch_name, mq.priority
    HAVING COUNT(CASE WHEN dep_mq.id IS NOT NULL THEN 1 END) = 0
    ORDER BY mq.priority DESC, mq.created_at ASC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Add tracking entry to sys_table_definitions
INSERT INTO sys_table_definitions (table_schema, table_name, description, purpose, created_date)
VALUES 
    ('public', 'dev_merge_queue', 'Tracks branch merge queue and readiness', 'Manages sequential merging of feature branches', CURRENT_DATE),
    ('public', 'dev_merge_checklist', 'Tracks merge preparation checklist items', 'Ensures all pre-merge checks are completed', CURRENT_DATE),
    ('public', 'dev_merge_dependencies', 'Tracks dependencies between branches for merging', 'Manages merge order based on branch dependencies', CURRENT_DATE)
ON CONFLICT (table_schema, table_name) DO NOTHING;