import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

async function checkAvailableTables() {
  const supabase = SupabaseClientService.getInstance().getClient();
  
  console.log('Checking available tables and functions...\n');
  
  // Check for common tables
  const commonTables = [
    'experts',
    'expert_documents', 
    'document_types',
    'sources_google',
    'scripts',
    'prompts',
    'prompt_output_templates',
    'prompt_template_associations',
    'user_profiles',
    'auth_user_profiles',
    'profiles'
  ];
  
  console.log('Checking common tables:');
  console.log('='.repeat(60));
  
  for (const tableName of commonTables) {
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .limit(1);
      
    if (!error) {
      console.log(`✓ ${tableName} - EXISTS`);
    } else if (error.message.includes('not found')) {
      console.log(`✗ ${tableName} - NOT FOUND`);
    } else {
      console.log(`? ${tableName} - ERROR: ${error.message}`);
    }
  }
  
  // Check for RPC functions
  console.log('\n\nChecking for RPC functions:');
  console.log('='.repeat(60));
  
  const rpcFunctions = [
    'execute_sql',
    'check_auth_user',
    'get_schema_info',
    'list_tables',
    'get_table_info'
  ];
  
  for (const funcName of rpcFunctions) {
    try {
      // Try to call with minimal/invalid params to see if function exists
      const { data, error } = await supabase.rpc(funcName, {});
      
      if (error && error.message.includes('Could not find')) {
        console.log(`✗ ${funcName} - NOT FOUND`);
      } else if (error) {
        // Function exists but we called it wrong
        console.log(`✓ ${funcName} - EXISTS (error: ${error.message})`);
      } else {
        console.log(`✓ ${funcName} - EXISTS`);
      }
    } catch (err: any) {
      console.log(`? ${funcName} - ERROR: ${err.message}`);
    }
  }
  
  // Try to get schema info using get_schema_info if it exists
  console.log('\n\nTrying to get schema information:');
  console.log('='.repeat(60));
  
  try {
    const { data: schemaInfo, error: schemaError } = await supabase.rpc('get_schema_info', {});
    
    if (!schemaError && schemaInfo) {
      console.log('Schema info available:');
      console.log(JSON.stringify(schemaInfo, null, 2));
    } else if (schemaError) {
      console.log('Could not get schema info:', schemaError.message);
    }
  } catch (err: any) {
    console.log('Error getting schema info:', err.message);
  }
  
  // Check if we can see any prompt-related tables or views
  console.log('\n\nChecking for prompt-related objects:');
  console.log('='.repeat(60));
  
  const promptRelated = [
    'prompts',
    'prompt_templates',
    'prompt_outputs',
    'prompt_history',
    'prompt_categories',
    'prompt_metadata'
  ];
  
  for (const tableName of promptRelated) {
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .limit(1);
      
    if (!error) {
      const { count } = await supabase
        .from(tableName)
        .select('*', { count: 'exact', head: true });
      console.log(`✓ ${tableName} - EXISTS (${count || 0} rows)`);
    }
  }
}

// Run the check
checkAvailableTables().catch(console.error);