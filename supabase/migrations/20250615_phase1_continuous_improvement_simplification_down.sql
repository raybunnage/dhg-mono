-- Down migration for Phase 1 Continuous Improvement Simplification

-- Drop the new simplified tables
DROP VIEW IF EXISTS continuous_summary_view CASCADE;
DROP TABLE IF EXISTS continuous_issues CASCADE;
DROP TABLE IF EXISTS continuous_test_runs CASCADE;
DROP TABLE IF EXISTS continuous_inventory CASCADE;

-- Drop the trigger function
DROP FUNCTION IF EXISTS update_continuous_inventory_updated_at() CASCADE;

-- Restore any archived tables (if needed)
-- Note: This would need to be done manually as we can't automatically determine
-- which tables were archived and what their original names were
-- Example:
-- ALTER TABLE sys_continuous_improvement_scenarios_archived RENAME TO sys_continuous_improvement_scenarios;
-- ALTER TABLE sys_continuous_improvement_executions_archived RENAME TO sys_continuous_improvement_executions;
-- ALTER TABLE sys_continuous_improvement_steps_archived RENAME TO sys_continuous_improvement_steps;