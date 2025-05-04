#!/usr/bin/env ts-node
import { PresentationService } from '../services/presentation-service';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.development' });

async function main() {
  try {
    console.log('Finding a valid transcript document for testing...');
    
    // Initialize the presentation service
    const presentationService = PresentationService.getInstance();
    
    // Get the document type ID for Video Summary Transcript
    const { data: docType, error: docTypeError } = await presentationService.supabaseClient
      .from('document_types')
      .select('id')
      .eq('document_type', 'Video Summary Transcript')
      .single();
    
    if (docTypeError || !docType) {
      console.error('Error finding document type:', docTypeError);
      process.exit(1);
    }
    
    console.log(`Found document type ID: ${docType.id}`);
    
    // Find expert documents with valid transcript content
    const { data: documents, error: docsError } = await presentationService.supabaseClient
      .from('expert_documents')
      .select(`
        id,
        document_type_id,
        source_id,
        ai_summary_status,
        raw_content
      `)
      .eq('document_type_id', docType.id)
      .not('raw_content', 'is', null)
      .not('raw_content', 'ilike', '%Expert Video Summary Generation Prompt%')
      .not('raw_content', 'ilike', '%prompt-service-cli.sh%')
      .not('raw_content', 'ilike', '%prompt%')
      .limit(10);
    
    if (docsError) {
      console.error('Error finding documents:', docsError);
      process.exit(1);
    }
    
    if (!documents || documents.length === 0) {
      console.error('No valid transcript documents found');
      process.exit(1);
    }
    
    console.log(`Found ${documents.length} valid transcript documents:`);
    
    documents.forEach((doc: any, index: number) => {
      console.log(`\n${index + 1}. Document ID: ${doc.id}`);
      console.log(`   Source ID: ${doc.source_id || 'Unknown'}`);
      console.log(`   AI Summary Status: ${doc.ai_summary_status || 'null'}`);
      console.log(`   Content Preview: ${doc.raw_content ? doc.raw_content.substring(0, 200) : 'No preview'}`);
    });
    
  } catch (error) {
    console.error('Error finding transcript document:', error);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Uncaught error:', err);
  process.exit(1);
});