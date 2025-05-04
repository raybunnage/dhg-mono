#!/usr/bin/env ts-node
/**
 * Script to reset the document_type_id in sources_google so classify-pdfs can process it
 */

import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// Load environment variables properly
const envPaths = [
  path.resolve(process.cwd(), '.env.development'),
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), 'scripts/cli-pipeline/google_sync/.env')
];

// Try loading from each path
for (const envPath of envPaths) {
  if (fs.existsSync(envPath)) {
    console.log(`Loading environment variables from ${envPath}`);
    dotenv.config({ path: envPath });
  }
}

async function resetDocumentType() {
  try {
    console.log("Initializing Supabase client...");
    const supabase = SupabaseClientService.getInstance().getClient();
    
    // Document to fix in sources_google
    const sourceId = 'c06794b0-be0b-4051-ad11-e1fe60134982';
    
    console.log(`Resetting document_type_id for sources_google record with ID: ${sourceId}`);
    
    // Update the sources_google record
    const { data, error } = await supabase
      .from('sources_google')
      .update({ document_type_id: null })
      .eq('id', sourceId)
      .select();
    
    if (error) {
      throw new Error(`Error updating sources_google: ${error.message}`);
    }
    
    console.log(`Successfully reset document_type_id for sources_google record: ${JSON.stringify(data, null, 2)}`);
    
    // Also update document_processing_status to needs_reprocessing
    const expertDocumentId = '619a4fbf-20eb-42bf-930d-9a0d6e6e0ba8';
    console.log(`\nUpdating expert_document with ID: ${expertDocumentId} to needs_reprocessing`);
    
    const { data: expertData, error: expertError } = await supabase
      .from('expert_documents')
      .update({ 
        document_processing_status: 'needs_reprocessing',
        processing_skip_reason: null,
        document_processing_status_updated_at: new Date().toISOString()
      })
      .eq('id', expertDocumentId)
      .select();
    
    if (expertError) {
      throw new Error(`Error updating expert_document: ${expertError.message}`);
    }
    
    console.log(`Successfully updated expert_document: ${JSON.stringify(expertData, null, 2)}`);
    console.log('\n✅ Success! The documents have been reset. You can now run the classify-pdfs command.');
    
  } catch (error) {
    console.error(`Error resetting document type: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Run the reset
resetDocumentType();