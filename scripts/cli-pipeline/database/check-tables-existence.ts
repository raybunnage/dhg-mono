import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

async function checkTablesExistence() {
  console.log('Checking table existence in database...\n');
  
  const supabase = SupabaseClientService.getInstance().getClient();
  
  const tablesToCheck = ['user_roles', 'auth_allowed_emails', 'access_requests'];
  
  // First, let's use the execute_sql function to check table existence
  const { data: sqlResult, error: sqlError } = await supabase.rpc('execute_sql', {
    sql: `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('user_roles', 'auth_allowed_emails', 'access_requests')
    `
  });
  
  if (sqlError) {
    console.error('Error checking tables via SQL:', sqlError);
    console.log('\nTrying alternative approach...\n');
  } else if (sqlResult) {
    console.log('Tables found in database:', sqlResult);
    console.log('');
  }
  
  // Alternative approach: try to query each table directly
  for (const tableName of tablesToCheck) {
    try {
      // Try to count records in the table
      const { count, error: countError } = await supabase
        .from(tableName)
        .select('*', { count: 'exact', head: true });
      
      if (countError) {
        if (countError.code === '42P01') {
          console.log(`❌ Table '${tableName}' does NOT exist`);
        } else {
          console.log(`⚠️  Table '${tableName}' exists but error accessing:`, countError.message);
        }
      } else {
        console.log(`✅ Table '${tableName}' EXISTS`);
        console.log(`   Record count: ${count}`);
      }
    } catch (error) {
      console.error(`Error checking ${tableName}:`, error);
    }
    
    console.log('');
  }
}

// Run the check
checkTablesExistence()
  .then(() => {
    console.log('Table check complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });