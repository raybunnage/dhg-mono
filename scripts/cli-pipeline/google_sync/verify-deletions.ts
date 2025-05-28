#!/usr/bin/env ts-node
/**
 * Verify and manage file deletions with safety checks
 * 
 * This command provides a safer approach to handling deletions:
 * - Verifies files marked for deletion actually don't exist
 * - Provides detailed reports before deletion
 * - Allows selective deletion with safety thresholds
 * - Can restore files incorrectly marked as deleted
 * 
 * Usage:
 *   ts-node verify-deletions.ts [options]
 * 
 * Options:
 *   --dry-run          Show what would be done without making changes
 *   --limit <n>        Limit files to check (default: 100)
 *   --verbose          Show detailed logs
 *   --restore          Restore files that still exist (unmark as deleted)
 *   --force            Skip safety checks (use with caution)
 */

import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
import { getGoogleDriveService, GoogleDriveService } from '../../../packages/shared/services/google-drive';
import type { Database } from '../../../supabase/types';
import { getActiveFilterProfile } from './get-active-filter-profile';
import { displayActiveFilter } from './display-active-filter';

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
const doRestore = args.includes('--restore');
const forceDelete = args.includes('--force');

const limitIndex = args.indexOf('--limit');
const limit = limitIndex !== -1 && args[limitIndex + 1] 
  ? parseInt(args[limitIndex + 1], 10) 
  : 100;

// Create Supabase client
const supabaseClientService = SupabaseClientService.getInstance();
const supabase = supabaseClientService.getClient();

interface VerificationResult {
  filesChecked: number;
  filesDeleted: number;
  filesRestored: number;
  filesStillExist: number;
  filesNotFound: number;
  verificationErrors: number;
  errors: string[];
  duration: number;
}

interface FileVerification {
  record: any;
  exists: boolean;
  error?: string;
}

/**
 * Verify a batch of files in Google Drive
 */
async function verifyFileBatch(
  driveService: GoogleDriveService,
  files: any[]
): Promise<FileVerification[]> {
  const verificationPromises = files.map(async (record) => {
    try {
      // Try to get file from Google Drive
      await driveService.getFile(record.drive_id, 'id,name');
      return { record, exists: true };
    } catch (error: any) {
      if (error.code === 404 || error.message?.includes('File not found')) {
        return { record, exists: false };
      }
      // Other errors (network, permissions, etc.)
      return { record, exists: false, error: error.message || 'Unknown error' };
    }
  });
  
  return Promise.all(verificationPromises);
}

/**
 * Verify and manage deletions
 */
async function verifyDeletions(
  driveService: GoogleDriveService,
  rootDriveId?: string
): Promise<VerificationResult> {
  const startTime = Date.now();
  const result: VerificationResult = {
    filesChecked: 0,
    filesDeleted: 0,
    filesRestored: 0,
    filesStillExist: 0,
    filesNotFound: 0,
    verificationErrors: 0,
    errors: [],
    duration: 0
  };
  
  try {
    // Build query for deleted files
    let query = supabase
      .from('google_sources')
      .select('id, drive_id, name, path, deleted_at')
      .eq('is_deleted', true)
      .order('updated_at', { ascending: false })
      .limit(limit);
    
    // Apply root drive filter if provided
    if (rootDriveId) {
      query = query.eq('root_drive_id', rootDriveId);
    }
    
    const { data: deletedFiles, error: queryError } = await query;
    
    if (queryError) throw queryError;
    
    if (!deletedFiles || deletedFiles.length === 0) {
      console.log('✓ No deleted files to verify');
      result.duration = (Date.now() - startTime) / 1000;
      return result;
    }
    
    console.log(`🔍 Found ${deletedFiles.length} deleted files to verify`);
    
    // Process in batches for efficiency
    const BATCH_SIZE = 10;
    const batches = Math.ceil(deletedFiles.length / BATCH_SIZE);
    
    const verifiedNotExisting: any[] = [];
    const verifiedStillExisting: any[] = [];
    const verificationErrors: any[] = [];
    
    for (let i = 0; i < batches; i++) {
      const start = i * BATCH_SIZE;
      const end = Math.min(start + BATCH_SIZE, deletedFiles.length);
      const batch = deletedFiles.slice(start, end);
      
      console.log(`Verifying batch ${i + 1}/${batches} (${batch.length} files)`);
      
      const verificationResults = await verifyFileBatch(driveService, batch);
      
      // Sort results
      for (const verificationResult of verificationResults) {
        result.filesChecked++;
        
        if (verificationResult.error) {
          verificationErrors.push(verificationResult.record);
          result.verificationErrors++;
          if (isVerbose) {
            console.log(`  ⚠ Error verifying ${verificationResult.record.name}: ${verificationResult.error}`);
          }
        } else if (verificationResult.exists) {
          verifiedStillExisting.push(verificationResult.record);
          result.filesStillExist++;
          if (isVerbose) {
            console.log(`  ✓ Still exists: ${verificationResult.record.name}`);
          }
        } else {
          verifiedNotExisting.push(verificationResult.record);
          result.filesNotFound++;
          if (isVerbose) {
            console.log(`  ✗ Confirmed deleted: ${verificationResult.record.name}`);
          }
        }
      }
    }
    
    // Display verification summary
    console.log('\n=== Verification Summary ===');
    console.log(`Files confirmed deleted: ${verifiedNotExisting.length}`);
    console.log(`Files that still exist: ${verifiedStillExisting.length}`);
    console.log(`Verification errors: ${verificationErrors.length}`);
    
    // Safety check
    const errorRate = verificationErrors.length / (deletedFiles.length || 1);
    const stillExistRate = verifiedStillExisting.length / (deletedFiles.length || 1);
    
    if (!forceDelete && (errorRate > 0.2 || stillExistRate > 0.3)) {
      console.log('\n⚠️  SAFETY CHECK FAILED ⚠️');
      console.log(`Error rate: ${(errorRate * 100).toFixed(1)}% (threshold: 20%)`);
      console.log(`Still exist rate: ${(stillExistRate * 100).toFixed(1)}% (threshold: 30%)`);
      console.log('\nAborting operation. Use --force to override safety checks.');
      
      result.errors.push('Safety check failed - too many errors or existing files');
      result.duration = (Date.now() - startTime) / 1000;
      return result;
    }
    
    // Handle restorations
    if (doRestore && verifiedStillExisting.length > 0) {
      console.log(`\n📥 Restoring ${verifiedStillExisting.length} files that still exist...`);
      
      if (!isDryRun) {
        const idsToRestore = verifiedStillExisting.map(r => r.id);
        const { error: restoreError } = await supabase
          .from('google_sources')
          .update({
            is_deleted: false,
            updated_at: new Date().toISOString()
          })
          .in('id', idsToRestore);
        
        if (restoreError) {
          result.errors.push(`Restore error: ${restoreError.message}`);
        } else {
          result.filesRestored = verifiedStillExisting.length;
          console.log(`✓ Restored ${verifiedStillExisting.length} files`);
        }
      } else {
        console.log(`[DRY RUN] Would restore ${verifiedStillExisting.length} files`);
        result.filesRestored = verifiedStillExisting.length;
      }
    }
    
    // Permanent deletion (only for verified non-existing files)
    if (verifiedNotExisting.length > 0) {
      console.log(`\n🗑️  ${verifiedNotExisting.length} files confirmed for permanent deletion`);
      
      if (!isDryRun) {
        // Here you could implement permanent deletion from the database
        // For now, we just report what would be deleted
        console.log('Files remain marked as deleted in the database');
        result.filesDeleted = verifiedNotExisting.length;
      } else {
        console.log('[DRY RUN] These files would remain marked as deleted');
        result.filesDeleted = verifiedNotExisting.length;
      }
    }
    
    // Generate detailed report
    if (isVerbose && verifiedStillExisting.length > 0) {
      console.log('\n📋 Files that still exist:');
      verifiedStillExisting.slice(0, 10).forEach((file, idx) => {
        console.log(`${idx + 1}. ${file.name} (${file.drive_id})`);
        if (file.path) console.log(`   Path: ${file.path}`);
      });
      if (verifiedStillExisting.length > 10) {
        console.log(`... and ${verifiedStillExisting.length - 10} more files`);
      }
    }
    
  } catch (error: any) {
    console.error('❌ Verification error:', error.message);
    result.errors.push(error.message);
  }
  
  result.duration = (Date.now() - startTime) / 1000;
  return result;
}

/**
 * Main execution
 */
async function main() {
  console.log('=== Verify Deletions ===');
  console.log(`Mode: ${isDryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log(`Action: ${doRestore ? 'RESTORE' : 'VERIFY'}`);
  console.log(`Limit: ${limit} files`);
  console.log(`Force: ${forceDelete}`);
  console.log('========================\n');
  
  try {
    // Display active filter prominently
    const activeFilter = await displayActiveFilter();
    let rootDriveId: string | undefined;
    
    if (activeFilter && activeFilter.rootDriveId) {
      rootDriveId = activeFilter.rootDriveId;
    }
    
    // Initialize Google Drive service
    const driveService = getGoogleDriveService(supabase);
    
    // Verify deletions
    const result = await verifyDeletions(driveService, rootDriveId);
    
    // Display results
    console.log('\n=== Verification Complete ===');
    console.log(`✓ Files checked: ${result.filesChecked}`);
    console.log(`✓ Files confirmed deleted: ${result.filesNotFound}`);
    console.log(`✓ Files still exist: ${result.filesStillExist}`);
    console.log(`✓ Files restored: ${result.filesRestored}`);
    console.log(`✓ Verification errors: ${result.verificationErrors}`);
    console.log(`✓ Duration: ${result.duration.toFixed(1)}s`);
    
    if (result.errors.length > 0) {
      console.log('\n❌ Errors:');
      result.errors.forEach(err => console.log(`  - ${err}`));
    }
    
    if (result.filesStillExist > 0 && !doRestore) {
      console.log('\n💡 Tip: Use --restore flag to unmark files that still exist');
    }
    
    process.exit(result.errors.length > 0 ? 1 : 0);
    
  } catch (error: any) {
    console.error('❌ Fatal error:', error.message);
    process.exit(1);
  }
}

// Export for use as module
export { verifyDeletions };

// Run if called directly
if (require.main === module) {
  main();
}