#!/usr/bin/env ts-node

import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';

async function checkGetTableFunctions() {
  const supabase = SupabaseClientService.getInstance().getClient();
  
  try {
    // Query to list all functions starting with 'get_table'
    const { data, error } = await supabase.rpc('execute_sql', {
      sql: `
        SELECT 
          p.proname as function_name,
          pg_catalog.pg_get_function_identity_arguments(p.oid) as arguments,
          pg_catalog.pg_get_function_result(p.oid) as return_type
        FROM pg_catalog.pg_proc p
        JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
          AND p.proname LIKE 'get_table%'
        ORDER BY p.proname;
      `
    });

    if (error) {
      console.error('Error querying functions:', error);
      return;
    }

    console.log('Functions starting with "get_table":');
    console.log('=====================================');
    
    if (data && data.length > 0) {
      data.forEach((func: any) => {
        console.log(`\nFunction: ${func.function_name}`);
        console.log(`Arguments: ${func.arguments || 'none'}`);
        console.log(`Returns: ${func.return_type}`);
      });
    } else {
      console.log('No functions found starting with "get_table"');
    }

  } catch (err) {
    console.error('Error:', err);
  }
}

checkGetTableFunctions();