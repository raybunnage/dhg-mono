#!/usr/bin/env ts-node
/**
 * Orchestration command that runs all sync steps
 * 
 * This command runs the complete sync pipeline:
 * 1. sync-files - Sync file existence
 * 2. process-new-files - Create expert_documents
 * 3. update-metadata - Update file metadata
 * 
 * Usage:
 *   ts-node sync-all.ts [options]
 * 
 * Options:
 *   --dry-run          Show what would be done without making changes
 *   --limit <n>        Limit for metadata updates (default: 100)
 *   --max-depth <n>    Maximum folder depth (default: 6)
 *   --verbose          Show detailed logs
 *   --skip-metadata    Skip the metadata update step
 */

import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { getActiveFilterProfile } from './get-active-filter-profile';
import { syncFiles } from './sync-files';
import { processNewFiles } from './process-new-files';
import { updateMetadata as updateMetadataFunc } from './update-metadata';
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
import { getGoogleDriveService } from '../../../packages/shared/services/google-drive';

// Load environment files
function loadEnvFiles() {
  const envFiles = ['.env', '.env.local', '.env.development'];
  
  for (const file of envFiles) {
    const filePath = path.resolve(process.cwd(), file);
    if (fs.existsSync(filePath)) {
      console.log(`Loading environment variables from ${file}`);
      dotenv.config({ path: filePath });
    }
  }
}

loadEnvFiles();

// Parse command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const isVerbose = args.includes('--verbose');
const skipMetadata = args.includes('--skip-metadata');

const limitIndex = args.indexOf('--limit');
const limit = limitIndex !== -1 && args[limitIndex + 1] 
  ? parseInt(args[limitIndex + 1], 10) 
  : 100;

const maxDepthIndex = args.indexOf('--max-depth');
const maxDepth = maxDepthIndex !== -1 && args[maxDepthIndex + 1] 
  ? parseInt(args[maxDepthIndex + 1], 10) 
  : 6;

// Default folder ID
const DYNAMIC_HEALING_FOLDER_ID = '1wriOM2j2IglnMcejplqG_XcCxSIfoRMV';

// Create Supabase client
const supabaseClientService = SupabaseClientService.getInstance();
const supabase = supabaseClientService.getClient();

interface SyncAllResult {
  syncResult?: any;
  processResult?: any;
  metadataResult?: any;
  totalDuration: number;
  success: boolean;
  errors: string[];
}

/**
 * Generate sync report
 */
async function generateSyncReport(
  rootDriveId: string,
  result: SyncAllResult
): Promise<void> {
  if (isDryRun) return;
  
  try {
    const reportDate = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
    const reportFilePath = `${process.cwd()}/docs/script-reports/sync-report-${reportDate}.md`;
    
    // Ensure directory exists
    const reportDir = path.dirname(reportFilePath);
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }
    
    // Build report content
    let reportContent = `# Google Drive Sync Report - ${new Date().toLocaleString()}\n\n`;
    
    // Summary section
    reportContent += `## Summary\n\n`;
    reportContent += `- Root Drive ID: ${rootDriveId}\n`;
    reportContent += `- Total Duration: ${result.totalDuration.toFixed(1)}s\n`;
    reportContent += `- Success: ${result.success ? 'Yes' : 'No'}\n\n`;
    
    // Sync phase results
    if (result.syncResult) {
      reportContent += `### File Sync Results\n`;
      reportContent += `- Files found: ${result.syncResult.filesFound}\n`;
      reportContent += `- Files inserted: ${result.syncResult.filesInserted}\n`;
      reportContent += `- Files marked deleted: ${result.syncResult.filesMarkedDeleted}\n`;
      reportContent += `- Duration: ${result.syncResult.duration.toFixed(1)}s\n\n`;
    }
    
    // Process phase results
    if (result.processResult) {
      reportContent += `### Processing Results\n`;
      reportContent += `- Files processed: ${result.processResult.filesProcessed}\n`;
      reportContent += `- Expert docs created: ${result.processResult.expertDocsCreated}\n`;
      reportContent += `- Duration: ${result.processResult.duration.toFixed(1)}s\n\n`;
    }
    
    // Metadata phase results
    if (result.metadataResult) {
      reportContent += `### Metadata Update Results\n`;
      reportContent += `- Files checked: ${result.metadataResult.filesChecked}\n`;
      reportContent += `- Files updated: ${result.metadataResult.filesUpdated}\n`;
      reportContent += `- Files renamed: ${result.metadataResult.filesRenamed}\n`;
      reportContent += `- Duration: ${result.metadataResult.duration.toFixed(1)}s\n\n`;
    }
    
    // Errors section
    if (result.errors.length > 0) {
      reportContent += `## Errors\n\n`;
      result.errors.forEach(err => {
        reportContent += `- ${err}\n`;
      });
      reportContent += '\n';
    }
    
    // Files needing attention
    if (result.syncResult?.filesInserted > 0) {
      reportContent += `## Files Needing Classification\n\n`;
      
      // Query for recently added files
      const { data: newFiles } = await supabase
        .from('sources_google')
        .select('name, mime_type, created_at')
        .eq('root_drive_id', rootDriveId)
        .eq('processing_status', 'queued')
        .order('created_at', { ascending: false })
        .limit(20);
      
      if (newFiles && newFiles.length > 0) {
        reportContent += `| File | Type | Added |\n`;
        reportContent += `|------|------|-------|\n`;
        
        newFiles.forEach(file => {
          const fileType = file.mime_type?.split('/').pop() || 'unknown';
          const added = new Date(file.created_at).toLocaleString();
          reportContent += `| ${file.name} | ${fileType} | ${added} |\n`;
        });
        
        if (result.syncResult.filesInserted > 20) {
          reportContent += `\n*...and ${result.syncResult.filesInserted - 20} more files*\n`;
        }
      }
    }
    
    // Write report
    fs.writeFileSync(reportFilePath, reportContent);
    console.log(`\n📄 Report saved: ${reportFilePath}`);
    
  } catch (error: any) {
    console.error('⚠️  Could not generate report:', error.message);
  }
}

/**
 * Main sync orchestration
 */
async function syncAll(): Promise<SyncAllResult> {
  const startTime = Date.now();
  const result: SyncAllResult = {
    totalDuration: 0,
    success: true,
    errors: []
  };
  
  try {
    // Check for active filter profile
    const activeFilter = await getActiveFilterProfile();
    let rootDriveId = DYNAMIC_HEALING_FOLDER_ID;
    
    if (activeFilter && activeFilter.rootDriveId) {
      console.log(`🔍 Active filter: "${activeFilter.profile.name}"`);
      console.log(`📁 Using root_drive_id: ${activeFilter.rootDriveId}\n`);
      rootDriveId = activeFilter.rootDriveId;
    }
    
    // Initialize Google Drive service
    const driveService = getGoogleDriveService(supabase);
    
    // Step 1: Sync files
    console.log('=== Step 1: Sync Files ===');
    try {
      // Set global variables for sync-files module
      (global as any).isDryRun = isDryRun;
      (global as any).isVerbose = isVerbose;
      (global as any).maxDepth = maxDepth;
      
      result.syncResult = await syncFiles(driveService, rootDriveId);
      console.log(`✓ Sync completed in ${result.syncResult.duration.toFixed(1)}s\n`);
    } catch (error: any) {
      console.error('❌ Sync failed:', error.message);
      result.errors.push(`Sync error: ${error.message}`);
      result.success = false;
    }
    
    // Step 2: Process new files
    if (result.syncResult?.filesInserted > 0) {
      console.log('=== Step 2: Process New Files ===');
      try {
        // Set global variables for process-new-files module
        (global as any).isDryRun = isDryRun;
        (global as any).isVerbose = isVerbose;
        
        result.processResult = await processNewFiles(rootDriveId);
        console.log(`✓ Processing completed in ${result.processResult.duration.toFixed(1)}s\n`);
      } catch (error: any) {
        console.error('❌ Processing failed:', error.message);
        result.errors.push(`Processing error: ${error.message}`);
        result.success = false;
      }
    } else {
      console.log('=== Step 2: Process New Files ===');
      console.log('✓ No new files to process\n');
    }
    
    // Step 3: Update metadata (unless skipped)
    if (!skipMetadata) {
      console.log('=== Step 3: Update Metadata ===');
      try {
        // Set global variables for update-metadata module
        (global as any).isDryRun = isDryRun;
        (global as any).isVerbose = isVerbose;
        (global as any).limit = limit;
        
        result.metadataResult = await updateMetadataFunc(driveService, rootDriveId);
        console.log(`✓ Metadata update completed in ${result.metadataResult.duration.toFixed(1)}s\n`);
      } catch (error: any) {
        console.error('❌ Metadata update failed:', error.message);
        result.errors.push(`Metadata error: ${error.message}`);
        result.success = false;
      }
    } else {
      console.log('=== Step 3: Update Metadata ===');
      console.log('✓ Skipped (--skip-metadata flag)\n');
    }
    
    result.totalDuration = (Date.now() - startTime) / 1000;
    
    // Generate report
    await generateSyncReport(rootDriveId, result);
    
    return result;
    
  } catch (error: any) {
    console.error('❌ Fatal error:', error.message);
    result.errors.push(`Fatal error: ${error.message}`);
    result.success = false;
    result.totalDuration = (Date.now() - startTime) / 1000;
    return result;
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('=== Google Drive Sync All ===');
  console.log(`Mode: ${isDryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log(`Max depth: ${maxDepth}`);
  console.log(`Metadata limit: ${limit}`);
  console.log(`Skip metadata: ${skipMetadata}`);
  console.log('=============================\n');
  
  const result = await syncAll();
  
  // Display final summary
  console.log('=== Final Summary ===');
  console.log(`✓ Total duration: ${result.totalDuration.toFixed(1)}s`);
  console.log(`✓ Success: ${result.success ? 'Yes' : 'No'}`);
  
  if (result.errors.length > 0) {
    console.log(`\n❌ Errors (${result.errors.length}):`);
    result.errors.forEach(err => console.log(`  - ${err}`));
  }
  
  // Provide next steps
  if (result.success && result.processResult?.expertDocsCreated > 0) {
    console.log('\n💡 Next steps:');
    console.log('  - Run classify-docs-service for .docx/.txt files');
    console.log('  - Run classify-pdfs for PDF files');
    console.log('  - Run classify-powerpoints for PowerPoint files');
  }
  
  process.exit(result.success ? 0 : 1);
}

// Export for use as module
export { syncAll };

// Run if called directly
if (require.main === module) {
  main();
}