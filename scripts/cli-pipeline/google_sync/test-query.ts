#!/usr/bin/env ts-node
/**
 * Test querying expert_documents
 */

import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

async function testQuery(): Promise<void> {
  try {
    const supabase = SupabaseClientService.getInstance().getClient();
    
    // Try a simple query to see what columns are returned
    console.log('Testing query on expert_documents...');
    
    const { data, error } = await supabase
      .from('google_expert_documents')
      .select('*')
      .limit(1);
      
    if (error) {
      console.error(`Error querying expert_documents: ${error.message}`);
      return;
    }
    
    if (!data || data.length === 0) {
      console.log('No data returned from expert_documents.');
      return;
    }
    
    // Print the columns available
    console.log('Columns available in expert_documents:');
    const columns = Object.keys(data[0]);
    columns.forEach(col => console.log(`- ${col}`));
    
    // Print the sample data
    console.log('\nSample data:');
    console.log(JSON.stringify(data[0], null, 2));
    
  } catch (error: any) {
    console.error(`Error in test query: ${error.message || error}`);
  }
}

// Run the function
testQuery();