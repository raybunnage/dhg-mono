#!/usr/bin/env ts-node
/**
 * Script to check recently created expert documents
 */

import { program } from 'commander';
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// Load environment variables from .env files
const envFiles = ['.env', '.env.local', '.env.development'];
for (const envFile of envFiles) {
  const envPath = path.resolve(process.cwd(), envFile);
  if (fs.existsSync(envPath)) {
    console.log(`Loading environment variables from ${envPath}`);
    dotenv.config({ path: envPath });
  }
}

// Main function to check recently created expert documents
async function checkExpertDocs(
  limit: number,
  debug: boolean = false
): Promise<void> {
  try {
    // Get the Supabase client
    const supabase = SupabaseClientService.getInstance().getClient();
    
    console.log(`Checking ${limit} most recently created expert documents...`);
    
    // Query for the most recently created expert documents
    const { data: docs, error } = await supabase
      .from('google_expert_documents')
      .select(`
        id, 
        source_id, 
        document_type_id, 
        created_at,
        sources_google!inner(name, mime_type, drive_id)
      `)
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (error) {
      throw new Error(`Error fetching expert documents: ${error.message}`);
    }
    
    if (!docs || docs.length === 0) {
      console.log('No expert documents found.');
      return;
    }
    
    console.log(`Found ${docs.length} expert documents:`);
    console.log('-'.repeat(140));
    console.log('| Expert Doc ID                        | File Name                  | Google Drive ID              | Created At           |');
    console.log('-'.repeat(140));
    
    docs.forEach(doc => {
      const id = doc.id.substring(0, 36).padEnd(36);
      const name = (doc.sources_google?.name || 'Unknown').substring(0, 25).padEnd(25);
      const driveId = (doc.sources_google?.drive_id || 'Unknown').substring(0, 28).padEnd(28);
      const createdAt = new Date(doc.created_at).toISOString().substring(0, 19).replace('T', ' ');
      
      console.log(`| ${id} | ${name} | ${driveId} | ${createdAt} |`);
    });
    
    console.log('-'.repeat(140));
    
  } catch (error) {
    console.error(`Error checking expert documents: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Define CLI program
program
  .name('check-expert-docs')
  .description('Check recently created expert documents')
  .option('-l, --limit <number>', 'Limit the number of documents to check', '10')
  .option('-d, --debug', 'Enable debug logging', false)
  .action(async (options) => {
    try {
      const limit = parseInt(options.limit, 10);
      await checkExpertDocs(limit, options.debug);
    } catch (error) {
      console.error(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      process.exit(1);
    }
  });

// Run CLI if this module is executed directly
if (require.main === module) {
  program.parse();
}