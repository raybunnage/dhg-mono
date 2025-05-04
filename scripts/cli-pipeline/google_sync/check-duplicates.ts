#!/usr/bin/env ts-node
/**
 * Check Duplicates in sources_google Script
 * 
 * This script checks for duplicate records in sources_google by name and drive_id
 */

import * as dotenv from 'dotenv';
import { Command } from 'commander';
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

// Load environment variables
dotenv.config();

// Define interfaces for type safety
interface SourceRecord {
  id: string;
  drive_id: string;
  name: string;
  path: string;
  created_at: string;
  updated_at: string;
  modified_at?: string; // Use modified_at instead of modified_time
}

interface DuplicateGroup {
  name?: string;
  drive_id?: string;
  count: number;
  records: SourceRecord[] | Array<{id: string, drive_id?: string, name?: string}>;
}

// Define interface for options
export interface CheckDuplicatesOptions {
  limit?: number;
  json?: boolean;
  byName?: boolean;
  byDriveId?: boolean;
  all?: boolean;
  verbose?: boolean;
}

// Define program commands if run directly
const program = new Command();

program
  .name('check-duplicates')
  .description('Check for duplicate records in sources_google table')
  .option('-l, --limit <number>', 'Limit the number of duplicate groups to display', '10')
  .option('-j, --json', 'Output in JSON format')
  .option('-n, --by-name', 'Check duplicates by name (default)', true)
  .option('-d, --by-drive-id', 'Check duplicates by drive_id')
  .option('-a, --all', 'Check both name and drive_id duplicates', false)
  .option('-v, --verbose', 'Show detailed information for each duplicate', false);

// Export the main function for use in index.ts
export async function checkDuplicates(options: CheckDuplicatesOptions) {
  try {
    console.log('Checking for duplicates in sources_google table...');
    
    // Create Supabase client
    const supabaseClientService = SupabaseClientService.getInstance();
    const supabase = supabaseClientService.getClient();
    
    // Get total count
    const { count, error: countError } = await supabase
      .from('sources_google')
      .select('*', { count: 'exact', head: true });
      
    if (countError) {
      throw new Error(`Failed to count records: ${countError.message}`);
    }
    
    console.log(`Total records in sources_google: ${count}`);
    
    // Fetch all records - this approach is suitable for smaller tables
    // For large tables, we would use SQL directly with GROUP BY
    const { data, error } = await supabase
      .from('sources_google')
      .select('id, drive_id, name, path, created_at, updated_at, modified_at')
      .order('name');
      
    if (error) {
      throw new Error(`Failed to fetch records: ${error.message}`);
    }
    
    if (!data || data.length === 0) {
      console.log('No records found in sources_google');
      return;
    }
    
    // Check for name duplicates
    if (options.byName || options.all) {
      const nameGroups: Record<string, SourceRecord[]> = {};
      
      // Group by name
      data.forEach((record: SourceRecord) => {
        const name = record.name || '(unnamed)';
        if (!nameGroups[name]) {
          nameGroups[name] = [];
        }
        nameGroups[name].push(record);
      });
      
      // Filter for duplicates
      const duplicateNames: DuplicateGroup[] = Object.entries(nameGroups)
        .filter(([_, records]) => records.length > 1)
        .map(([name, records]) => ({
          name,
          count: records.length,
          records: options.verbose ? records : records.map(r => ({ id: r.id, drive_id: r.drive_id }))
        }))
        .sort((a, b) => b.count - a.count);
      
      const limit = options.limit || 10;
      const displayDuplicates = duplicateNames.slice(0, limit);
      
      if (options.json) {
        console.log(JSON.stringify({
          total_name_duplicates: duplicateNames.length,
          duplicates: displayDuplicates
        }, null, 2));
      } else {
        console.log(`\nFound ${duplicateNames.length} files with duplicate names:`);
        
        displayDuplicates.forEach(dupGroup => {
          console.log(`\n"${dupGroup.name}" appears ${dupGroup.count} times:`);
          dupGroup.records.forEach(record => {
            if (options.verbose) {
              const fullRecord = record as SourceRecord;
              console.log(`  - ID: ${fullRecord.id}, Drive ID: ${fullRecord.drive_id}, Path: ${fullRecord.path}`);
              console.log(`    Created: ${fullRecord.created_at}, Updated: ${fullRecord.updated_at}`);
            } else {
              console.log(`  - ID: ${record.id}, Drive ID: ${(record as any).drive_id}`);
            }
          });
        });
        
        if (duplicateNames.length > limit) {
          console.log(`\n... and ${duplicateNames.length - limit} more duplicate groups`);
        }
      }
    }
    
    // Check for drive_id duplicates
    if (options.byDriveId || options.all) {
      const driveIdGroups: Record<string, SourceRecord[]> = {};
      
      // Group by drive_id
      data.forEach((record: SourceRecord) => {
        if (!record.drive_id) return; // Skip records without drive_id
        
        if (!driveIdGroups[record.drive_id]) {
          driveIdGroups[record.drive_id] = [];
        }
        driveIdGroups[record.drive_id].push(record);
      });
      
      // Filter for duplicates
      const duplicateDriveIds: DuplicateGroup[] = Object.entries(driveIdGroups)
        .filter(([_, records]) => records.length > 1)
        .map(([driveId, records]) => ({
          drive_id: driveId,
          count: records.length,
          records: options.verbose ? records : records.map(r => ({ id: r.id, name: r.name }))
        }))
        .sort((a, b) => b.count - a.count);
      
      const limit = options.limit || 10;
      const displayDuplicates = duplicateDriveIds.slice(0, limit);
      
      if (options.json) {
        console.log(JSON.stringify({
          total_drive_id_duplicates: duplicateDriveIds.length,
          duplicates: displayDuplicates
        }, null, 2));
      } else {
        console.log(`\nFound ${duplicateDriveIds.length} drive_ids with duplicate records:`);
        
        displayDuplicates.forEach(dupGroup => {
          console.log(`\nDrive ID "${dupGroup.drive_id}" appears ${dupGroup.count} times:`);
          dupGroup.records.forEach(record => {
            if (options.verbose) {
              const fullRecord = record as SourceRecord;
              console.log(`  - ID: ${fullRecord.id}, Name: ${fullRecord.name}, Path: ${fullRecord.path}`);
              console.log(`    Created: ${fullRecord.created_at}, Updated: ${fullRecord.updated_at}`);
            } else {
              console.log(`  - ID: ${record.id}, Name: "${(record as any).name}"`);
            }
          });
        });
        
        if (duplicateDriveIds.length > limit) {
          console.log(`\n... and ${duplicateDriveIds.length - limit} more duplicate groups`);
        }
      }
    }
    
  } catch (error) {
    console.error('Error checking for duplicates:', error);
    if (require.main === module) {
      process.exit(1);
    } else {
      throw error;
    }
  }
}

// Only run if this file is executed directly
if (require.main === module) {
  program.parse(process.argv);
  const options = program.opts();
  
  // Convert options to CheckDuplicatesOptions interface format
  const checkOptions: CheckDuplicatesOptions = {
    limit: options.limit ? parseInt(options.limit, 10) : 10,
    json: options.json || false,
    byName: options.byName !== false, // true by default
    byDriveId: options.byDriveId || false,
    all: options.all || false,
    verbose: options.verbose || false
  };
  
  checkDuplicates(checkOptions).catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}