/**
 * Supabase Connection Fix
 * 
 * Debug script to check and fix Supabase connection issues.
 * Uses the standard SupabaseClientService singleton.
 */
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
import { environmentService } from '../shared/services/environment-service';

async function checkConnection() {
  // Get config for debugging purposes
  const config = environmentService.getConfig();
  console.log('Environment configuration loaded:', {
    supabaseUrl: config.supabaseUrl,
    supabaseKeyLength: config.supabaseKey ? config.supabaseKey.length : 0,
    // Show just first and last few characters of key for verification
    supabaseKeyPreview: config.supabaseKey ? 
      `${config.supabaseKey.substring(0, 6)}...${config.supabaseKey.substring(config.supabaseKey.length - 4)}` : 
      'Not set'
  });

  try {
    // Use the SupabaseClientService singleton
    console.log('Using SupabaseClientService singleton...');
    const supabaseService = SupabaseClientService.getInstance();
    
    // Test connection
    const connectionResult = await supabaseService.testConnection();
    
    if (!connectionResult.success) {
      console.error('Connection test failed:', connectionResult.error);
      return;
    }
    
    console.log('Connection test successful!');
    
    // Do additional queries for more testing
    const client = supabaseService.getClient();
    
    console.log('Testing connection to documentation_files table...');
    const { data, error, count } = await client
      .from('documentation_files')
      .select('*', { count: 'exact' })
      .limit(1);
    
    if (error) {
      console.error('Error querying documentation_files:', error);
    } else {
      console.log('Successfully queried documentation_files! Found', count, 'records');
      console.log('Sample data:', data);
    }
    
    // Also check for document_types table which is needed for classification
    const { data: typeData, error: typeError } = await client
      .from('document_types')
      .select('count(*)', { count: 'exact', head: true });
    
    if (typeError) {
      console.error('Error connecting to document_types table:', typeError);
    } else {
      console.log('document_types table connection successful');
    }
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

// Run the connection check
checkConnection().catch(console.error);