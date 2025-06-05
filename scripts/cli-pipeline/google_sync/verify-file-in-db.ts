#!/usr/bin/env ts-node
/**
 * Verify a file exists in the sources_google table
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env.local') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env.development') });

// Process command line arguments
const args = process.argv.slice(2);
const fileId = args[0] || '1_2vt2t954u8PeoYbTgIyVrNtxN-uZqMhjGFCI5auBvM';

// Create Supabase client
const supabaseClientService = SupabaseClientService.getInstance();
const supabase = supabaseClientService.getClient();

async function verifyFile() {
  console.log(`Verifying file with ID: ${fileId}`);
  
  try {
    const { data, error } = await supabase
      .from('google_sources')
      .select('*')
      .eq('drive_id', fileId);
      
    if (error) {
      console.error('Error:', error);
      return;
    }
    
    if (!data || data.length === 0) {
      console.log('File not found in database');
      return;
    }
    
    console.log(`Found ${data.length} record(s):`);
    data.forEach((record, index) => {
      console.log(`\nRecord ${index + 1}:`);
      console.log(`ID: ${record.id}`);
      console.log(`Name: ${record.name}`);
      console.log(`Drive ID: ${record.drive_id}`);
      console.log(`Path: ${record.path}`);
      console.log(`Path Array: ${JSON.stringify(record.path_array)}`);
      console.log(`Path Depth: ${record.path_depth}`);
      console.log(`Parent Folder ID: ${record.parent_folder_id}`);
      console.log(`Root Drive ID: ${record.root_drive_id}`);
      console.log(`Is Deleted: ${record.is_deleted}`);
      console.log(`File Signature: ${record.file_signature || 'Not set'}`);
      console.log(`Created At: ${record.created_at}`);
      console.log(`Updated At: ${record.updated_at}`);
    });
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

verifyFile();