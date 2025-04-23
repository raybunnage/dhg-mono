#!/usr/bin/env ts-node
/**
 * Expert Documents Purge Tool
 * 
 * This script identifies and resolves issues with expert_documents records:
 * 
 * 1. Duplicate records with the same source_id, with options to:
 *    - Keep the newest record (default)
 *    - Keep a specific record type (by document_type_id)
 *    - Keep records with a specific status
 * 
 * 2. Orphaned records with one of the following issues:
 *    - Null source_id
 *    - Invalid source_id (no matching sources_google record exists)
 * 
 * The purge operation can be run in dry-run mode to preview changes
 * before actually modifying the database.
 * 
 * Usage:
 *   ts-node expert-documents-purge.ts [options]
 * 
 * Options:
 *   --dry-run             Show what would be done without making changes
 *   --limit <n>           Limit the number of duplicate sets to process (default: 50)
 *   --strategy <n>        Resolution strategy: newest, specific-type, or specific-status (default: newest)
 *   --type-id <uuid>      When using specific-type strategy, the document_type_id to keep
 *   --status <status>     When using specific-status strategy, the status to keep (e.g., 'reprocessing_done')
 *   --orphaned            Purge orphaned records (null source_id or non-existent sources_google record)
 *   --orphaned-limit <n>  Limit for orphaned records to process (default: 100)
 *   --verbose             Show detailed information during processing
 */

import { Command } from 'commander';
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
import { commandTrackingService } from '../../../packages/shared/services/tracking-service/command-tracking-service';
import { findDuplicateExpertDocuments } from './expert-documents-duplicates';

// Import the full DuplicateGroup interface would also be ideal, but for now just define
// the needed interfaces with created_at included
interface ExpertDocumentWithSource {
  id: string;
  source_id: string;
  document_type_id: string | null;
  document_processing_status: string | null;
  source_name: string | null;
  document_type_name?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

// Helper function to get creation time as a number (for sorting)
function getCreationTime(doc: ExpertDocumentWithSource): number {
  return doc.created_at ? new Date(doc.created_at).getTime() : 0;
}

interface PurgeOptions {
  dryRun?: boolean;
  limit?: number;
  strategy?: 'newest' | 'specific-type' | 'specific-status';
  typeId?: string;
  status?: string;
  verbose?: boolean;
  orphaned?: boolean;
  orphanedLimit?: number;
}

interface PurgeResult {
  totalGroups: number;
  groupsProcessed: number;
  recordsDeleted: number;
  recordsKept: number;
  orphanedRecordsFound?: number;
  orphanedRecordsDeleted?: number;
  errors: string[];
}

/**
 * Process duplicate expert documents according to the selected strategy
 */
async function purgeExpertDocumentDuplicates(options: PurgeOptions = {}): Promise<PurgeResult> {
  console.log('=== Purging Duplicate Expert Documents ===');
  
  const isDryRun = options.dryRun !== undefined ? options.dryRun : false;
  const strategy = options.strategy || 'newest';
  const limit = options.limit || 50;
  const verbose = options.verbose || false;
  
  console.log(`Mode: ${isDryRun ? 'DRY RUN' : 'ACTUAL PURGE'}`);
  console.log(`Strategy: ${strategy}`);
  console.log(`Limit: ${limit} duplicate sets`);
  console.log(`Verbose: ${verbose ? 'Yes' : 'No'}`);
  
  if (strategy === 'specific-type' && !options.typeId) {
    throw new Error('The specific-type strategy requires a type-id option');
  }
  
  if (strategy === 'specific-status' && !options.status) {
    throw new Error('The specific-status strategy requires a status option');
  }
  
  if (strategy === 'specific-type') {
    console.log(`Type ID to keep: ${options.typeId}`);
  }
  
  if (strategy === 'specific-status') {
    console.log(`Status to keep: ${options.status}`);
  }
  
  // Get Supabase client
  const supabase = SupabaseClientService.getInstance().getClient();
  
  // Test connection
  console.log('\nTesting Supabase connection...');
  const connectionTest = await SupabaseClientService.getInstance().testConnection();
  if (!connectionTest.success) {
    throw new Error(`Supabase connection test failed: ${connectionTest.error}`);
  }
  console.log('✅ Supabase connection test successful');
  
  // Step 1: Find duplicate expert documents
  console.log('\nFinding duplicate expert documents...');
  const duplicateGroups = await findDuplicateExpertDocuments({ limit, verbose: false });
  
  if (!duplicateGroups || duplicateGroups.length === 0) {
    console.log('No duplicate expert_documents found.');
    return {
      totalGroups: 0,
      groupsProcessed: 0,
      recordsDeleted: 0,
      recordsKept: 0,
      errors: []
    };
  }
  
  console.log(`Found ${duplicateGroups.length} sources with duplicate expert_documents.`);
  
  // Step 2: Process each group according to the strategy
  const result: PurgeResult = {
    totalGroups: duplicateGroups.length,
    groupsProcessed: 0,
    recordsDeleted: 0,
    recordsKept: 0,
    errors: []
  };
  
  // Process each group of duplicates
  for (const group of duplicateGroups) {
    try {
      if (verbose) {
        console.log(`\nProcessing source: ${group.source_id} - ${group.source_name || 'Unknown'} (${group.count} expert documents)`);
      }
      
      const documents = group.documents;
      if (!documents || documents.length <= 1) {
        // Skip if no duplicates
        continue;
      }
      
      // Determine which record to keep based on the strategy
      let recordToKeep: ExpertDocumentWithSource;
      let recordsToDelete: ExpertDocumentWithSource[];
      
      switch (strategy) {
        case 'newest':
          // Sort by created_at descending (newest first)
          documents.sort((a, b) => {
            return getCreationTime(b) - getCreationTime(a);
          });
          
          // Keep the newest record
          recordToKeep = documents[0];
          recordsToDelete = documents.slice(1);
          break;
          
        case 'specific-type':
          // Find records matching the specified document_type_id
          const matchingTypeRecords = documents.filter(doc => doc.document_type_id === options.typeId);
          
          if (matchingTypeRecords.length > 0) {
            // If multiple records match, keep the newest one
            matchingTypeRecords.sort((a, b) => {
              return getCreationTime(b) - getCreationTime(a);
            });
            
            recordToKeep = matchingTypeRecords[0];
            recordsToDelete = documents.filter(doc => doc.id !== recordToKeep.id);
          } else {
            // If no records match the type, fall back to keeping the newest
            documents.sort((a, b) => {
              return getCreationTime(b) - getCreationTime(a);
            });
            
            recordToKeep = documents[0];
            recordsToDelete = documents.slice(1);
            
            if (verbose) {
              console.log(`⚠️ No records found with document_type_id ${options.typeId}, falling back to keeping newest record`);
            }
          }
          break;
          
        case 'specific-status':
          // Find records matching the specified status
          const matchingStatusRecords = documents.filter(doc => 
            doc.document_processing_status === options.status
          );
          
          if (matchingStatusRecords.length > 0) {
            // If multiple records match, keep the newest one
            matchingStatusRecords.sort((a, b) => {
              return getCreationTime(b) - getCreationTime(a);
            });
            
            recordToKeep = matchingStatusRecords[0];
            recordsToDelete = documents.filter(doc => doc.id !== recordToKeep.id);
          } else {
            // If no records match the status, fall back to keeping the newest
            documents.sort((a, b) => {
              return getCreationTime(b) - getCreationTime(a);
            });
            
            recordToKeep = documents[0];
            recordsToDelete = documents.slice(1);
            
            if (verbose) {
              console.log(`⚠️ No records found with status ${options.status}, falling back to keeping newest record`);
            }
          }
          break;
          
        default:
          throw new Error(`Unknown strategy: ${strategy}`);
      }
      
      if (verbose || isDryRun) {
        console.log('\nRecord to keep:');
        console.log(`  ID: ${recordToKeep.id}`);
        console.log(`  Document Type: ${recordToKeep.document_type_name || recordToKeep.document_type_id || 'null'}`);
        console.log(`  Status: ${recordToKeep.document_processing_status || 'null'}`);
        
        console.log('\nRecords to delete:');
        for (const doc of recordsToDelete) {
          console.log(`  ID: ${doc.id}`);
          console.log(`  Document Type: ${doc.document_type_name || doc.document_type_id || 'null'}`);
          console.log(`  Status: ${doc.document_processing_status || 'null'}`);
          console.log('');
        }
      }
      
      // Perform the deletion if not in dry run mode
      if (!isDryRun) {
        // Delete the records to be removed
        const idsToDelete = recordsToDelete.map(doc => doc.id);
        
        if (idsToDelete.length > 0) {
          const { error } = await supabase
            .from('expert_documents')
            .delete()
            .in('id', idsToDelete);
            
          if (error) {
            const errorMessage = `Error deleting records for source ${group.source_id}: ${error.message}`;
            console.error(errorMessage);
            result.errors.push(errorMessage);
            continue;
          }
          
          console.log(`✅ Deleted ${idsToDelete.length} duplicate records for source ${group.source_id}`);
          result.recordsDeleted += idsToDelete.length;
          result.recordsKept++;
        }
      } else {
        // In dry run mode, just count
        result.recordsDeleted += recordsToDelete.length;
        result.recordsKept++;
      }
      
      result.groupsProcessed++;
    } catch (error) {
      const errorMessage = `Error processing source ${group.source_id}: ${error instanceof Error ? error.message : String(error)}`;
      console.error(errorMessage);
      result.errors.push(errorMessage);
    }
  }
  
  return result;
}

/**
 * Find and purge orphaned expert_documents records that have null source_id
 * or whose source_id doesn't exist in sources_google table
 */
async function purgeOrphanedExpertDocuments(options: PurgeOptions = {}): Promise<PurgeResult> {
  console.log('=== Purging Orphaned Expert Documents ===');
  
  const isDryRun = options.dryRun !== undefined ? options.dryRun : false;
  const limit = options.orphanedLimit || 100;
  const verbose = options.verbose || false;
  
  console.log(`Mode: ${isDryRun ? 'DRY RUN' : 'ACTUAL PURGE'}`);
  console.log(`Limit: ${limit} orphaned records`);
  console.log(`Verbose: ${verbose ? 'Yes' : 'No'}`);
  
  // Get Supabase client
  const supabase = SupabaseClientService.getInstance().getClient();
  
  // Test connection
  console.log('\nTesting Supabase connection...');
  const connectionTest = await SupabaseClientService.getInstance().testConnection();
  if (!connectionTest.success) {
    throw new Error(`Supabase connection test failed: ${connectionTest.error}`);
  }
  console.log('✅ Supabase connection test successful');
  
  // Initialize the result object
  const result: PurgeResult = {
    totalGroups: 0,
    groupsProcessed: 0,
    recordsDeleted: 0,
    recordsKept: 0,
    orphanedRecordsFound: 0,
    orphanedRecordsDeleted: 0,
    errors: []
  };
  
  // Step 1: Find expert_documents with null source_id
  console.log('\nFinding expert_documents with null source_id...');
  const { data: nullSourceData, error: nullSourceError } = await supabase
    .from('expert_documents')
    .select('id, document_type_id, document_processing_status, created_at, updated_at')
    .is('source_id', null)
    .limit(limit);
    
  if (nullSourceError) {
    const errorMessage = `Error querying records with null source_id: ${nullSourceError.message}`;
    console.error(errorMessage);
    result.errors.push(errorMessage);
  } else {
    const nullSourceRecords = nullSourceData || [];
    console.log(`Found ${nullSourceRecords.length} expert_documents with null source_id.`);
    
    if (nullSourceRecords.length > 0) {
      result.orphanedRecordsFound = (result.orphanedRecordsFound || 0) + nullSourceRecords.length;
      
      // Display the records if verbose
      if (verbose || isDryRun) {
        console.log('\nExpert Documents with null source_id:');
        console.table(nullSourceRecords.map(doc => ({
          id: doc.id,
          document_type_id: doc.document_type_id,
          status: doc.document_processing_status,
          created_at: doc.created_at
        })));
      }
      
      // Delete records if not in dry-run mode
      if (!isDryRun) {
        const idsToDelete = nullSourceRecords.map(doc => doc.id);
        
        if (idsToDelete.length > 0) {
          const { error: deleteError } = await supabase
            .from('expert_documents')
            .delete()
            .in('id', idsToDelete);
            
          if (deleteError) {
            const errorMessage = `Error deleting records with null source_id: ${deleteError.message}`;
            console.error(errorMessage);
            result.errors.push(errorMessage);
          } else {
            console.log(`✅ Deleted ${idsToDelete.length} expert_documents with null source_id`);
            result.orphanedRecordsDeleted = (result.orphanedRecordsDeleted || 0) + idsToDelete.length;
            result.recordsDeleted += idsToDelete.length;
          }
        }
      } else {
        result.orphanedRecordsDeleted = (result.orphanedRecordsDeleted || 0) + nullSourceRecords.length;
        result.recordsDeleted += nullSourceRecords.length;
      }
    }
  }
  
  // Step 2: Find expert_documents with non-existent source_id in sources_google
  console.log('\nFinding expert_documents with non-existent source_id in sources_google...');
  
  // This query finds expert_documents whose source_id does not exist in the sources_google table
  // We need to use a more complex approach since Supabase doesn't directly support NOT IN subqueries
  console.log('Fetching all source_ids from sources_google...');
  const { data: allSourcesData, error: sourcesError } = await supabase
    .from('sources_google')
    .select('id');
    
  if (sourcesError) {
    const errorMessage = `Error fetching sources_google ids: ${sourcesError.message}`;
    console.error(errorMessage);
    result.errors.push(errorMessage);
    return result;
  }
  
  // Create a set of all valid source_ids
  const validSourceIds = new Set((allSourcesData || []).map(source => source.id));
  console.log(`Found ${validSourceIds.size} valid source_ids in sources_google.`);
  
  // Get expert_documents with non-null source_id
  const { data: expertDocsData, error: expertDocsError } = await supabase
    .from('expert_documents')
    .select('id, source_id, document_type_id, document_processing_status, created_at, updated_at')
    .not('source_id', 'is', null)
    .limit(1000); // Get more records since we'll filter them in memory
    
  if (expertDocsError) {
    const errorMessage = `Error fetching expert_documents with non-null source_id: ${expertDocsError.message}`;
    console.error(errorMessage);
    result.errors.push(errorMessage);
    return result;
  }
  
  // Filter to find orphaned records (those with source_id not in the valid set)
  const orphanedRecords = (expertDocsData || [])
    .filter(doc => doc.source_id && !validSourceIds.has(doc.source_id))
    .slice(0, limit); // Apply the limit after filtering
  
  console.log(`Found ${orphanedRecords.length} expert_documents with non-existent source_id.`);
    
  if (orphanedRecords.length > 0) {
    result.orphanedRecordsFound = (result.orphanedRecordsFound || 0) + orphanedRecords.length;
    
    // Display the records if verbose
    if (verbose || isDryRun) {
      console.log('\nExpert Documents with non-existent source_id:');
      console.table(orphanedRecords.map(doc => ({
        id: doc.id,
        source_id: doc.source_id,
        document_type_id: doc.document_type_id,
        status: doc.document_processing_status,
        created_at: doc.created_at
      })));
    }
    
    // Delete records if not in dry-run mode
    if (!isDryRun) {
      const idsToDelete = orphanedRecords.map(doc => doc.id);
      
      if (idsToDelete.length > 0) {
        const { error: deleteError } = await supabase
          .from('expert_documents')
          .delete()
          .in('id', idsToDelete);
          
        if (deleteError) {
          const errorMessage = `Error deleting records with non-existent source_id: ${deleteError.message}`;
          console.error(errorMessage);
          result.errors.push(errorMessage);
        } else {
          console.log(`✅ Deleted ${idsToDelete.length} expert_documents with non-existent source_id`);
          result.orphanedRecordsDeleted = (result.orphanedRecordsDeleted || 0) + idsToDelete.length;
          result.recordsDeleted += idsToDelete.length;
        }
      }
    } else {
      result.orphanedRecordsDeleted = (result.orphanedRecordsDeleted || 0) + orphanedRecords.length;
      result.recordsDeleted += orphanedRecords.length;
    }
  }
  
  return result;
}

// Main function to run the command
async function runPurge(options: PurgeOptions = {}): Promise<void> {
  try {
    // Start command tracking
    const trackingId = await commandTrackingService.startTracking('google_sync', 'expert-documents-purge');
    
    let duplicateResult: PurgeResult | null = null;
    let orphanedResult: PurgeResult | null = null;
    
    // Process duplicate records if not specifically looking for orphaned records only
    if (!options.orphaned) {
      // Run the purge operation for duplicates
      duplicateResult = await purgeExpertDocumentDuplicates(options);
    }
    
    // Process orphaned records if requested with the --orphaned flag
    if (options.orphaned) {
      // Run the purge operation for orphaned records
      orphanedResult = await purgeOrphanedExpertDocuments(options);
    }
    
    // Display the results
    console.log('\n=== Expert Documents Purge Results ===');
    
    // Display duplicate results if available
    if (duplicateResult) {
      console.log('\n• Duplicate Records:');
      console.log(`  Total duplicate groups found: ${duplicateResult.totalGroups}`);
      console.log(`  Groups processed: ${duplicateResult.groupsProcessed}`);
      console.log(`  Records kept: ${duplicateResult.recordsKept}`);
      console.log(`  Records ${options.dryRun ? 'that would be ' : ''}deleted: ${duplicateResult.recordsDeleted}`);
    }
    
    // Display orphaned results if available
    if (orphanedResult) {
      console.log('\n• Orphaned Records:');
      console.log(`  Orphaned records found: ${orphanedResult.orphanedRecordsFound || 0}`);
      console.log(`  Records ${options.dryRun ? 'that would be ' : ''}deleted: ${orphanedResult.orphanedRecordsDeleted || 0}`);
    }
    
    // Combine errors from both operations
    const allErrors = [
      ...(duplicateResult?.errors || []),
      ...(orphanedResult?.errors || [])
    ];
    
    console.log(`\nErrors encountered: ${allErrors.length}`);
    
    if (allErrors.length > 0) {
      console.log('\nErrors:');
      allErrors.forEach((error, index) => {
        console.log(`${index + 1}. ${error}`);
      });
    }
    
    if (options.dryRun) {
      console.log('\n⚠️ This was a DRY RUN. No records were actually deleted.');
      console.log('To perform the actual purge, run the command without the --dry-run flag.');
    }
    
    // Calculate total records affected
    const totalRecordsDeleted = 
      (duplicateResult?.recordsDeleted || 0) + 
      (orphanedResult?.orphanedRecordsDeleted || 0);
    
    // Create summary message
    let summaryMessage = `${options.dryRun ? '[DRY RUN] ' : ''}`;
    
    if (duplicateResult) {
      summaryMessage += `Purged ${duplicateResult.recordsDeleted} duplicate expert_documents from ${duplicateResult.groupsProcessed} sources`;
    }
    
    if (orphanedResult) {
      if (duplicateResult) {
        summaryMessage += ` and purged ${orphanedResult.orphanedRecordsDeleted} orphaned records`;
      } else {
        summaryMessage += `Purged ${orphanedResult.orphanedRecordsDeleted} orphaned expert_documents records`;
      }
    }
    
    // Complete tracking
    await commandTrackingService.completeTracking(trackingId, {
      recordsAffected: totalRecordsDeleted,
      summary: summaryMessage
    });
    
    console.log('\nExpert documents purge complete!');
  } catch (error) {
    console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
    
    // Log tracking failure
    try {
      const trackingId = await commandTrackingService.startTracking('google_sync', 'expert-documents-purge');
      await commandTrackingService.failTracking(
        trackingId, 
        `Error: ${error instanceof Error ? error.message : String(error)}`
      );
    } catch (trackingError) {
      // Just log and continue if tracking fails
      console.warn(`Failed to track command error: ${trackingError instanceof Error ? trackingError.message : String(trackingError)}`);
    }
    
    process.exit(1);
  }
}

// Set up command line interface
const program = new Command();

program
  .name('expert-documents-purge')
  .description('Purge problematic expert_documents records (duplicates or orphaned)')
  .option('--dry-run', 'Show what would be done without making changes', false)
  .option('--limit <number>', 'Limit the number of duplicate sets to process', '50')
  .option('--strategy <strategy>', 'Resolution strategy (newest, specific-type, specific-status)', 'newest')
  .option('--type-id <uuid>', 'When using specific-type strategy, the document_type_id to keep')
  .option('--status <status>', 'When using specific-status strategy, the status to keep')
  .option('--orphaned', 'Purge orphaned records (null source_id or non-existent sources_google record)', false)
  .option('--orphaned-limit <number>', 'Limit for orphaned records to process', '100')
  .option('--verbose', 'Show detailed information during processing', false)
  .action(async (options) => {
    const purgeOptions: PurgeOptions = {
      dryRun: options.dryRun,
      limit: parseInt(options.limit, 10),
      strategy: options.strategy as 'newest' | 'specific-type' | 'specific-status',
      typeId: options.typeId,
      status: options.status,
      orphaned: options.orphaned,
      orphanedLimit: parseInt(options.orphanedLimit, 10),
      verbose: options.verbose
    };
    
    await runPurge(purgeOptions);
  });

// Run the CLI if this module is executed directly
if (require.main === module) {
  program.parse(process.argv);
}

// Export for module usage
export { purgeExpertDocumentDuplicates, runPurge };