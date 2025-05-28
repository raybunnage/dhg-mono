#!/usr/bin/env ts-node
/**
 * Script to check the status of the specific document after the fix
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

async function checkDocumentStatus() {
  try {
    console.log("Initializing Supabase client...");
    const supabase = SupabaseClientService.getInstance().getClient();
    
    // Document ID to check
    const documentId = '619a4fbf-20eb-42bf-930d-9a0d6e6e0ba8';
    
    console.log(`Checking document with ID: ${documentId}`);
    
    // Get document status
    const { data, error } = await supabase
      .from('expert_documents')
      .select(`
        id,
        document_processing_status,
        processing_skip_reason,
        document_processing_status_updated_at,
        source_id
      `)
      .eq('id', documentId)
      .single();
    
    if (error) {
      throw new Error(`Error fetching document: ${error.message}`);
    }
    
    console.log(`Document status: ${data?.document_processing_status}`);
    console.log(`Skip reason: ${data?.processing_skip_reason || 'None'}`);
    console.log(`Status updated at: ${data?.document_processing_status_updated_at || 'Unknown'}`);
    
    // Check why the document isn't being picked up by classify-pdfs
    if (data?.source_id) {
      console.log(`\nChecking sources_google record with ID: ${data.source_id}`);
      
      const { data: sourceData, error: sourceError } = await supabase
        .from('google_sources')
        .select('*')
        .eq('id', data.source_id)
        .single();
      
      if (sourceError) {
        console.log(`Error fetching sources_google: ${sourceError.message}`);
      } else {
        console.log(`File name: ${sourceData?.name || 'Unknown'}`);
        console.log(`MIME type: ${sourceData?.mime_type || 'Unknown'}`);
        console.log(`Document type ID: ${sourceData?.document_type_id || 'None'}`);
        
        // Check the document type
        if (sourceData?.document_type_id) {
          const { data: typeData, error: typeError } = await supabase
            .from('document_types')
            .select('*')
            .eq('id', sourceData.document_type_id)
            .single();
          
          if (typeError) {
            console.log(`Error fetching document type: ${typeError.message}`);
          } else {
            console.log(`Document type: ${typeData?.document_type || 'Unknown'}`);
            console.log(`Category: ${typeData?.category || 'Unknown'}`);
            console.log(`Classifier: ${typeData?.classifier || 'None'}`);
          }
          
          if (sourceData.mime_type === 'application/pdf' && typeData?.classifier) {
            console.log(`\n⚠️ This PDF already has a document type with a classifier, so classify-pdfs won't process it.`);
            console.log(`It needs to have document_type_id=null or the document type needs to have classifier=null.`);
            
            // Suggestion to fix
            console.log(`\nTo fix this, you can set the document_type_id to null in sources_google:`);
            console.log(`
            const { error } = await supabase
              .from('google_sources')
              .update({ document_type_id: null })
              .eq('id', '${sourceData.id}');
            `);
          }
          
          // Check if there are PDF documents that need processing
          console.log(`\nChecking for PDF documents that need processing...`);
          
          const { data: eligibleDocs, error: eligibleError } = await supabase
            .from('google_sources')
            .select(`
              id,
              name,
              mime_type,
              document_type_id,
              expert_documents:expert_documents(document_processing_status, processing_skip_reason)
            `)
            .eq('mime_type', 'application/pdf')
            .is('document_type_id', null)
            .limit(5);
          
          if (eligibleError) {
            console.log(`Error fetching eligible documents: ${eligibleError.message}`);
          } else {
            console.log(`Found ${eligibleDocs?.length || 0} PDF documents with document_type_id=null`);
            
            if (eligibleDocs && eligibleDocs.length > 0) {
              console.log(`Sample eligible documents:`);
              eligibleDocs.forEach((doc, i) => {
                const needsReprocessing = doc.expert_documents?.some((e: any) => 
                  e.document_processing_status === 'needs_reprocessing' && !e.processing_skip_reason
                );
                
                console.log(`${i + 1}. ${doc.name} (${needsReprocessing ? 'Needs reprocessing' : 'Does not need reprocessing'})`);
              });
            }
          }
        }
      }
    }
    
  } catch (error) {
    console.error(`Error checking document status: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Run the check
checkDocumentStatus();