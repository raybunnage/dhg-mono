import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables properly
const envPaths = [
  path.resolve(process.cwd(), '.env.development'),
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), 'scripts/cli-pipeline/google_sync/.env')
];

// Try loading from each path
for (const envPath of envPaths) {
  dotenv.config({ path: envPath });
}

async function checkSpecificDocument() {
  try {
    console.log("Initializing Supabase client...");
    const supabase = SupabaseClientService.getInstance().getClient();
    
    // First test the connection
    const connectionTest = await supabase.from('google_expert_documents').select('id').limit(1);
    if (connectionTest.error) {
      throw new Error(`Supabase connection error: ${connectionTest.error.message}`);
    }
    console.log("Supabase connection successful");

    // Check the specific document mentioned in the issue
    console.log("\nChecking specific document with ID: 619a4fbf-20eb-42bf-930d-9a0d6e6e0ba8");
    console.log("======================================================================");
    
    const { data: specificDoc, error: docError } = await supabase
      .from('google_expert_documents')
      .select('*')
      .eq('id', '619a4fbf-20eb-42bf-930d-9a0d6e6e0ba8')
      .single();
    
    if (docError) {
      throw new Error(`Error fetching specific document: ${docError.message}`);
    }
    
    console.log(JSON.stringify(specificDoc, null, 2));
    
    // Get the sources_google document associated with this expert_document
    if (specificDoc && specificDoc.source_id) {
      console.log(`\nFetching sources_google record with ID: ${specificDoc.source_id}`);
      
      const { data: sourceDoc, error: sourceError } = await supabase
        .from('google_sources')
        .select('*')
        .eq('id', specificDoc.source_id)
        .single();
      
      if (sourceError) {
        console.log(`Error fetching sources_google: ${sourceError.message}`);
      } else {
        console.log("\nSources Google record:");
        console.log(JSON.stringify(sourceDoc, null, 2));
      }
    }
    
    // Get the document_type associated with this expert_document
    if (specificDoc && specificDoc.document_type_id) {
      console.log(`\nFetching document_type with ID: ${specificDoc.document_type_id}`);
      
      const { data: documentType, error: typeError } = await supabase
        .from('document_types')
        .select('*')
        .eq('id', specificDoc.document_type_id)
        .single();
      
      if (typeError) {
        console.log(`Error fetching document_type: ${typeError.message}`);
      } else {
        console.log("\nDocument Type record:");
        console.log(JSON.stringify(documentType, null, 2));
      }
    }
    
    // Look at the classify-pdfs-with-service logic
    console.log("\nAnalyzing how classify-pdfs-with-service processes documents");
    
    // Count documents with needs_reprocessing status and processing_skip_reason
    const { data: countWithSkip, error: countWithSkipError } = await supabase
      .from('google_expert_documents')
      .select('id', { count: 'exact', head: true })
      .eq('document_processing_status', 'needs_reprocessing')
      .not('processing_skip_reason', 'is', null);
    
    if (countWithSkipError) {
      console.log(`Error counting documents with skip reason: ${countWithSkipError.message}`);
    } else {
      console.log(`\nDocuments with needs_reprocessing status AND processing_skip_reason: ${countWithSkip}`);
    }
    
    // Count documents with needs_reprocessing status but no processing_skip_reason
    const { data: countWithoutSkip, error: countWithoutSkipError } = await supabase
      .from('google_expert_documents')
      .select('id', { count: 'exact', head: true })
      .eq('document_processing_status', 'needs_reprocessing')
      .is('processing_skip_reason', null);
    
    if (countWithoutSkipError) {
      console.log(`Error counting documents without skip reason: ${countWithoutSkipError.message}`);
    } else {
      console.log(`\nDocuments with needs_reprocessing status BUT NO processing_skip_reason: ${countWithoutSkip}`);
    }
    
    // Get a few samples of documents with needs_reprocessing and processing_skip_reason
    const { data: sampleDocs, error: sampleError } = await supabase
      .from('google_expert_documents')
      .select('id, document_processing_status, processing_skip_reason')
      .eq('document_processing_status', 'needs_reprocessing')
      .not('processing_skip_reason', 'is', null)
      .limit(5);
    
    if (sampleError) {
      console.log(`Error fetching sample docs: ${sampleError.message}`);
    } else {
      console.log("\nSample documents with needs_reprocessing and processing_skip_reason:");
      console.log(JSON.stringify(sampleDocs, null, 2));
    }

  } catch (error) {
    console.error('Error checking document:', error);
  }
}

// Run the check
checkSpecificDocument();