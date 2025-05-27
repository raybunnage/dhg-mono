#!/usr/bin/env ts-node
/**
 * Script to query document types from the Supabase database
 */

import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

async function queryDocumentTypes() {
  try {
    // Get the Supabase client
    const supabase = SupabaseClientService.getInstance().getClient();
    
    // Query all document types
    const { data, error } = await supabase
      .from('document_types')
      .select('id, document_type, description, category')
      .order('document_type');
      
    if (error) {
      console.error('Error querying document types:', error);
      return;
    }
    
    if (!data || data.length === 0) {
      console.log('No document types found');
      return;
    }
    
    // Display the document types
    console.log('Found', data.length, 'document types:');
    console.log('-----------------------------------');
    
    data.forEach((type, index) => {
      console.log(`${index + 1}. ${type.document_type} (${type.id})`);
      if (type.description) {
        console.log(`   Description: ${type.description}`);
      }
      if (type.category) {
        console.log(`   Category: ${type.category}`);
      }
      console.log('-----------------------------------');
    });
    
  } catch (error) {
    console.error('Error in queryDocumentTypes:', error);
  }
}

// Run the function
queryDocumentTypes();