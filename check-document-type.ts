#!/usr/bin/env ts-node

import { SupabaseClientService } from './packages/shared/services/supabase-client';

async function checkDocTypeId() {
  const supabase = SupabaseClientService.getInstance().getClient();
  
  // Check if the specific ID exists in document_types
  const docTypeId = '52ed9494-446e-4654-9395-e2ac1459ddcd';
  
  console.log(`Checking if document type ID exists: ${docTypeId}`);
  
  // Check in document_types
  const { data: newTypeData, error: newTypeError } = await supabase
    .from('document_types')
    .select('id, name, category')
    .eq('id', docTypeId);
    
  if (newTypeError) {
    console.error('Error checking document_types:', newTypeError.message);
  } else {
    console.log(`Found in document_types: ${newTypeData && newTypeData.length > 0 ? 'YES' : 'NO'}`);
    if (newTypeData && newTypeData.length > 0) {
      console.log(`Name: ${newTypeData[0].name}, Category: ${newTypeData[0].category}`);
    }
  }
  
  // Check in document_types_original
  const { data: origTypeData, error: origTypeError } = await supabase
    .from('document_types_original')
    .select('id, document_type, category')
    .eq('id', docTypeId);
    
  if (origTypeError) {
    console.error('Error checking document_types_original:', origTypeError.message);
  } else {
    console.log(`Found in document_types_original: ${origTypeData && origTypeData.length > 0 ? 'YES' : 'NO'}`);
    if (origTypeData && origTypeData.length > 0) {
      console.log(`Document Type: ${origTypeData[0].document_type}, Category: ${origTypeData[0].category}`);
    }
  }
}

// Run the function
checkDocTypeId().catch(error => {
  console.error('Error:', error);
});
