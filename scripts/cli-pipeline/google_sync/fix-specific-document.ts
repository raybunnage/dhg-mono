#!/usr/bin/env ts-node
/**
 * Script to fix a specific document by clearing its processing_skip_reason
 */

import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// Load environment variables properly
const envPaths = [
  path.resolve(process.cwd(), '../../../.env.development'),
  path.resolve(process.cwd(), '../../../.env'),
  path.resolve(process.cwd(), '.env.development'),
  path.resolve(process.cwd(), '.env')
];

// Try loading from each path
for (const envPath of envPaths) {
  if (fs.existsSync(envPath)) {
    console.log(`Loading environment variables from ${envPath}`);
    dotenv.config({ path: envPath });
  }
}

async function fixSpecificDocument() {
  try {
    console.log("Initializing Supabase client...");
    console.log(`Using SUPABASE_URL: ${process.env.SUPABASE_URL ? 'Defined' : 'Undefined'}`);
    console.log(`Using SUPABASE_SERVICE_ROLE_KEY: ${process.env.SUPABASE_SERVICE_ROLE_KEY ? 'Defined' : 'Undefined'}`);
    
    const supabase = SupabaseClientService.getInstance().getClient();
    
    // Document ID to fix
    const documentId = '619a4fbf-20eb-42bf-930d-9a0d6e6e0ba8';
    
    console.log(`Fixing document with ID: ${documentId}`);
    
    // Update the document
    const { data, error } = await supabase
      .from('google_expert_documents')
      .update({ 
        processing_skip_reason: null,
        document_processing_status_updated_at: new Date().toISOString()
      })
      .eq('id', documentId)
      .select();
    
    if (error) {
      throw new Error(`Error updating document: ${error.message}`);
    }
    
    console.log(`Document updated: ${JSON.stringify(data, null, 2)}`);
    console.log('✅ Success! The document has been fixed. You can now run the classify-pdfs command.');
    
  } catch (error) {
    console.error(`Error fixing document: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Run the fix
fixSpecificDocument();