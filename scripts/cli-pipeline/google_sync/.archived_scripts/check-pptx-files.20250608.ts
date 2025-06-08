#!/usr/bin/env ts-node
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

async function checkPptxFiles() {
  const supabase = SupabaseClientService.getInstance().getClient();
  
  console.log('Checking PowerPoint (.pptx) files...');
  
  // First check files without document_type_id
  const { data: nullData, error: nullError } = await supabase
    .from('google_sources')
    .select('id, name, mime_type, document_type_id')
    .ilike('name', '%.pptx%')
    .is('document_type_id', null);
  
  if (nullError) {
    console.error('Error checking for null document_type_id:', nullError.message);
  } else {
    console.log(`Found ${nullData?.length || 0} PowerPoint (.pptx) files with null document_type_id`);
  }
  
  // Then check files with a different document_type_id than the one we want to set
  const targetId = '299ad443-4d84-40d8-98cb-a9df423ba451';
  const { data, error } = await supabase
    .from('google_sources')
    .select('id, name, mime_type, document_type_id')
    .ilike('name', '%.pptx%')
    .not('document_type_id', 'eq', targetId);
  
  if (error) {
    console.error('Error:', error.message);
    return;
  }
  
  console.log(`Found ${data?.length || 0} PowerPoint (.pptx) files with different document_type_id than target:`);
  data?.forEach(file => {
    console.log(`- ${file.name}, current type ID: ${file.document_type_id || 'null'}`);
  });
  
  // Count total PPTX files for comparison
  const { count: totalCount, error: countError } = await supabase
    .from('google_sources')
    .select('id', { count: 'exact' })
    .ilike('name', '%.pptx%');
    
  if (countError) {
    console.error('Error counting total files:', countError.message);
  } else {
    const total = totalCount || 0;
    console.log(`\nTotal PowerPoint (.pptx) files: ${total}`);
    console.log(`Files that would be updated by the command: ${(nullData?.length || 0) + (data?.length || 0)}`);
    console.log(`Files already having the target document_type_id: ${total - ((nullData?.length || 0) + (data?.length || 0))}`);
  }
}

checkPptxFiles();