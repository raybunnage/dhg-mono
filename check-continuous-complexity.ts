import { SupabaseClientService } from './packages/shared/services/supabase-client';

async function analyzeContinuousComplexity() {
  const supabase = SupabaseClientService.getInstance().getClient();
  
  console.log('🔍 Analyzing Continuous Deployment Complexity\n');
  
  // 1. Check for continuous/scenario related tables
  console.log('1. DATABASE TABLES ANALYSIS');
  console.log('=' .repeat(50));
  
  const { data: continuousTables, error: tablesError } = await supabase
    .from('sys_table_definitions')
    .select('table_name, description, created_date')
    .or('table_name.ilike.%continuous%,table_name.ilike.%scenario%,table_name.ilike.%improvement%')
    .order('created_date', { ascending: false });
    
  if (tablesError) {
    console.error('Error checking tables:', tablesError);
  } else {
    console.log('Found continuous/scenario tables:');
    continuousTables?.forEach(table => {
      console.log(`  📋 ${table.table_name}: ${table.description} (${table.created_date})`);
    });
    console.log(`Total: ${continuousTables?.length || 0} tables\n`);
  }
  
  // 2. Check specific tables for record counts
  const tablesToCheck = [
    'continuous_improvement_scenarios',
    'scenario_attempts', 
    'scenario_executions',
    'continuous_development_scenarios',
    'sys_continuous_improvement_scenarios'
  ];
  
  console.log('2. TABLE RECORD COUNTS');
  console.log('=' .repeat(50));
  
  for (const tableName of tablesToCheck) {
    try {
      const { count, error } = await supabase
        .from(tableName)
        .select('*', { count: 'exact', head: true });
        
      if (error) {
        console.log(`  ❌ ${tableName}: Table not found or error`);
      } else {
        console.log(`  📊 ${tableName}: ${count} records`);
      }
    } catch (err) {
      console.log(`  ❌ ${tableName}: Error checking`);
    }
  }
  
  // 3. Check for evaluation/tracking infrastructure
  console.log('\n3. EVALUATION/TRACKING INFRASTRUCTURE');
  console.log('=' .repeat(50));
  
  const { data: evaluationTables, error: evalError } = await supabase
    .from('sys_table_definitions')
    .select('table_name, description')
    .or('table_name.ilike.%evaluation%,table_name.ilike.%tracking%,table_name.ilike.%metric%')
    .order('table_name');
    
  if (!evalError && evaluationTables) {
    console.log('Found evaluation/tracking tables:');
    evaluationTables.forEach(table => {
      console.log(`  📈 ${table.table_name}: ${table.description}`);
    });
  }
  
  // 4. Check recent migrations for continuous improvement
  console.log('\n4. RECENT CONTINUOUS IMPROVEMENT MIGRATIONS');
  console.log('=' .repeat(50));
  
  // Check migration files
  console.log('Migration files to analyze:');
  console.log('  📄 20250615_phase1_continuous_improvement_simplification.sql');
  console.log('  📄 20250615_create_continuous_improvement_scenarios.sql');
  console.log('  📄 20250615_update_continuous_improvement_scenarios.sql');
  
  console.log('\n📊 COMPLEXITY SUMMARY:');
  console.log('=' .repeat(50));
  console.log('- Multiple tables created for scenarios/tracking');
  console.log('- Complex evaluation systems in place');
  console.log('- Multiple migration files suggesting iterative complexity');
  console.log('- Need to check CLI commands and scripts next');
}

analyzeContinuousComplexity().catch(console.error);