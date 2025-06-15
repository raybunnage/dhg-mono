import { SupabaseClientService } from './packages/shared/services/supabase-client';

async function checkSharedServices() {
  const supabase = SupabaseClientService.getInstance().getClient();
  
  // Check if we have is_refactored and refactored_date columns
  const { data, error } = await supabase
    .from('sys_shared_services')
    .select('service_name, service_path, has_tests, test_coverage_percent, last_test_run, migration_status')
    .ilike('service_path', '%-refactored%')
    .order('service_name');
    
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  console.log('Total refactored services:', data?.length);
  console.log('\nRefactored services status:');
  data?.forEach(s => {
    const testStatus = s.has_tests ? `✅ ${s.test_coverage_percent || 0}%` : '❌ No tests';
    console.log(`- ${s.service_name}: ${testStatus}`);
  });
  
  console.log('\nRefactored services needing test work:');
  const needsWork = data?.filter(s => !s.has_tests || !s.test_coverage_percent || s.test_coverage_percent < 80) || [];
  needsWork.forEach(s => {
    console.log(`- ${s.service_name} (${s.service_path})`);
  });
  
  // Check if we need to add columns
  console.log('\nChecking for is_refactored column...');
  const { data: tableInfo } = await supabase.rpc('get_table_info', { table_name: 'sys_shared_services' });
  const hasIsRefactored = tableInfo?.some((col: any) => col.column_name === 'is_refactored');
  const hasRefactoredDate = tableInfo?.some((col: any) => col.column_name === 'refactored_date');
  
  if (!hasIsRefactored || !hasRefactoredDate) {
    console.log('\nMissing columns:');
    if (!hasIsRefactored) console.log('- is_refactored');
    if (!hasRefactoredDate) console.log('- refactored_date');
    console.log('\nCreate migration to add these columns for better tracking.');
  }
}

checkSharedServices();