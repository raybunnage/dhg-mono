-- Add refactoring tracking fields to sys_cli_pipelines
ALTER TABLE sys_cli_pipelines 
ADD COLUMN IF NOT EXISTS refactoring_group TEXT CHECK (refactoring_group IN ('ALPHA', 'BETA', 'GAMMA', NULL)),
ADD COLUMN IF NOT EXISTS refactoring_status TEXT CHECK (refactoring_status IN ('pending', 'in_progress', 'completed', NULL)) DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS refactoring_checkpoint TEXT CHECK (refactoring_checkpoint IN ('baseline', 'migrated', 'validated', 'finalized', NULL)),
ADD COLUMN IF NOT EXISTS test_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS tests_passing INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS refactoring_completed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS refactoring_notes TEXT;

-- Create index for refactoring queries
CREATE INDEX IF NOT EXISTS idx_sys_cli_pipelines_refactoring_group ON sys_cli_pipelines(refactoring_group) WHERE refactoring_group IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sys_cli_pipelines_refactoring_status ON sys_cli_pipelines(refactoring_status) WHERE refactoring_status IS NOT NULL;

-- Add comments
COMMENT ON COLUMN sys_cli_pipelines.refactoring_group IS 'Refactoring group assignment: ALPHA (system), BETA (content), or GAMMA (utility)';
COMMENT ON COLUMN sys_cli_pipelines.refactoring_status IS 'Current refactoring status: pending, in_progress, or completed';
COMMENT ON COLUMN sys_cli_pipelines.refactoring_checkpoint IS 'Current checkpoint in refactoring process: baseline, migrated, validated, or finalized';
COMMENT ON COLUMN sys_cli_pipelines.test_count IS 'Total number of tests for this pipeline';
COMMENT ON COLUMN sys_cli_pipelines.tests_passing IS 'Number of tests currently passing';
COMMENT ON COLUMN sys_cli_pipelines.refactoring_completed_at IS 'Timestamp when refactoring was completed';
COMMENT ON COLUMN sys_cli_pipelines.refactoring_notes IS 'Notes about the refactoring process, issues encountered, etc.';