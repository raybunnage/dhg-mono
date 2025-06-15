#!/usr/bin/env ts-node
/**
 * Setup Phase 1 Continuous Improvement tables
 * Creates the tables if they don't exist
 */

import { SupabaseClientService } from '../../../packages/shared/services/supabase-client.js';

async function setupTables() {
  console.log('🚀 Setting up Phase 1 Continuous Improvement tables...\n');
  
  const supabase = SupabaseClientService.getInstance().getClient();
  
  // Check if tables already exist by trying to query them
  console.log('Checking existing tables...');
  
  // Test if continuous_inventory exists
  const { error: inventoryError } = await supabase
    .from('continuous_inventory')
    .select('id')
    .limit(1);
  
  if (inventoryError?.code === 'PGRST204' || inventoryError?.message?.includes('relation') || inventoryError?.code === '42P01') {
    console.log('❌ continuous_inventory table does not exist');
    console.log('\nPlease create the tables by running this SQL in Supabase dashboard:');
    console.log('https://supabase.com/dashboard/project/jdksnfkupzywjdfefkyj/sql\n');
    
    console.log(`-- Create the 3 simple tables for Phase 1

-- 1. What exists in the codebase
CREATE TABLE IF NOT EXISTS continuous_inventory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_type TEXT NOT NULL CHECK (item_type IN ('service', 'pipeline', 'table', 'test', 'app', 'proxy')),
    item_name TEXT NOT NULL,
    item_path TEXT,
    last_seen TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(item_type, item_name)
);

-- 2. Test execution results
CREATE TABLE IF NOT EXISTS continuous_test_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_date DATE DEFAULT CURRENT_DATE,
    run_time TIMESTAMPTZ DEFAULT NOW(),
    test_type TEXT CHECK (test_type IN ('unit', 'integration', 'e2e', 'all')),
    target TEXT,
    passed INTEGER DEFAULT 0,
    failed INTEGER DEFAULT 0,
    skipped INTEGER DEFAULT 0,
    duration_ms INTEGER,
    results JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. What needs attention
CREATE TABLE IF NOT EXISTS continuous_issues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    issue_type TEXT NOT NULL CHECK (issue_type IN ('standard_violation', 'test_failure', 'missing_test', 'deprecated_usage', 'security', 'performance')),
    severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    item_type TEXT,
    item_name TEXT,
    description TEXT NOT NULL,
    details JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    resolution_notes TEXT
);

-- Create indexes
CREATE INDEX idx_inventory_type ON continuous_inventory(item_type);
CREATE INDEX idx_inventory_last_seen ON continuous_inventory(last_seen);
CREATE INDEX idx_test_runs_date ON continuous_test_runs(run_date);
CREATE INDEX idx_test_runs_type ON continuous_test_runs(test_type);
CREATE INDEX idx_issues_type_severity ON continuous_issues(issue_type, severity);
CREATE INDEX idx_issues_resolved ON continuous_issues(resolved_at) WHERE resolved_at IS NULL;

-- Create summary view
CREATE OR REPLACE VIEW continuous_summary_view AS
SELECT 
    (SELECT COUNT(*) FROM continuous_inventory WHERE item_type = 'service') as total_services,
    (SELECT COUNT(*) FROM continuous_inventory WHERE item_type = 'pipeline') as total_pipelines,
    (SELECT COUNT(*) FROM continuous_inventory WHERE item_type = 'table') as total_tables,
    (SELECT COUNT(*) FROM continuous_inventory WHERE item_type = 'test') as total_tests,
    (SELECT COALESCE(SUM(passed), 0) FROM continuous_test_runs WHERE run_date = CURRENT_DATE) as tests_passed_today,
    (SELECT COALESCE(SUM(failed), 0) FROM continuous_test_runs WHERE run_date = CURRENT_DATE) as tests_failed_today,
    (SELECT COUNT(*) FROM continuous_issues WHERE resolved_at IS NULL) as open_issues,
    (SELECT COUNT(*) FROM continuous_issues WHERE resolved_at IS NULL AND severity = 'critical') as critical_issues,
    (SELECT COUNT(*) FROM continuous_issues WHERE resolved_at IS NULL AND severity = 'high') as high_issues,
    (SELECT MAX(last_seen) FROM continuous_inventory) as last_inventory_update,
    (SELECT MAX(run_time) FROM continuous_test_runs) as last_test_run;

-- Enable RLS
ALTER TABLE continuous_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE continuous_test_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE continuous_issues ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "continuous_inventory_read" ON continuous_inventory FOR SELECT TO authenticated USING (true);
CREATE POLICY "continuous_test_runs_read" ON continuous_test_runs FOR SELECT TO authenticated USING (true);
CREATE POLICY "continuous_issues_read" ON continuous_issues FOR SELECT TO authenticated USING (true);
CREATE POLICY "continuous_inventory_write" ON continuous_inventory FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "continuous_inventory_update" ON continuous_inventory FOR UPDATE TO authenticated USING (true);
CREATE POLICY "continuous_test_runs_write" ON continuous_test_runs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "continuous_issues_write" ON continuous_issues FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "continuous_issues_update" ON continuous_issues FOR UPDATE TO authenticated USING (true);`);
    
    return false;
  } else if (!inventoryError) {
    console.log('✅ continuous_inventory table exists');
    
    // Check other tables
    const { error: testError } = await supabase.from('continuous_test_runs').select('id').limit(1);
    const { error: issuesError } = await supabase.from('continuous_issues').select('id').limit(1);
    
    if (!testError) console.log('✅ continuous_test_runs table exists');
    if (!issuesError) console.log('✅ continuous_issues table exists');
    
    return true;
  }
  
  return false;
}

// Run if called directly
if (require.main === module) {
  setupTables()
    .then(success => {
      if (success) {
        console.log('\n✅ All Phase 1 tables are ready!');
        console.log('\nYou can now run:');
        console.log('  ./scripts/cli-pipeline/continuous/continuous-cli.sh discover');
      } else {
        console.log('\n⚠️  Please create the tables using the SQL above, then run this script again.');
      }
    })
    .catch(console.error);
}