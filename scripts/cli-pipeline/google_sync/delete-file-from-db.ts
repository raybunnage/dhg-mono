#!/usr/bin/env ts-node
/**
 * Delete a specific file from sources_google table
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

async function deleteFile() {
  console.log(`Deleting file with drive_id: ${fileId}`);
  
  try {
    // First check if file exists
    const { data, error: queryError } = await supabase
      .from('google_sources')
      .select('id, name, drive_id')
      .eq('drive_id', fileId);
      
    if (queryError) {
      console.error('Error querying file:', queryError);
      return;
    }
    
    if (!data || data.length === 0) {
      console.log('File not found in database');
      return;
    }
    
    console.log(`Found file: ${data[0].name} (ID: ${data[0].id})`);
    
    // Delete the file
    const { error: deleteError } = await supabase
      .from('google_sources')
      .delete()
      .eq('drive_id', fileId);
      
    if (deleteError) {
      console.error('Error deleting file:', deleteError);
      return;
    }
    
    console.log('File deleted successfully');
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

deleteFile();