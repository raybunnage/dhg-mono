#!/usr/bin/env ts-node
/**
 * Script to synchronize mime_types table with all unique mime types found in sources_google
 */

import { Command } from 'commander';
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
import { commandTrackingService } from '../../../packages/shared/services/tracking-service/command-tracking-service';
import * as fs from 'fs';
import * as path from 'path';

// Initialize Supabase client using the singleton pattern
const supabaseService = SupabaseClientService.getInstance();
const supabaseClient = supabaseService.getClient();

// Common MIME type categories - used to pre-categorize detected MIME types
const mimeTypeCategories: Record<string, string> = {
  // Documents
  'application/pdf': 'Document',
  'application/msword': 'Document',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Document',
  'application/vnd.google-apps.document': 'Document',
  'text/plain': 'Document',
  'text/markdown': 'Document',
  'text/html': 'Document',
  'application/rtf': 'Document',
  
  // Spreadsheets
  'application/vnd.ms-excel': 'Spreadsheet',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'Spreadsheet',
  'application/vnd.google-apps.spreadsheet': 'Spreadsheet',
  'text/csv': 'Spreadsheet',
  
  // Presentations
  'application/vnd.ms-powerpoint': 'Presentation',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'Presentation',
  'application/vnd.google-apps.presentation': 'Presentation',
  
  // Images
  'image/jpeg': 'Image',
  'image/png': 'Image',
  'image/gif': 'Image',
  'image/svg+xml': 'Image',
  'image/webp': 'Image',
  'image/tiff': 'Image',
  'image/bmp': 'Image',
  
  // Audio
  'audio/mpeg': 'Audio',
  'audio/mp3': 'Audio',
  'audio/wav': 'Audio',
  'audio/ogg': 'Audio',
  'audio/m4a': 'Audio',
  'audio/webm': 'Audio',
  
  // Video
  'video/mp4': 'Video',
  'video/mpeg': 'Video',
  'video/quicktime': 'Video',
  'video/x-msvideo': 'Video',
  'video/webm': 'Video',
  
  // Archives
  'application/zip': 'Archive',
  'application/x-rar-compressed': 'Archive',
  'application/x-7z-compressed': 'Archive',
  'application/x-tar': 'Archive',
  'application/gzip': 'Archive',
  
  // Code
  'text/javascript': 'Code',
  'application/json': 'Code',
  'text/css': 'Code',
  'application/xml': 'Code',
  'text/xml': 'Code',
  
  // Folders and containers
  'application/vnd.google-apps.folder': 'Folder'
};

// Common extensions for MIME types
const mimeTypeExtensions: Record<string, string> = {
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.google-apps.document': 'gdoc',
  'text/plain': 'txt',
  'text/markdown': 'md',
  'text/html': 'html',
  'application/rtf': 'rtf',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.google-apps.spreadsheet': 'gsheet',
  'text/csv': 'csv',
  'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'application/vnd.google-apps.presentation': 'gslides',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
  'image/webp': 'webp',
  'image/tiff': 'tiff',
  'image/bmp': 'bmp',
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/wav': 'wav',
  'audio/ogg': 'ogg',
  'audio/m4a': 'm4a',
  'audio/webm': 'weba',
  'video/mp4': 'mp4',
  'video/mpeg': 'mpeg',
  'video/quicktime': 'mov',
  'video/x-msvideo': 'avi',
  'video/webm': 'webm',
  'application/zip': 'zip',
  'application/x-rar-compressed': 'rar',
  'application/x-7z-compressed': '7z',
  'application/x-tar': 'tar',
  'application/gzip': 'gz',
  'text/javascript': 'js',
  'application/json': 'json',
  'text/css': 'css',
  'application/xml': 'xml',
  'text/xml': 'xml'
};

// List of supported MIME types (these are types we can process with our tools)
const supportedMimeTypes = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.google-apps.document',
  'text/plain',
  'text/markdown',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'video/mp4'
];

/**
 * Interface for the syncMimeTypes function options
 */
export interface SyncMimeTypesOptions {
  dryRun?: boolean;    // Whether to run in dry-run mode (no changes made)
  verbose?: boolean;   // Whether to output verbose details
}

/**
 * Extracts unique MIME types from sources_google and updates the mime_types table
 * @param options Configuration options
 */
async function syncMimeTypes(options: SyncMimeTypesOptions): Promise<void> {
  const dryRun = options.dryRun || false;
  const verbose = options.verbose || false;
  
  console.log(`${dryRun ? '[DRY RUN] ' : ''}Synchronizing mime_types table with unique MIME types from sources_google...`);

  // Track the command
  let trackingId: string;
  try {
    trackingId = await commandTrackingService.startTracking('mime_types', 'sync-mime-types');
  } catch (error) {
    console.warn(`Warning: Unable to initialize command tracking: ${error instanceof Error ? error.message : String(error)}`);
    trackingId = 'tracking-unavailable';
  }

  try {
    // Test Supabase connection with our own test
    console.log('Testing Supabase connection...');
    try {
      // Use sources_google table for connection test - this table should always exist
      const { data: sourceTest, error: sourceError } = await supabaseClient
        .from('sources_google')
        .select('id')
        .limit(1);
        
      if (sourceError) {
        throw new Error(`Error connecting to Supabase: ${JSON.stringify(sourceError)}`);
      }
      
      console.log('✅ Successfully connected to Supabase');
    } catch (error) {
      throw new Error(`Supabase connection failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    // 1. Check if mime_types table exists, create it if not
    console.log('Checking if mime_types table exists...');
    
    try {
      // Try to directly select from mime_types table - if it fails, the table likely doesn't exist
      const { data: mimeTypesTest, error: mimeTypesTestError } = await supabaseClient
        .from('mime_types')
        .select('id')
        .limit(1);
      
      if (mimeTypesTestError && mimeTypesTestError.code === 'PGRST116') {
        // PGRST116 means relation does not exist
        console.log('mime_types table does not exist. Creating it...');
        
        if (!dryRun) {
          // Load and execute the SQL from our migration file
          const sqlPath = path.join(__dirname, 'create-mime-types-table.sql');
          const sql = fs.readFileSync(sqlPath, 'utf8');
          
          // Execute SQL directly using the Supabase JavaScript client
          const createTableSql = `
            CREATE TABLE IF NOT EXISTS mime_types (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
              mime_type TEXT UNIQUE NOT NULL,
              description TEXT,
              category TEXT,
              is_supported BOOLEAN DEFAULT TRUE,
              extension TEXT,
              icon TEXT,
              created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
              updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
            );
            CREATE INDEX IF NOT EXISTS idx_mime_types_mime_type ON mime_types(mime_type);
            CREATE INDEX IF NOT EXISTS idx_mime_types_category ON mime_types(category);
          `;
          
          // Execute the SQL directly
          const { error: createError } = await supabaseClient.rpc('pg_execute', { query: createTableSql });
          
          if (createError) {
            throw new Error(`Failed to create mime_types table: ${createError.message}`);
          }
          
          console.log('✅ mime_types table created successfully');
        } else {
          console.log('[DRY RUN] Would create mime_types table');
        }
      } else if (mimeTypesTestError) {
        // Other error occurred
        throw new Error(`Error checking mime_types table: ${mimeTypesTestError.message}`);
      } else {
        console.log('mime_types table already exists.');
      }
    } catch (dbError) {
      throw new Error(`Failed to check or create mime_types table: ${dbError instanceof Error ? dbError.message : String(dbError)}`);
    }

    // 2. Get all unique mime types from sources_google
    console.log('Fetching all unique MIME types from sources_google...');
    
    const { data: uniqueMimeTypes, error: mimeTypesError } = await supabaseClient
      .from('sources_google')
      .select('mime_type')
      .not('mime_type', 'is', null)
      .order('mime_type');
      
    if (mimeTypesError) {
      throw new Error(`Error fetching MIME types: ${mimeTypesError.message}`);
    }
    
    if (!uniqueMimeTypes || uniqueMimeTypes.length === 0) {
      console.log('No MIME types found in sources_google');
      return;
    }
    
    // Extract unique values
    const allMimeTypes = uniqueMimeTypes.map(item => item.mime_type);
    const uniqueMimeTypeValues = Array.from(new Set(allMimeTypes)).filter(Boolean);
    
    console.log(`Found ${uniqueMimeTypeValues.length} unique MIME types in sources_google.`);
    
    if (verbose) {
      console.log('MIME types found:');
      uniqueMimeTypeValues.forEach(mimeType => {
        console.log(`- ${mimeType}`);
      });
    }

    // 3. Get existing MIME types from mime_types table
    console.log('Fetching existing MIME types from mime_types table...');
    
    const { data: existingMimeTypes, error: existingTypesError } = await supabaseClient
      .from('mime_types')
      .select('mime_type');
      
    if (existingTypesError && existingTypesError.code !== 'PGRST116') {
      // PGRST116 means relation does not exist, which is expected if the table was just created
      throw new Error(`Error fetching existing MIME types: ${existingTypesError.message}`);
    }
    
    const existingTypes = new Set((existingMimeTypes || []).map(item => item.mime_type));
    
    console.log(`Found ${existingTypes.size} existing entries in mime_types table.`);

    // 4. Find new MIME types to insert
    const newMimeTypes = uniqueMimeTypeValues.filter(mimeType => !existingTypes.has(mimeType));
    
    console.log(`Found ${newMimeTypes.length} new MIME types to add to the mime_types table.`);
    
    if (newMimeTypes.length === 0) {
      console.log('No new MIME types to add.');
    } else {
      // Prepare the new records
      const newRecords = newMimeTypes.map(mimeType => {
        return {
          mime_type: mimeType,
          category: mimeTypeCategories[mimeType] || 'Unknown',
          description: `${mimeTypeCategories[mimeType] || 'Unknown'} file type`,
          is_supported: supportedMimeTypes.includes(mimeType),
          extension: mimeTypeExtensions[mimeType] || null,
          icon: null, // Can be populated later
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
      });
      
      if (verbose) {
        console.log('New MIME types to add:');
        newRecords.forEach(record => {
          console.log(`- ${record.mime_type} (${record.category}, Supported: ${record.is_supported})`);
        });
      }
      
      if (!dryRun) {
        // Insert the new records
        const { data: insertedTypes, error: insertError } = await supabaseClient
          .from('mime_types')
          .insert(newRecords)
          .select('id, mime_type');
          
        if (insertError) {
          throw new Error(`Error inserting new MIME types: ${insertError.message}`);
        }
        
        console.log(`✅ Successfully added ${insertedTypes?.length || 0} new MIME types to the mime_types table.`);
      } else {
        console.log(`[DRY RUN] Would add ${newRecords.length} new MIME types to the mime_types table.`);
      }
    }

    // 5. Update statistics for MIME types
    console.log('\nCalculating MIME type usage statistics...');
    
    const mimeTypeCounts: Record<string, number> = {};
    
    // Count occurrences of each MIME type
    for (const type of allMimeTypes) {
      mimeTypeCounts[type] = (mimeTypeCounts[type] || 0) + 1;
    }
    
    // Sort by count (descending)
    const sortedMimeTypes = Object.entries(mimeTypeCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([mimeType, count]) => ({ mimeType, count }));
    
    console.log('\nTop 10 most common MIME types:');
    console.log('---------------------------------------------------------');
    console.log('| MIME Type                                    | Count  |');
    console.log('---------------------------------------------------------');
    
    for (let i = 0; i < Math.min(10, sortedMimeTypes.length); i++) {
      const { mimeType, count } = sortedMimeTypes[i];
      const mimeTypeDisplay = mimeType.padEnd(46).substring(0, 44);
      const countDisplay = count.toString().padStart(6);
      console.log(`| ${mimeTypeDisplay} | ${countDisplay} |`);
    }
    
    console.log('---------------------------------------------------------');

    // 6. Calculate category statistics
    const categoryStats: Record<string, { count: number, mimeTypes: Set<string> }> = {};
    
    for (const mimeType of uniqueMimeTypeValues) {
      const category = mimeTypeCategories[mimeType] || 'Unknown';
      
      if (!categoryStats[category]) {
        categoryStats[category] = { count: 0, mimeTypes: new Set() };
      }
      
      categoryStats[category].mimeTypes.add(mimeType);
      categoryStats[category].count += mimeTypeCounts[mimeType] || 0;
    }
    
    // Sort by count (descending)
    const sortedCategories = Object.entries(categoryStats)
      .sort((a, b) => b[1].count - a[1].count)
      .map(([category, stats]) => ({ 
        category, 
        count: stats.count, 
        uniqueTypes: stats.mimeTypes.size 
      }));
    
    console.log('\nMIME type categories:');
    console.log('----------------------------------------------------------');
    console.log('| Category      | Files  | Unique MIME Types              |');
    console.log('----------------------------------------------------------');
    
    for (const cat of sortedCategories) {
      const categoryDisplay = cat.category.padEnd(15).substring(0, 13);
      const countDisplay = cat.count.toString().padStart(6);
      const uniqueDisplay = cat.uniqueTypes.toString().padStart(5);
      console.log(`| ${categoryDisplay} | ${countDisplay} | ${uniqueDisplay}                         |`);
    }
    
    console.log('----------------------------------------------------------');

    // Complete tracking
    if (trackingId !== 'tracking-unavailable') {
      try {
        await commandTrackingService.completeTracking(trackingId, {
          recordsAffected: newMimeTypes.length,
          summary: `${dryRun ? '[DRY RUN] ' : ''}Synced mime_types table with ${newMimeTypes.length} new MIME types`
        });
      } catch (error) {
        console.warn(`Warning: Unable to complete command tracking: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    console.log(`\n${dryRun ? '[DRY RUN] ' : ''}MIME types synchronization completed successfully.`);
    
  } catch (error) {
    console.error(`Error synchronizing MIME types: ${error instanceof Error ? error.message : String(error)}`);
    
    if (trackingId !== 'tracking-unavailable') {
      try {
        await commandTrackingService.failTracking(trackingId, `Command failed: ${error instanceof Error ? error.message : String(error)}`);
      } catch (trackingError) {
        console.warn(`Warning: Unable to record command failure: ${trackingError instanceof Error ? trackingError.message : String(trackingError)}`);
      }
    }
  }
}

// Setup CLI program
const program = new Command();

program
  .name('sync-mime-types')
  .description('Synchronize the mime_types table with unique MIME types from sources_google')
  .option('--dry-run', 'Show what would be done without making changes')
  .option('-v, --verbose', 'Show detailed information about each MIME type')
  .action((options: SyncMimeTypesOptions) => {
    syncMimeTypes({
      dryRun: options.dryRun,
      verbose: options.verbose
    });
  });

// Run the program if this script is executed directly
if (require.main === module) {
  program.parse(process.argv);
}

// Export for module usage
export { syncMimeTypes };