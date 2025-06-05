#!/usr/bin/env ts-node
/**
 * Document Types Review and Reclassify Command
 * 
 * Command-line interface for reviewing documents with a specific document type
 * and reclassifying them by updating their document_type_id with a 3-character mnemonic.
 */
import { Command } from 'commander';
import { commandTrackingService } from '../../../../packages/shared/services/tracking-service/command-tracking-service';
import { documentTypeService } from '../../../../packages/shared/services/document-type-service';
import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';
import { Logger } from '../../../../packages/shared/utils/logger';
import * as readline from 'readline';

// Command interface
interface ReviewAndReclassifyOptions {
  name: string;
  limit?: number;
  previewLength?: number;
}

// Main command function
async function reviewAndReclassify(options: ReviewAndReclassifyOptions): Promise<void> {
  const trackingId = await commandTrackingService.startTracking('document_types', 'review-and-reclassify');
  
  try {
    console.log(`Reviewing documents with document type: ${options.name}`);
    
    // Get Supabase client
    const supabase = SupabaseClientService.getInstance().getClient();
    
    // Step 1: Find the document type ID based on the provided name
    const { data: docTypes, error: docTypeError } = await supabase
      .from('document_types')
      .select('id, name, category')
      .eq('name', options.name)
      .limit(1);
    
    if (docTypeError) {
      throw new Error(`Failed to find document type: ${docTypeError.message}`);
    }
    
    if (!docTypes || docTypes.length === 0) {
      console.error(`Document type "${options.name}" not found`);
      await commandTrackingService.failTracking(trackingId, `Document type "${options.name}" not found`);
      process.exit(1);
    }
    
    const documentTypeId = docTypes[0].id;
    console.log(`Found document type ID: ${documentTypeId}`);
    
    // Step 2: Get all document types with mnemonics for selection during reclassification
    console.log('Loading all document types for reclassification options...');
    const { data: allDocTypes, error: allDocTypesError } = await supabase
      .from('document_types')
      .select('id, name, category, mnemonic')
      .order('category')
      .order('name');
    
    if (allDocTypesError) {
      throw new Error(`Failed to load document types: ${allDocTypesError.message}`);
    }
    
    // Create a map of mnemonics to document type IDs
    const mnemonicMap = new Map<string, string>();
    allDocTypes?.forEach(docType => {
      if (docType.mnemonic) {
        mnemonicMap.set(docType.mnemonic, docType.id);
      }
    });
    
    // Create a map of document type IDs to names and categories
    const docTypeMap = new Map<string, { name: string, category: string }>();
    allDocTypes?.forEach(docType => {
      docTypeMap.set(docType.id, { 
        name: docType.name, 
        category: docType.category || 'Uncategorized' 
      });
    });
    
    // Step 3: Query for documents with the specified document type
    console.log(`Fetching sources_google documents with document_type_id: ${documentTypeId}`);
    const query = supabase
      .from('google_sources')
      .select('id, name, drive_id')
      .eq('document_type_id', documentTypeId);
    
    // Apply limit if specified
    if (options.limit) {
      query.limit(options.limit);
    }
    
    const { data: documents, error: documentsError } = await query;
    
    if (documentsError) {
      throw new Error(`Failed to fetch documents: ${documentsError.message}`);
    }
    
    if (!documents || documents.length === 0) {
      console.log(`No documents found with document type "${options.name}"`);
      await commandTrackingService.completeTracking(trackingId, {
        recordsAffected: 0,
        summary: `No documents found with document type "${options.name}"`
      });
      process.exit(0);
    }
    
    console.log(`Found ${documents.length} documents to review`);
    
    // Create readline interface for user input
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    // Create a helper function to prompt for user input with a message
    const prompt = (message: string): Promise<string> => {
      return new Promise((resolve) => {
        rl.question(message, (answer) => {
          resolve(answer);
        });
      });
    };

    // Step 4: Fetch expert_documents for these sources to get content
    console.log(`Fetching document contents...`);
    
    // Process each document
    let processed = 0;
    let updated = 0;
    
    for (let i = 0; i < documents.length; i++) {
      const document = documents[i];
      console.log(`\n[${i + 1}/${documents.length}] Document: ${document.name || 'Unnamed'}`);
      console.log(`ID: ${document.id}`);
      
      // Get the expert_document for this source
      const { data: expertDocs, error: expertError } = await supabase
        .from('google_expert_documents')
        .select('id, title, raw_content')
        .eq('source_id', document.id)
        .limit(1);
      
      // Get document content to review
      let content = 'No content available';
      let contentLength = 0;
      let totalLength = 0;
      let formattedContent = '';
      
      if (expertDocs && expertDocs.length > 0 && expertDocs[0].raw_content) {
        const previewLength = options.previewLength || 1550;
        totalLength = expertDocs[0].raw_content.length;
        content = expertDocs[0].raw_content.substring(0, previewLength);
        contentLength = content.length;
        
        // Format content for better readability
        // Add line breaks every 100 characters if they don't exist
        let lastLineBreak = 0;
        
        for (let i = 0; i < content.length; i++) {
          formattedContent += content[i];
          
          // Add line break if we haven't had one in 100 chars and we're at a space
          if (i - lastLineBreak > 100 && content[i] === ' ') {
            formattedContent += '\n';
            lastLineBreak = i;
          } else if (content[i] === '\n') {
            lastLineBreak = i;
          }
        }
      } else if (expertError) {
        console.error(`Error fetching content: ${expertError.message}`);
      }
      
      // Display the current document type
      const currentDocTypeInfo = docTypeMap.get(documentTypeId);
      console.log(`Current Type: ${currentDocTypeInfo?.name} (${currentDocTypeInfo?.category})`);
      
      // Display a list of available document type mnemonics first
      console.log('\nAvailable Document Type Mnemonics:');
      console.log('-'.repeat(80));
      
      // Group by category
      const categorizedTypes = new Map<string, { mnemonic: string, name: string, id: string }[]>();
      
      // Populate the categorized types
      for (const docType of allDocTypes || []) {
        if (docType.mnemonic) {
          const category = docType.category || 'Uncategorized';
          if (!categorizedTypes.has(category)) {
            categorizedTypes.set(category, []);
          }
          categorizedTypes.get(category)?.push({
            mnemonic: docType.mnemonic,
            name: docType.name,
            id: docType.id
          });
        }
      }
      
      // Display types by category - compact display with no empty lines
      for (const [category, types] of categorizedTypes.entries()) {
        console.log(`${category}:`);
        types.forEach(type => {
          console.log(`  ${type.mnemonic}: ${type.name}`);
        });
      }
      
      // Now display document content and info below the mnemonics
      console.log('\n' + '-'.repeat(80) + '\n');
      
      // Add document title if available
      if (expertDocs && expertDocs.length > 0 && expertDocs[0].title) {
        console.log(`Document Title: ${expertDocs[0].title}`);
      }
      
      // Display file info
      console.log(`File Name: ${document.name || 'Unnamed'}`);
      console.log(`Drive ID: ${document.drive_id || 'N/A'}`);
      
      if (contentLength > 0) {
        console.log(`\nContent Preview (${contentLength} of ${totalLength} characters):`);
        console.log('-'.repeat(80));
        console.log(formattedContent);
        console.log('-'.repeat(80));
      }
      
      // Prompt user for new document type
      const answer = await prompt('\nEnter 3-character mnemonic (or press Enter to skip): ');
      
      if (!answer || answer.trim() === '') {
        console.log('Skipping to next document');
        processed++;
        continue;
      }
      
      const mnemonic = answer.trim().toUpperCase();
      
      // Validate the mnemonic
      if (!mnemonicMap.has(mnemonic)) {
        console.log(`Invalid mnemonic: ${mnemonic}. Skipping to next document.`);
        processed++;
        continue;
      }
      
      // Get the document type ID for the mnemonic
      const newDocumentTypeId = mnemonicMap.get(mnemonic);
      const newDocTypeInfo = docTypeMap.get(newDocumentTypeId!);
      
      // Update the document_type_id in the sources_google table
      console.log(`Updating document type to: ${newDocTypeInfo?.name} (${newDocTypeInfo?.category})`);
      
      const { error: updateError } = await supabase
        .from('google_sources')
        .update({ document_type_id: newDocumentTypeId })
        .eq('id', document.id);
      
      if (updateError) {
        console.error(`Error updating document: ${updateError.message}`);
        processed++;
        continue;
      }
      
      console.log('✅ Document updated successfully');
      processed++;
      updated++;
    }
    
    rl.close();
    
    console.log(`\nCompleted processing ${processed} documents. Updated ${updated} documents.`);
    
    await commandTrackingService.completeTracking(trackingId, {
      recordsAffected: updated,
      summary: `Reviewed ${processed} documents with type "${options.name}". Updated ${updated} documents.`
    });
    
  } catch (error) {
    console.error('Error reviewing documents:', error instanceof Error ? error.message : String(error));
    await commandTrackingService.failTracking(trackingId, `Failed to review documents: ${error instanceof Error ? error.message : 'Unknown error'}`);
    process.exit(1);
  }
}

// Define command
const command = new Command('review-and-reclassify')
  .description('Review documents of a specific type and reclassify them using mnemonics')
  .requiredOption('--name <name>', 'Document type name to review')
  .option('--limit <number>', 'Limit the number of documents to review', parseInt)
  .option('--preview-length <number>', 'Number of characters to preview from document content', (val) => parseInt(val), 1550)
  .action(reviewAndReclassify);

export default command;