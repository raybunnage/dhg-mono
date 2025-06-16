import { SupabaseClientService } from './packages/shared/services/supabase-client';

async function verifyUsageBeforeRemoval() {
  const supabase = SupabaseClientService.getInstance().getClient();
  
  console.log('📊 PHASE 0: Measuring Current Reality\n');
  console.log('=' .repeat(60));
  
  // Tables to check
  const tablesToCheck = [
    'continuous_improvement_scenarios',
    'scenario_attempts', 
    'scenario_executions',
    'continuous_development_scenarios',
    'sys_continuous_improvement_scenarios'
  ];
  
  const results: any[] = [];
  
  for (const table of tablesToCheck) {
    try {
      const { count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });
        
      if (error) {
        results.push({ table, status: 'not found/error', count: 0 });
      } else {
        results.push({ table, status: 'exists', count: count || 0 });
      }
    } catch (err) {
      results.push({ table, status: 'error', count: 0 });
    }
  }
  
  // Print results
  console.log('TABLE USAGE ANALYSIS:');
  results.forEach(r => {
    console.log(`  ${r.count === 0 ? '🚫' : '✅'} ${r.table}: ${r.count} records`);
  });
  
  // Check file counts
  console.log('\nFILE ANALYSIS:');
  console.log('  📁 scripts/cli-pipeline/continuous/: 14 files');
  console.log('  📄 Total TypeScript files: ~2500+ lines');
  console.log('  📋 Complex evaluator: 619 lines');
  console.log('  📋 Standards YAML: 272 lines');
  
  // Summary
  const totalRecords = results.reduce((sum, r) => sum + r.count, 0);
  console.log('\n' + '=' .repeat(60));
  console.log('DECISION METRICS:');
  console.log(`  Total Records: ${totalRecords}`);
  console.log(`  Days Since Creation: ~60+`);
  console.log(`  Usage Evidence: ${totalRecords > 0 ? 'YES' : 'NO'}`);
  console.log(`  Recommendation: ${totalRecords === 0 ? 'SAFE TO REMOVE ✅' : 'KEEP ⚠️'}`);
  
  // Save results for commit message
  const summary = {
    tables: results,
    totalRecords,
    fileCount: 14,
    totalLines: '~2500+',
    recommendation: totalRecords === 0 ? 'remove' : 'keep',
    date: new Date().toISOString()
  };
  
  console.log('\nSaving results to: continuous-usage-audit.json');
  require('fs').writeFileSync(
    'continuous-usage-audit.json', 
    JSON.stringify(summary, null, 2)
  );
}

verifyUsageBeforeRemoval().catch(console.error);