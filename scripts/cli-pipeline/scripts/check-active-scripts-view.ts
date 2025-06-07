/**
 * Simple script to check if active_scripts_view exists in the database
 * Uses the SupabaseClientService singleton
 */
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

async function checkView() {
  console.log('Using SupabaseClientService singleton...');
  const supabase = SupabaseClientService.getInstance().getClient();
  
  try {
    // Check if view exists by querying it
    console.log('Checking if active_scripts_view exists...');
    const { data, error } = await supabase
      .from('registry_scripts_active_view')
      .select('*')
      .limit(1);
    
    if (error) {
      console.error('Error querying active_scripts_view:', error);
      console.log('The view likely does not exist or has errors.');
    } else {
      console.log('Success! active_scripts_view exists in the database.');
      console.log('Sample data:', data);
    }
    
    // Try to get view definition using system tables
    console.log('\nAttempting to get view definition...');
    const { data: viewDef, error: viewDefError } = await supabase.rpc(
      'execute_sql', 
      { 
        sql: `
          SELECT table_name, view_definition
          FROM information_schema.views
          WHERE table_schema = 'public'
          AND table_name = 'active_scripts_view';
        `
      }
    );
    
    if (viewDefError) {
      console.error('Error getting view definition:', viewDefError);
    } else {
      console.log('View definition results:', viewDef);
    }
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

checkView().catch(console.error);