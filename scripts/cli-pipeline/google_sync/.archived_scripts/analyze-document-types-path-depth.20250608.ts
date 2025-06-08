#!/usr/bin/env ts-node
/**
 * Analyze Document Types by Path Depth
 * 
 * This script analyzes the relationship between document types and path_depth
 * to explain the discrepancy between the total folders with document_type_id
 * and the number of folders with path_depth=0.
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

// Load environment variables
const envFiles = ['.env', '.env.development', '.env.local'];
for (const file of envFiles) {
  const filePath = path.resolve(process.cwd(), file);
  if (fs.existsSync(filePath)) {
    console.log(`Loading environment variables from ${filePath}`);
    dotenv.config({ path: filePath });
  }
}

interface CountResult {
  count: number;
}

interface PathDepthCount {
  path_depth: number;
  count: string;
}

interface DocTypePathDepthCount {
  document_types: {
    name: string;
  };
  path_depth: number;
  count: string;
}

interface FolderExample {
  id: string;
  name: string;
  path: string;
  path_depth: number;
  document_types: {
    name: string;
  };
}

async function analyzeDocumentTypesByPathDepth(): Promise<void> {
  console.log('=== Analyzing Document Types by Path Depth ===');
  
  // Initialize Supabase client
  const supabase = SupabaseClientService.getInstance().getClient();
  
  try {
    // 1. Count total folders with document_type_id
    const { data: totalCountData, error: totalError } = await supabase
      .from('google_sources')
      .select('count', { count: 'exact', head: true })
      .eq('is_deleted', false)
      .eq('mime_type', 'application/vnd.google-apps.folder')
      .not('document_type_id', 'is', null);
      
    if (totalError) {
      console.error('Error counting folders with document_type_id:', totalError.message);
      return;
    }
    
    const totalCount = totalCountData as unknown as CountResult;
    console.log(`Total folders with document_type_id: ${totalCount.count}`);
    
    // 2. Count folders with document_type_id and path_depth = 0
    const { data: zeroDepthCountData, error: zeroDepthError } = await supabase
      .from('google_sources')
      .select('count', { count: 'exact', head: true })
      .eq('is_deleted', false)
      .eq('mime_type', 'application/vnd.google-apps.folder')
      .not('document_type_id', 'is', null)
      .eq('path_depth', 0);
      
    if (zeroDepthError) {
      console.error('Error counting path_depth=0 folders:', zeroDepthError.message);
      return;
    }
    
    const zeroDepthCount = zeroDepthCountData as unknown as CountResult;
    console.log(`Folders with document_type_id and path_depth=0: ${zeroDepthCount.count}`);
    
    // 3. Count folders with document_type_id by path_depth using raw SQL
    const { data: pathDepthCounts, error: pathDepthError } = await supabase
      .rpc('count_folders_by_path_depth');
      
    if (pathDepthError) {
      console.error('Error counting by path_depth:', pathDepthError.message);
      return;
    }
    
    console.log('\nBreakdown by path_depth:');
    console.log('----------------------');
    
    if (pathDepthCounts && Array.isArray(pathDepthCounts)) {
      (pathDepthCounts as PathDepthCount[]).forEach((item: PathDepthCount) => {
        console.log(`path_depth=${item.path_depth}: ${item.count} folders`);
      });
    }
    
    // 4. Count by document_type grouped by path_depth using raw SQL
    const { data: docTypeDepthCounts, error: docTypeDepthError } = await supabase
      .rpc('count_folders_by_document_type_and_path_depth');
      
    if (docTypeDepthError) {
      console.error('Error counting by document_type and path_depth:', docTypeDepthError.message);
      return;
    }
    
    console.log('\nBreakdown by document_type and path_depth:');
    console.log('---------------------------------------');
    
    if (docTypeDepthCounts && Array.isArray(docTypeDepthCounts)) {
      // Group by document type for better readability
      const groupedByDocType = (docTypeDepthCounts as DocTypePathDepthCount[]).reduce(
        (acc: Record<string, { path_depth: number, count: string }[]>, item: DocTypePathDepthCount) => {
          const docType = item.document_types?.name || 'unknown';
          if (!acc[docType]) {
            acc[docType] = [];
          }
          acc[docType].push({
            path_depth: item.path_depth,
            count: item.count
          });
          return acc;
        }, {});
      
      // Print grouped by document type
      for (const [docType, depths] of Object.entries(groupedByDocType)) {
        console.log(`\n${docType}:`);
        let totalForDocType = 0;
        
        depths.forEach((item: { path_depth: number, count: string }) => {
          console.log(`  path_depth=${item.path_depth}: ${item.count} folders`);
          totalForDocType += parseInt(item.count);
        });
        
        console.log(`  Total for "${docType}": ${totalForDocType} folders`);
      }
    }
    
    // 5. Get some examples of folders with path_depth > 0
    console.log('\nExamples of folders with document_type_id and path_depth > 0:');
    console.log('----------------------------------------------------------');
    
    const { data: examples, error: examplesError } = await supabase
      .from('google_sources')
      .select('id, name, path, path_depth, document_types!inner(name)')
      .eq('is_deleted', false)
      .eq('mime_type', 'application/vnd.google-apps.folder')
      .not('document_type_id', 'is', null)
      .gt('path_depth', 0)
      .order('path_depth')
      .limit(10);
      
    if (examplesError) {
      console.error('Error getting examples:', examplesError.message);
      return;
    }
    
    if (examples && examples.length > 0) {
      (examples as FolderExample[]).forEach((folder: FolderExample, index: number) => {
        console.log(`${index + 1}. "${folder.name}" (path_depth=${folder.path_depth})`);
        console.log(`   Path: ${folder.path}`);
        console.log(`   Document Type: ${folder.document_types.name || 'unknown'}`);
        console.log('');
      });
    } else {
      console.log('No examples found.');
    }
    
    // 6. SQL query similar to what was mentioned in the question
    console.log('\nRunning SQL query to count document types:');
    console.log('-------------------------------------');
    
    const { data: docTypeCounts, error: docTypeCountsError } = await supabase.rpc('count_document_types');
    
    if (docTypeCountsError) {
      console.error('Error running document type count query:', docTypeCountsError.message);
      return;
    }
    
    if (docTypeCounts) {
      console.log(docTypeCounts);
    }
    
    console.log('=== Analysis Complete ===');
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

// Create stored procedures in Supabase (one-time setup)
async function createStoredProcedures(): Promise<void> {
  const supabase = SupabaseClientService.getInstance().getClient();
  
  // 1. Create path_depth counting function
  await supabase.rpc('create_count_by_path_depth_function');
  
  // 2. Create document_type and path_depth counting function
  await supabase.rpc('create_count_by_document_type_and_path_depth_function');
  
  // 3. Create function similar to the SQL query in the question
  await supabase.rpc('create_count_document_types_function');
}

// Only uncomment and run the line below if you need to set up the stored procedures
// createStoredProcedures();

// Run the analysis
analyzeDocumentTypesByPathDepth();