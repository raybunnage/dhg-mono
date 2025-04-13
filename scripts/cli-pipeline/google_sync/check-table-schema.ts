#!/usr/bin/env ts-node
/**
 * Check the schema of the sources_google table
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env.local') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env.development') });

// Create Supabase client
const supabaseClientService = SupabaseClientService.getInstance();
const supabase = supabaseClientService.getClient();

async function checkSchema() {
  console.log('Checking schema of sources_google table...');
  
  try {
    // Query the information schema to get column details
    const { data, error } = await supabase.rpc('get_table_definition', {
      table_name: 'sources_google'
    });
    
    if (error) {
      console.error('Error:', error);
      
      // Fallback to a simple query if the RPC call fails
      console.log('Trying fallback approach...');
      
      const { data: sampleData, error: sampleError } = await supabase
        .from('sources_google')
        .select('*')
        .limit(1);
        
      if (sampleError) {
        console.error('Error with fallback query:', sampleError);
        return;
      }
      
      if (sampleData && sampleData.length > 0) {
        console.log('Sample record structure:');
        const columns = Object.keys(sampleData[0]);
        columns.forEach(column => {
          const value = sampleData[0][column];
          const type = value === null ? 'null' : typeof value;
          console.log(`${column}: ${type}`);
        });
      } else {
        console.log('No sample records found');
      }
      
      return;
    }
    
    console.log('Table definition:');
    console.log(data);
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

checkSchema();