#!/usr/bin/env ts-node

/**
 * Auto-classification script for documents
 * Automatically classifies untyped documents and updates their tags
 */

import * as path from 'path';
import * as fs from 'fs';
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
import { documentClassifier } from '../../../packages/shared/services/prompt-service/prompt-service';
import { Database } from '../../../supabase/types';

const supabase = SupabaseClientService.getInstance().getClient();

async function extractTagsFromContent(content: string): Promise<string[]> {
  const tags: string[] = [];
  
  // Extract tags based on content patterns
  if (content.includes('## Implementation')) tags.push('implementation');
  if (content.includes('## API') || content.includes('## Interface')) tags.push('api');
  if (content.includes('## Database')) tags.push('database');
  if (content.includes('## Architecture')) tags.push('architecture');
  if (content.includes('## Configuration')) tags.push('configuration');
  if (content.includes('## Testing')) tags.push('testing');
  if (content.includes('## Migration')) tags.push('migration');
  if (content.includes('## Deployment')) tags.push('deployment');
  
  // Add tags based on file path
  if (content.includes('claude') || content.includes('Claude')) tags.push('ai');
  if (content.includes('supabase') || content.includes('Supabase')) tags.push('database');
  if (content.includes('CLI') || content.includes('cli')) tags.push('cli');
  
  // Remove duplicates
  return [...new Set(tags)];
}

async function classifyAllUntyped() {
  console.log('🤖 Starting automatic document classification...\n');
  
  try {
    // Get all untyped documents
    const { data: untypedDocs, error: fetchError } = await supabase
      .from('doc_files')
      .select('*')
      .is('document_type_id', null)
      .order('updated_at', { ascending: false });
    
    if (fetchError) throw fetchError;
    
    if (!untypedDocs || untypedDocs.length === 0) {
      console.log('✅ No untyped documents found. All documents are classified!');
      return;
    }
    
    console.log(`Found ${untypedDocs.length} untyped documents to classify.\n`);
    
    // Get document types
    const { data: docTypes } = await supabase
      .from('document_types')
      .select('*')
      .eq('is_general_type', false);
    
    if (!docTypes) {
      console.error('❌ Could not fetch document types');
      return;
    }
    
    const rootDir = path.resolve(__dirname, '../../..');
    let successCount = 0;
    let errorCount = 0;
    
    // Process in batches of 5
    const batchSize = 5;
    for (let i = 0; i < untypedDocs.length; i += batchSize) {
      const batch = untypedDocs.slice(i, i + batchSize);
      
      console.log(`\nProcessing batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(untypedDocs.length / batchSize)}...`);
      
      await Promise.all(batch.map(async (doc) => {
        try {
          const fullPath = path.join(rootDir, doc.file_path);
          
          if (!fs.existsSync(fullPath)) {
            console.log(`⚠️  File not found: ${doc.file_path}`);
            return;
          }
          
          const content = fs.readFileSync(fullPath, 'utf-8');
          
          // Classify the document
          const result = await documentClassifier.classifyDocument({
            title: doc.title,
            content: content.substring(0, 3000),
            filePath: doc.file_path,
            documentTypes: docTypes
          });
          
          if (result && result.document_type_id) {
            // Extract tags from content
            const tags = await extractTagsFromContent(content);
            
            // Update the document
            const { error: updateError } = await supabase
              .from('doc_files')
              .update({
                document_type_id: result.document_type_id,
                tags,
                updated_at: new Date().toISOString()
              })
              .eq('id', doc.id);
            
            if (!updateError) {
              console.log(`✅ ${doc.file_path}`);
              console.log(`   Type: ${result.document_type} (confidence: ${result.confidence})`);
              if (tags.length > 0) {
                console.log(`   Tags: ${tags.join(', ')}`);
              }
              successCount++;
            } else {
              console.error(`❌ Failed to update ${doc.file_path}:`, updateError.message);
              errorCount++;
            }
          } else {
            console.log(`⚠️  Could not classify: ${doc.file_path}`);
            if (!result) {
              console.log(`   Reason: No result returned from classifier`);
            } else {
              console.log(`   Reason: No document_type_id in result`);
            }
            errorCount++;
          }
        } catch (error) {
          console.error(`❌ Error processing ${doc.file_path}:`, error);
          errorCount++;
        }
      }));
      
      // Add a small delay between batches to avoid rate limiting
      if (i + batchSize < untypedDocs.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    console.log('\n' + '='.repeat(50));
    console.log(`Classification complete!`);
    console.log(`✅ Successfully classified: ${successCount} documents`);
    console.log(`❌ Errors: ${errorCount} documents`);
    
  } catch (error) {
    console.error('❌ Fatal error during classification:', error);
    process.exit(1);
  }
}

// Run the classification
classifyAllUntyped();