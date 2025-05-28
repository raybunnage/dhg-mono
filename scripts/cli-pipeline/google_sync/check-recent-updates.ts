#!/usr/bin/env ts-node
/**
 * Script to check recently updated documents
 */

import { program } from 'commander';
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { Database } from '../../../supabase/types';

// Load environment variables from .env files
const envFiles = ['.env', '.env.local', '.env.development'];
for (const envFile of envFiles) {
  const envPath = path.resolve(process.cwd(), envFile);
  if (fs.existsSync(envPath)) {
    console.log(`Loading environment variables from ${envPath}`);
    dotenv.config({ path: envPath });
  }
}

// Main function to check recently updated documents
async function checkRecentUpdates(
  limit: number,
  debug: boolean = false
): Promise<void> {
  try {
    // Get the Supabase client
    const supabase = SupabaseClientService.getInstance().getClient();
    
    console.log(`Checking ${limit} most recently updated PDF files...`);
    
    // Query for the most recently updated PDF sources
    const { data: files, error } = await supabase
      .from('google_sources')
      .select(`
        id, 
        name, 
        document_type_id, 
        updated_at, 
        mime_type,
        created_at,
        modified_at
      `)
      .eq('mime_type', 'application/pdf')
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (error) {
      throw new Error(`Error fetching recently updated files: ${error.message}`);
    }
    
    if (!files || files.length === 0) {
      console.log('No recently updated files found.');
      return;
    }
    
    console.log(`Found ${files.length} recently updated files:`);
    console.log('-'.repeat(140));
    console.log('| ID                                   | Name                      | Document Type               | Created At           | Modified At          |');
    console.log('-'.repeat(140));
    
    files.forEach(file => {
      const id = file.id.substring(0, 36).padEnd(36);
      const name = (file.name || 'Unknown').substring(0, 25).padEnd(25);
      const docTypeId = file.document_type_id || 'Not classified';
      const docTypeDisplay = docTypeId.substring(0, 28).padEnd(28);
      const createdAt = new Date(file.created_at).toISOString().substring(0, 19).replace('T', ' ');
      const modifiedAt = new Date(file.modified_at).toISOString().substring(0, 19).replace('T', ' ');
      
      console.log(`| ${id} | ${name} | ${docTypeDisplay} | ${createdAt} | ${modifiedAt} |`);
    });
    
    console.log('-'.repeat(140));
    
    // Now check expert_documents for these files
    console.log('\nChecking expert_documents for these files...');
    
    const fileIds = files.map(f => f.id);
    
    const { data: expertDocs, error: expertError } = await supabase
      .from('expert_documents')
      .select(`
        id, 
        source_id, 
        created_at, 
        document_type_id
      `)
      .in('source_id', fileIds)
      .order('created_at', { ascending: false });
    
    if (expertError) {
      throw new Error(`Error fetching expert documents: ${expertError.message}`);
    }
    
    if (!expertDocs || expertDocs.length === 0) {
      console.log('No expert documents found for these files.');
      return;
    }
    
    console.log(`Found ${expertDocs.length} expert documents:`);
    console.log('-'.repeat(110));
    console.log('| Expert Doc ID                        | Source ID                 | Document Type               | Created At           |');
    console.log('-'.repeat(110));
    
    expertDocs.forEach(doc => {
      const id = doc.id.substring(0, 36).padEnd(36);
      const sourceId = doc.source_id.substring(0, 25).padEnd(25);
      const docTypeId = doc.document_type_id || 'Unknown';
      const docTypeDisplay = docTypeId.substring(0, 28).padEnd(28);
      const createdAt = new Date(doc.created_at).toISOString().substring(0, 19).replace('T', ' ');
      
      console.log(`| ${id} | ${sourceId} | ${docTypeDisplay} | ${createdAt} |`);
    });
    
    console.log('-'.repeat(110));
    
  } catch (error) {
    console.error(`Error checking recent updates: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Define CLI program
program
  .name('check-recent-updates')
  .description('Check recently updated Google Drive files')
  .option('-l, --limit <number>', 'Limit the number of files to check', '10')
  .option('-d, --debug', 'Enable debug logging', false)
  .action(async (options) => {
    try {
      const limit = parseInt(options.limit, 10);
      await checkRecentUpdates(limit, options.debug);
    } catch (error) {
      console.error(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      process.exit(1);
    }
  });

// Run CLI if this module is executed directly
if (require.main === module) {
  program.parse();
}