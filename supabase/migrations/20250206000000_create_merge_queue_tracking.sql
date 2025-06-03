-- Create merge queue tracking tables
-- Author: Claude
-- Date: 2025-02-06
-- Purpose: Track branch merge status and workflow for managing multiple feature branches

-- Create merge queue table to track branches ready for merging
CREATE TABLE IF NOT EXISTS dev_merge_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_name TEXT NOT NULL,
    worktree_path TEXT,
    task_id UUID REFERENCES dev_tasks(id),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'ready', 'in_progress', 'merged', 'failed', 'cancelled')),
    priority INTEGER DEFAULT 0,
    
    -- Pre-merge checks
    conflicts_detected BOOLEAN DEFAULT false,
    tests_passed BOOLEAN,
    lint_passed BOOLEAN,
    type_check_passed BOOLEAN,
    
    -- Merge details
    target_branch TEXT DEFAULT 'development',
    merge_commit_sha TEXT,
    merge_started_at TIMESTAMP WITH TIME ZONE,
    merge_completed_at TIMESTAMP WITH TIME ZONE,
    
    -- Integration testing
    integration_tests_passed BOOLEAN,
    integration_notes TEXT,
    
    -- Metadata
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(branch_name, target_branch)
);

-- Create merge conflicts table to track detected conflicts
CREATE TABLE IF NOT EXISTS dev_merge_conflicts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merge_queue_id UUID NOT NULL REFERENCES dev_merge_queue(id) ON DELETE CASCADE,
    file_path TEXT NOT NULL,
    conflict_type TEXT CHECK (conflict_type IN ('content', 'delete', 'rename', 'mode')),
    our_changes TEXT,
    their_changes TEXT,
    resolved BOOLEAN DEFAULT false,
    resolution_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    resolved_at TIMESTAMP WITH TIME ZONE
);

-- Create merge checklist table for tracking pre/post merge steps
CREATE TABLE IF NOT EXISTS dev_merge_checklist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merge_queue_id UUID NOT NULL REFERENCES dev_merge_queue(id) ON DELETE CASCADE,
    check_type TEXT NOT NULL CHECK (check_type IN ('pre_merge', 'post_merge')),
    check_name TEXT NOT NULL,
    check_description TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'passed', 'failed', 'skipped')),
    completed_at TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    
    UNIQUE(merge_queue_id, check_type, check_name)
);

-- Create indexes for performance
CREATE INDEX idx_merge_queue_status ON dev_merge_queue(status);
CREATE INDEX idx_merge_queue_branch ON dev_merge_queue(branch_name);
CREATE INDEX idx_merge_queue_task ON dev_merge_queue(task_id);
CREATE INDEX idx_merge_conflicts_queue ON dev_merge_conflicts(merge_queue_id);
CREATE INDEX idx_merge_checklist_queue ON dev_merge_checklist(merge_queue_id);

-- Create function to update merge queue status
CREATE OR REPLACE FUNCTION update_merge_queue_status()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    
    -- Auto-detect readiness based on checks
    IF NEW.status = 'pending' AND 
       NEW.conflicts_detected = false AND
       NEW.tests_passed = true AND
       NEW.lint_passed = true AND
       NEW.type_check_passed = true THEN
        NEW.status = 'ready';
    END IF;
    
    -- Track merge timing
    IF OLD.status != 'in_progress' AND NEW.status = 'in_progress' THEN
        NEW.merge_started_at = NOW();
    END IF;
    
    IF OLD.status = 'in_progress' AND NEW.status = 'merged' THEN
        NEW.merge_completed_at = NOW();
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for status updates
CREATE TRIGGER merge_queue_status_update
    BEFORE UPDATE ON dev_merge_queue
    FOR EACH ROW
    EXECUTE FUNCTION update_merge_queue_status();

-- Create view for merge queue dashboard
CREATE OR REPLACE VIEW dev_merge_queue_dashboard AS
SELECT 
    mq.*,
    dt.title as task_title,
    dt.description as task_description,
    dt.status as task_status,
    COUNT(DISTINCT mc.id) FILTER (WHERE mc.resolved = false) as unresolved_conflicts,
    COUNT(DISTINCT mcl.id) FILTER (WHERE mcl.check_type = 'pre_merge' AND mcl.status = 'passed') as pre_checks_passed,
    COUNT(DISTINCT mcl.id) FILTER (WHERE mcl.check_type = 'pre_merge' AND mcl.status IN ('pending', 'failed')) as pre_checks_pending,
    COUNT(DISTINCT mcl.id) FILTER (WHERE mcl.check_type = 'post_merge' AND mcl.status = 'passed') as post_checks_passed,
    COUNT(DISTINCT mcl.id) FILTER (WHERE mcl.check_type = 'post_merge' AND mcl.status IN ('pending', 'failed')) as post_checks_pending
FROM dev_merge_queue mq
LEFT JOIN dev_tasks dt ON mq.task_id = dt.id
LEFT JOIN dev_merge_conflicts mc ON mc.merge_queue_id = mq.id
LEFT JOIN dev_merge_checklist mcl ON mcl.merge_queue_id = mq.id
GROUP BY mq.id, dt.id;

-- Add RLS policies
ALTER TABLE dev_merge_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE dev_merge_conflicts ENABLE ROW LEVEL SECURITY;
ALTER TABLE dev_merge_checklist ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view all merge queue items
CREATE POLICY "Merge queue items are viewable by authenticated users" 
    ON dev_merge_queue FOR SELECT 
    TO authenticated 
    USING (true);

-- Allow users to manage their own merge queue items
CREATE POLICY "Users can manage their own merge queue items" 
    ON dev_merge_queue FOR ALL 
    TO authenticated 
    USING (created_by = auth.uid() OR auth.uid() IN (
        SELECT auth_user_id FROM auth_user_profiles WHERE is_admin = true
    ));

-- Similar policies for related tables
CREATE POLICY "Merge conflicts are viewable by authenticated users" 
    ON dev_merge_conflicts FOR SELECT 
    TO authenticated 
    USING (true);

CREATE POLICY "Users can manage conflicts for their merge items" 
    ON dev_merge_conflicts FOR ALL 
    TO authenticated 
    USING (merge_queue_id IN (
        SELECT id FROM dev_merge_queue WHERE created_by = auth.uid()
    ) OR auth.uid() IN (
        SELECT auth_user_id FROM auth_user_profiles WHERE is_admin = true
    ));

CREATE POLICY "Merge checklist items are viewable by authenticated users" 
    ON dev_merge_checklist FOR SELECT 
    TO authenticated 
    USING (true);

CREATE POLICY "Users can manage checklist for their merge items" 
    ON dev_merge_checklist FOR ALL 
    TO authenticated 
    USING (merge_queue_id IN (
        SELECT id FROM dev_merge_queue WHERE created_by = auth.uid()
    ) OR auth.uid() IN (
        SELECT auth_user_id FROM auth_user_profiles WHERE is_admin = true
    ));

-- Insert into sys_table_definitions
INSERT INTO sys_table_definitions (table_schema, table_name, description, purpose, created_date)
VALUES 
    ('public', 'dev_merge_queue', 'Tracks branches in the merge queue with their status and checks', 'Manage sequential feature branch merging workflow', CURRENT_DATE),
    ('public', 'dev_merge_conflicts', 'Stores detected merge conflicts for each merge queue item', 'Track and resolve conflicts before merging', CURRENT_DATE),
    ('public', 'dev_merge_checklist', 'Pre and post merge checklist items for each merge', 'Ensure proper merge workflow steps are followed', CURRENT_DATE)
ON CONFLICT (table_schema, table_name) DO NOTHING;

-- Add helpful comments
COMMENT ON TABLE dev_merge_queue IS 'Tracks feature branches queued for merging with status and validation checks';
COMMENT ON TABLE dev_merge_conflicts IS 'Stores merge conflicts detected during pre-merge analysis';
COMMENT ON TABLE dev_merge_checklist IS 'Checklist items for pre-merge and post-merge validation steps';
COMMENT ON VIEW dev_merge_queue_dashboard IS 'Dashboard view showing merge queue status with aggregated check counts';