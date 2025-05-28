# Archived on 2025-04-11 - Original file used with sources_google table
#!/usr/bin/env ts-node
/**
 * Check Google Drive Root Folders
 *
 * This script lists all registered root folders in the database.
 *
 * Usage:
 *   npx ts-node check-roots.ts
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../../../../../../supabase/types';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../../../../../.env.development') });

async function main() {
  try {
    // Ensure Supabase credentials are available
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('❌ Supabase URL or key not found in environment variables');
      process.exit(1);
    }

    console.log(`Using Supabase URL: ${supabaseUrl}`);
    
    // Create Supabase client
    const supabase = createClient<Database>(supabaseUrl, supabaseKey);

    // Get all root folders
    const { data, error } = await supabase
      .from('google_sources')
      .select('*')
      .eq('is_root', true)
      .eq('deleted', false)
      .order('name');

    if (error) {
      throw error;
    }

    if (!data || data.length === 0) {
      console.log('No root folders found in the database.');
      return;
    }

    console.log(`Found ${data.length} registered root folders:`);
    console.log('--------------------------------------------');

    data.forEach((folder, index) => {
      console.log(`${index + 1}. ${folder.name}`);
      console.log(`   ID: ${folder.id}`);
      console.log(`   Drive ID: ${folder.drive_id}`);
      console.log(`   Path: ${folder.path}`);
      console.log(`   Last Synced: ${folder.last_indexed || 'Never'}`);
      console.log(`   Created: ${new Date(folder.created_at).toLocaleString()}`);
      console.log('--------------------------------------------');
    });

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Execute the main function
main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});