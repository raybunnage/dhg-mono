/**
 * Supabase Connection Fix
 * 
 * Debug script to check and fix Supabase connection issues.
 */
import { createClient } from '@supabase/supabase-js';
import { environmentService } from '../shared/services/environment-service';

async function checkConnection() {
  // Get config
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
    // Create client with specific options for debugging
    const client = createClient(config.supabaseUrl, config.supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      },
      // Set longer timeout for debugging
      global: {
        fetch: (url, options) => {
          return fetch(url, {
            ...options,
            timeout: 30000 // 30 seconds timeout
          });
        }
      }
    });

    console.log('Testing connection to documentation_files table...');
    
    // Test connection with simple query that won't return much data
    const { data, error, count } = await client
      .from('documentation_files')
      .select('*', { count: 'exact' })
      .limit(1);
    
    if (error) {
      console.error('Connection error:', error);
      return;
    }
    
    console.log('Connection successful! Found', count, 'records in documentation_files table');
    console.log('Sample data:', data);
    
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