/**
 * sync-markdown-files.ts
 * 
 * CLI pipeline script to synchronize markdown files in the repository with the documentation_files table.
 * 
 * Purpose:
 * - Scan the repository for markdown files
 * - Compare against documentation_files table
 * - Add new files to the table with is_deleted = FALSE
 * - Mark missing files as is_deleted = TRUE
 * - Update metadata for all files
 * - Ensure full paths are stored for all files
 * 
 * Requirements:
 * - Exclude files in file_types, backup, archive, or external tools folders
 * - Update metadata fields in the documentation_files table
 * - Use file services from the CLI package
 */

import path from 'path';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { FileService } from '../../packages/cli/src/services/file-service';
import { Logger, LogLevel } from '../../packages/cli/src/utils/logger';
import { ErrorHandler } from '../../packages/cli/src/utils/error-handler';

// Environment variables
const SUPABASE_URL = process.env.CLI_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.CLI_SUPABASE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const LOG_LEVEL = (process.env.CLI_LOG_LEVEL || 'info').toLowerCase() as string;

// Configure logger
Logger.setLevel(
  LOG_LEVEL === 'debug' ? LogLevel.DEBUG :
  LOG_LEVEL === 'info' ? LogLevel.INFO :
  LOG_LEVEL === 'warn' ? LogLevel.WARN :
  LOG_LEVEL === 'error' ? LogLevel.ERROR :
  LogLevel.INFO
);

// Exit if Supabase credentials are missing
if (!SUPABASE_URL || !SUPABASE_KEY) {
  Logger.error('Missing Supabase credentials. Set CLI_SUPABASE_URL and CLI_SUPABASE_KEY environment variables.');
  process.exit(1);
}

// Create Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Create file service instance
const fileService = new FileService();

interface MarkdownFile {
  file_path: string;
  full_path: string;
  title: string;
  hash: string;
  metadata: {
    size: number;
    created?: string | undefined;
    modified?: string | undefined;
    isPrompt: boolean;
  };
}

interface DocumentationFile {
  id: string;
  file_path: string;
  title: string;
  file_hash: string;
  metadata: {
    size: number;
    created?: string;
    modified?: string;
    isPrompt: boolean;
  };
  is_deleted: boolean;
}

/**
 * Main function to synchronize markdown files
 */
/**
 * Update file paths to ensure they're absolute
 */
async function updateFilePaths(repoRoot: string) {
  Logger.info('Updating file paths to ensure they are absolute...');
  
  try {
    // Get all documentation files
    const { data: dbFiles, error } = await supabase
      .from('documentation_files')
      .select('id, file_path');
    
    if (error) {
      throw new Error(`Failed to fetch documentation files: ${error.message}`);
    }
    
    if (!dbFiles || dbFiles.length === 0) {
      Logger.info('No documentation files found in database');
      return;
    }
    
    Logger.info(`Found ${dbFiles.length} documentation files to check for path updates`);
    
    let updatedCount = 0;
    const now = new Date().toISOString();
    
    // Process each file
    for (const file of dbFiles) {
      let fullPath = file.file_path;
      
      // If path starts with "apps/" or "packages/" but is not absolute
      if ((file.file_path.startsWith('apps/') || file.file_path.startsWith('packages/')) && !path.isAbsolute(file.file_path)) {
        fullPath = path.join(repoRoot, file.file_path);
        
        // Update the file path in the database
        const { error: updateError } = await supabase
          .from('documentation_files')
          .update({
            file_path: fullPath,
            updated_at: now,
            last_modified_at: now
          })
          .eq('id', file.id);
        
        if (updateError) {
          Logger.error(`Failed to update file path for ${file.file_path}: ${updateError.message}`);
        } else {
          updatedCount++;
          Logger.debug(`Updated file path: ${file.file_path} -> ${fullPath}`);
        }
      }
    }
    
    Logger.info(`Updated ${updatedCount} file paths to absolute paths`);
  } catch (error) {
    Logger.error(`Error updating file paths: ${error}`);
  }
}

/**
 * Verify the state of the documentation_files table
 */
async function verifyDocumentationFilesState() {
  Logger.info('Verifying documentation_files table state...');
  
  try {
    // Get count of all files
    const { count: totalCount, error: countError } = await supabase
      .from('documentation_files')
      .select('*', { count: 'exact', head: true });
    
    if (countError) {
      Logger.error(`Error counting files: ${countError.message}`);
      return;
    }
    
    // Get count of non-deleted files
    const { count: activeCount, error: activeError } = await supabase
      .from('documentation_files')
      .select('*', { count: 'exact', head: true })
      .eq('is_deleted', false);
    
    if (activeError) {
      Logger.error(`Error counting active files: ${activeError.message}`);
      return;
    }
    
    // Get count of deleted files
    const { count: deletedCount, error: deletedError } = await supabase
      .from('documentation_files')
      .select('*', { count: 'exact', head: true })
      .eq('is_deleted', true);
    
    if (deletedError) {
      Logger.error(`Error counting deleted files: ${deletedError.message}`);
      return;
    }
    
    // Fetch sample of non-deleted files
    const { data: activeSample, error: sampleError } = await supabase
      .from('documentation_files')
      .select('id, file_path, is_deleted')
      .eq('is_deleted', false)
      .limit(5);
    
    if (sampleError) {
      Logger.error(`Error fetching active sample: ${sampleError.message}`);
    }
    
    // Fetch sample of deleted files
    const { data: deletedSample, error: deletedSampleError } = await supabase
      .from('documentation_files')
      .select('id, file_path, is_deleted')
      .eq('is_deleted', true)
      .limit(5);
    
    if (deletedSampleError) {
      Logger.error(`Error fetching deleted sample: ${deletedSampleError.message}`);
    }
    
    // Log the verification results
    Logger.info('------------------------------------');
    Logger.info('Documentation Files Verification Results:');
    Logger.info(`- Total files: ${totalCount || 0}`);
    Logger.info(`- Active files (is_deleted = FALSE): ${activeCount || 0}`);
    Logger.info(`- Deleted files (is_deleted = TRUE): ${deletedCount || 0}`);
    
    if (activeSample && activeSample.length > 0) {
      Logger.info('Sample of active files:');
      activeSample.forEach(file => {
        Logger.info(`  - ${file.file_path} (ID: ${file.id}, is_deleted: ${file.is_deleted})`);
      });
    } else {
      Logger.info('No active files found (is_deleted = FALSE)');
    }
    
    if (deletedSample && deletedSample.length > 0) {
      Logger.info('Sample of deleted files:');
      deletedSample.forEach(file => {
        Logger.info(`  - ${file.file_path} (ID: ${file.id}, is_deleted: ${file.is_deleted})`);
      });
    } else {
      Logger.info('No deleted files found (is_deleted = TRUE)');
    }
    
    Logger.info('------------------------------------');
  } catch (error) {
    Logger.error('Error verifying documentation files state:', error);
  }
}

/**
 * Check and log the database table schema
 */
async function checkTableSchema() {
  try {
    Logger.info('Checking documentation_files table schema...');
    
    // Just fetch metadata from a sample record to understand the schema
    const { data, error } = await supabase
      .from('documentation_files')
      .select('*')
      .limit(1);
    
    if (error) {
      Logger.warn(`Could not get table schema: ${error.message}`);
      
      // Alternate approach - get a single record to inspect structure
      const { data: sampleRecord, error: sampleError } = await supabase
        .from('documentation_files')
        .select('*')
        .limit(1);
        
      if (sampleError) {
        Logger.warn(`Could not get sample record: ${sampleError.message}`);
      } else if (sampleRecord && sampleRecord.length > 0) {
        Logger.debug('Sample record structure:', Object.keys(sampleRecord[0]));
        if ('is_deleted' in sampleRecord[0]) {
          Logger.debug(`is_deleted column exists, type: ${typeof sampleRecord[0].is_deleted}, value: ${sampleRecord[0].is_deleted}`);
        } else {
          Logger.warn('is_deleted column not found in sample record');
        }
      }
    } else {
      Logger.debug('Table schema:', data);
    }
  } catch (error) {
    Logger.warn(`Error checking table schema: ${error}`);
  }
}

/**
 * Force undelete EVERYTHING - last resort function
 */
async function forceUndeleteAll() {
  Logger.warn("EXECUTING EMERGENCY UNDELETE OF ALL MARKDOWN DOCUMENTATION");
  
  try {
    // Use raw SQL to guarantee we set the is_deleted field correctly
    const { data, error } = await supabase
      .rpc('force_undelete_documentation', {});
    
    if (error) {
      Logger.error(`Error in force undelete: ${error.message}`);
      
      // Plan B - manual update using standard update
      Logger.warn("Trying alternate approach with standard update");
      
      // Create a timestamp for now
      const now = new Date().toISOString();
      
      const { data: updateData, error: updateError } = await supabase
        .from('documentation_files')
        .update({ 
          is_deleted: false,
          last_modified_at: now,
          updated_at: now
        })
        .in('file_path', [
          'docs/project-structure/vite-setup.md',
          'docs/docs-organization.md',
          'docs/documentation-report.md',
          'docs/project-structure/pnpm-commands.md',
          'docs/git-history/ai_processing_history.md'
        ])
        .select();
      
      if (updateError) {
        Logger.error(`Error in alternate undelete: ${updateError.message}`);
      } else {
        Logger.info(`Alternate undelete affected ${updateData?.length || 0} records`);
      }
    } else {
      Logger.info(`Force undelete successful: ${JSON.stringify(data)}`);
    }
  } catch (error) {
    Logger.error(`Exception in force undelete: ${error}`);
  }
}

async function syncMarkdownFiles() {
  try {
    Logger.info('Starting markdown files synchronization');
    
    // 1. Get the repository root directory
    const repoRoot = path.resolve(process.cwd());
    Logger.debug(`Repository root: ${repoRoot}`);
    
    // 2. Update file paths to ensure they're absolute
    await updateFilePaths(repoRoot);
    
    // 3. Scan for markdown files using FileService
    Logger.info('Scanning for markdown files...');
    // Define excluded patterns
    const excludePatterns = [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/.git/**',
      '**/file_types/**',
      '**/backup/**',
      '**/archive/**',
      '**/external*/**',
      '**/external-tools/**'
    ];
    
    // Use FileService to find all markdown files
    let files: string[] = [];
    try {
      files = await fileService.findFiles({
        directory: repoRoot,
        includePatterns: ['**/*.md'],
        excludePatterns,
        recursive: true,
      });
      Logger.info(`Found ${files.length} markdown files`);
    } catch (error) {
      Logger.error(`Error finding files: ${error}`);
      files = []; // Continue with empty array
    }
    
    // 4. Get all documentation files from the database
    Logger.info('Fetching documentation files from database...');
    const { data: dbFiles, error } = await supabase
      .from('documentation_files')
      .select('id, file_path, title, file_hash, metadata, is_deleted');
    
    if (error) {
      throw new Error(`Failed to fetch documentation files: ${error.message}`);
    }
    
    Logger.info(`Found ${dbFiles.length} documentation files in database`);
    
    // 5. Process each found file
    Logger.info('Processing markdown files...');
    const now = new Date().toISOString();
    let newFiles = 0;
    let updatedFiles = 0;
    
    // Create a map of file paths to database records
    const dbFileMap = new Map<string, DocumentationFile>();
    for (const dbFile of dbFiles) {
      dbFileMap.set(dbFile.file_path, dbFile as DocumentationFile);
    }
    
    // Process each found file
    for (const filePath of files) {
      try {
        // Read file content
        const fileResult = fileService.readFile(filePath);
        
        if (!fileResult.success || !fileResult.content) {
          Logger.warn(`Failed to read file: ${filePath}`);
          continue;
        }
        
        // Calculate file hash
        const hash = calculateFileHash(fileResult.content);
        
        // Extract title from content or filename
        const title = extractTitle(fileResult.content, filePath);
        
        // Check if file exists in database
        const dbFile = dbFileMap.get(filePath);
        
        if (!dbFile) {
          // New file - add to database
          await supabase
            .from('documentation_files')
            .insert({
              file_path: filePath,
              title,
              file_hash: hash,
              metadata: {
                size: fileResult.stats?.size || 0,
                created: fileResult.stats?.modified.toISOString(),
                modified: fileResult.stats?.modified.toISOString(),
                isPrompt: isPromptFile(fileResult.content, filePath),
              },
              is_deleted: false,
              ai_generated_tags: [],
              last_modified_at: now,
              created_at: now,
              updated_at: now
            });
          newFiles++;
          Logger.debug(`Added new file: ${filePath}`);
        } else if (dbFile.file_hash !== hash || dbFile.is_deleted) {
          // File exists but has changed or was marked as deleted
          await supabase
            .from('documentation_files')
            .update({
              title,
              file_hash: hash,
              metadata: {
                size: fileResult.stats?.size || 0,
                created: fileResult.stats?.modified.toISOString(),
                modified: fileResult.stats?.modified.toISOString(),
                isPrompt: isPromptFile(fileResult.content, filePath),
              },
              is_deleted: false,
              last_modified_at: now,
              updated_at: now
            })
            .eq('id', dbFile.id);
          updatedFiles++;
          Logger.debug(`Updated file: ${filePath}`);
        }
      } catch (error) {
        Logger.error(`Error processing file ${filePath}: ${error}`);
      }
    }
    
    // 6. Mark files not found as deleted
    let deletedFiles = 0;
    
    // Get list of file paths found
    const foundFilePaths = new Set(files);
    
    // Mark files in database not found on disk as deleted
    for (const dbFile of dbFiles) {
      if (!foundFilePaths.has(dbFile.file_path) && !dbFile.is_deleted) {
        try {
          await supabase
            .from('documentation_files')
            .update({
              is_deleted: true,
              updated_at: now
            })
            .eq('id', dbFile.id);
          deletedFiles++;
          Logger.debug(`Marked file as deleted: ${dbFile.file_path}`);
        } catch (error) {
          Logger.error(`Error marking file as deleted ${dbFile.file_path}: ${error}`);
        }
      }
    }
    
    // 7. Verify the state of the documentation_files table
    await verifyDocumentationFilesState();
    
    // 8. Log statistics
    Logger.info('Synchronization statistics:');
    Logger.info(`- New files added: ${newFiles}`);
    Logger.info(`- Existing files updated: ${updatedFiles}`);
    Logger.info(`- Files marked as deleted: ${deletedFiles}`);
    Logger.info(`- Total files processed: ${files.length}`);
    
    Logger.info('Markdown files synchronization completed successfully');
  } catch (error) {
    ErrorHandler.handle(error as Error, true);
    process.exit(1);
  }
}

/**
 * Find all markdown files in the repository
 */
async function findMarkdownFiles(repoRoot: string): Promise<MarkdownFile[]> {
  try {
    // Define excluded patterns
    const excludePatterns = [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/.git/**',
      '**/file_types/**',
      '**/backup/**',
      '**/archive/**',
      '**/external*/**',
      '**/external-tools/**',
      '**/apps/dhg-improve-experts/public/prompts/enhanced-analysis-prompt.md' // Exclude problematic file
    ];
    
    // Find all markdown files
    let files: string[] = [];
    try {
      files = await fileService.findFiles({
        directory: repoRoot,
        includePatterns: ['**/*.md'],
        excludePatterns,
        recursive: true,
      });
    } catch (error) {
      Logger.error(`Error finding files: ${error}`);
      // Continue with an empty files array instead of failing completely
      Logger.info('Continuing with files that could be found');
    }
    
    // Process each file to get metadata
    const markdownFilesWithNulls = await Promise.all(
      files.map(async (filePath) => {
        try {
          // Read file content
          const fileResult = fileService.readFile(filePath);
          
          if (!fileResult.success || !fileResult.content) {
            Logger.warn(`Failed to read file: ${filePath}`);
            return null;
          }
          
          // Calculate file hash
          const hash = calculateFileHash(fileResult.content);
          
          // Extract title from content (first heading or filename)
          const title = extractTitle(fileResult.content, filePath);
          
          // Check if this is a prompt
          const isPrompt = isPromptFile(fileResult.content, filePath);
          
          return {
            file_path: filePath,
            full_path: filePath,
            title,
            hash,
            metadata: {
              size: fileResult.stats?.size || 0,
              created: fileResult.stats?.modified.toISOString(),
              modified: fileResult.stats?.modified.toISOString(),
              isPrompt,
            },
          };
        } catch (error) {
          Logger.error(`Error processing file ${filePath}:`, error);
          return null;
        }
      })
    );
    
    // Filter out null values (failed processing)
    const markdownFiles = markdownFilesWithNulls.filter((file): file is typeof file => file !== null) as MarkdownFile[];
    return markdownFiles;
  } catch (error) {
    Logger.error('Error finding markdown files:', error);
    throw error;
  }
}

/**
 * Process markdown files and sync with database
 */
async function processMarkdownFiles(markdownFiles: MarkdownFile[], dbFiles: DocumentationFile[]) {
  try {
    // Create maps for easier lookup
    const dbFileMap = new Map<string, DocumentationFile>();
    const mdFileMap = new Map<string, MarkdownFile>();
    
    // Normalize paths and populate maps
    for (const dbFile of dbFiles) {
      const normalizedPath = normalizePath(dbFile.file_path);
      dbFileMap.set(normalizedPath, dbFile);
    }
    
    for (const mdFile of markdownFiles) {
      const normalizedPath = normalizePath(mdFile.file_path);
      const relativePath = makeRelativePath(mdFile.file_path);
      
      // Update the file_path to be relative if it's an absolute path
      mdFile.file_path = relativePath;
      mdFileMap.set(normalizedPath, mdFile);
    }
    
    Logger.debug(`Normalized ${dbFileMap.size} database files and ${mdFileMap.size} markdown files`);
    
    // Track statistics
    let newFiles = 0;
    let updatedFiles = 0;
    let restoredFiles = 0;
    let deletedFiles = 0;
    let unchangedFiles = 0;
    
    // Process new and updated files (files that exist on disk)
    for (const [normalizedPath, mdFile] of mdFileMap.entries()) {
      const dbFile = dbFileMap.get(normalizedPath);
      
      if (!dbFile) {
        // New file - add to database with is_deleted = FALSE
        await addNewFile(mdFile);
        newFiles++;
      } else if (dbFile.file_hash !== mdFile.hash) {
        // File exists but has changed - update content but ensure is_deleted = FALSE
        await updateExistingFile(dbFile.id, mdFile);
        updatedFiles++;
      } else if (dbFile.is_deleted) {
        // File exists on disk but was marked as deleted in the database - restore it
        await restoreFile(dbFile.id, mdFile);
        restoredFiles++;
      } else {
        // File exists, is not deleted, and hasn't changed
        unchangedFiles++;
      }
    }
    
    // Process deleted files (files that exist in DB but not on disk)
    for (const [normalizedPath, dbFile] of dbFileMap.entries()) {
      if (!mdFileMap.has(normalizedPath)) {
        // Double-check current deletion status directly from the database
        const currentStatus = await checkFileStatus(dbFile.id);
        Logger.debug(`File ${dbFile.file_path} current deletion status from DB: ${currentStatus?.is_deleted}`);
        
        if (currentStatus && !currentStatus.is_deleted) {
          // File does not exist on disk but isn't marked as deleted in DB - mark it deleted
          await markFileAsDeleted(dbFile.id);
          deletedFiles++;
        } else {
          // Already correctly marked as deleted or couldn't determine status
          Logger.debug(`File ${dbFile.file_path} already marked as deleted or status unknown`);
          unchangedFiles++;
        }
      }
    }
    
    // Log statistics
    Logger.info('Synchronization statistics:');
    Logger.info(`- New files added: ${newFiles}`);
    Logger.info(`- Existing files updated: ${updatedFiles}`);
    Logger.info(`- Deleted files restored: ${restoredFiles}`);
    Logger.info(`- Files marked as deleted: ${deletedFiles}`);
    Logger.info(`- Unchanged files: ${unchangedFiles}`);
    Logger.info(`- Total processed: ${newFiles + updatedFiles + restoredFiles + deletedFiles + unchangedFiles}`);
  } catch (error) {
    Logger.error('Error processing markdown files:', error);
    throw error;
  }
}

/**
 * Add a new file to the database
 */
async function addNewFile(file: MarkdownFile) {
  Logger.debug(`Adding new file: ${file.file_path}`);
  
  // Create a timestamp for now
  const now = new Date().toISOString();
  
  const insertData = {
    file_path: file.file_path,
    title: file.title,
    file_hash: file.hash,
    metadata: file.metadata,
    is_deleted: false, // Explicitly set to FALSE for new files
    ai_generated_tags: [],
    last_modified_at: now, // Required field
    created_at: now,
    updated_at: now
  };
  
  // Log the data being inserted
  Logger.debug(`Insert data:`, insertData);
  
  const { data, error } = await supabase
    .from('documentation_files')
    .insert(insertData)
    .select();
  
  if (error) {
    throw new Error(`Failed to add new file ${file.file_path}: ${error.message}`);
  }
  
  // Log the actual insert result for debugging
  Logger.debug(`Insert result for ${file.file_path}:`, data);
  Logger.debug(`Successfully added ${file.file_path}, is_deleted = ${data && data.length > 0 ? data[0].is_deleted : 'unknown'}`);
}

/**
 * Update an existing file in the database
 */
async function updateExistingFile(id: string, file: MarkdownFile) {
  Logger.debug(`Updating file with ID ${id}: ${file.file_path}`);
  
  // First, make a direct update to ensure is_deleted is set to FALSE
  // This separate update focuses solely on the is_deleted flag
  Logger.debug(`First ensuring is_deleted = FALSE for file ${file.file_path}`);
  const { data: deleteUpdate, error: deleteError } = await supabase
    .from('documentation_files')
    .update({
      is_deleted: false
    })
    .eq('id', id)
    .select();
  
  if (deleteError) {
    Logger.error(`Failed to update is_deleted flag: ${deleteError.message}`);
  } else {
    Logger.debug(`is_deleted flag update result: ${deleteUpdate && deleteUpdate.length > 0 ? deleteUpdate[0].is_deleted : 'unknown'}`);
  }
  
  // Create a timestamp for now
  const now = new Date().toISOString();
  
  // Then continue with the full update
  const { data, error } = await supabase
    .from('documentation_files')
    .update({
      file_path: file.file_path,
      title: file.title,
      file_hash: file.hash,
      metadata: file.metadata,
      is_deleted: false, // Explicitly ensure is_deleted is FALSE for existing files
      last_modified_at: now,
      updated_at: now
    })
    .eq('id', id)
    .select();
  
  if (error) {
    throw new Error(`Failed to update file ${file.file_path}: ${error.message}`);
  }
  
  // Log the actual update result for debugging
  Logger.debug(`Update result for ${file.file_path}:`, data);
  Logger.debug(`Successfully updated ${file.file_path}, is_deleted = ${data && data.length > 0 ? data[0].is_deleted : 'unknown'}`);
}

/**
 * Restore a file that was previously marked as deleted
 */
async function restoreFile(id: string, file: MarkdownFile) {
  Logger.debug(`Restoring file with ID ${id}: ${file.file_path}`);
  
  // First, make a direct update to ensure is_deleted is set to FALSE
  // This separate update focuses solely on the is_deleted flag
  Logger.debug(`First ensuring is_deleted = FALSE for file ${file.file_path}`);
  const { data: deleteUpdate, error: deleteError } = await supabase
    .from('documentation_files')
    .update({
      is_deleted: false
    })
    .eq('id', id)
    .select();
  
  if (deleteError) {
    Logger.error(`Failed to update is_deleted flag: ${deleteError.message}`);
  } else {
    Logger.debug(`is_deleted flag update result: ${deleteUpdate && deleteUpdate.length > 0 ? deleteUpdate[0].is_deleted : 'unknown'}`);
  }
  
  // Create a timestamp for now
  const now = new Date().toISOString();
  
  // Then continue with the full update
  const updateData = {
    file_hash: file.hash, // Update the hash to the current version
    metadata: file.metadata, // Update metadata
    is_deleted: false, // Set is_deleted to FALSE to restore the file
    last_modified_at: now,
    updated_at: now
  };
  
  // Log the data being updated
  Logger.debug(`Restore data for ${file.file_path}:`, updateData);
  
  const { data, error } = await supabase
    .from('documentation_files')
    .update(updateData)
    .eq('id', id)
    .select();
  
  if (error) {
    throw new Error(`Failed to restore file ${file.file_path}: ${error.message}`);
  }
  
  // Log the actual update result for debugging
  Logger.debug(`Restore result for ${file.file_path}:`, data);
  Logger.debug(`Successfully restored ${file.file_path}, is_deleted = ${data && data.length > 0 ? data[0].is_deleted : 'unknown'}`);
}

/**
 * Force undelete documentation files we know should exist
 */
async function undeleteAllDocumentation() {
  Logger.info("Starting selective undelete of documentation files");
  
  // Create a timestamp for now
  const now = new Date().toISOString();
  
  // Define paths that should remain deleted
  const deletedPaths = [
    'file_types/',
    'node_modules/',
    'archive/',
    'test-documentation.md',
    'apps/dhg-improve-experts/docs/'
  ];
  
  // Define paths we know should exist and never be deleted
  const knownValidPaths = [
    'docs/project-structure/',
    'docs/git-history/',
    'docs/migrations/',
    'docs/guides/',
    'docs/readmes/',
    'docs/CLI_PIPELINE_COMMANDS.md',
    'docs/cli-workflow-pipeline.md',
    'docs/command-history-tracking.md',
    'CLAUDE.md',
    'README.md'
  ];
  
  try {
    // Get ALL documentation files
    const { data: allDocs, error: fetchError } = await supabase
      .from('documentation_files')
      .select('id, file_path, is_deleted');
    
    if (fetchError) {
      Logger.error(`Error fetching all documents: ${fetchError.message}`);
      return;
    }
    
    if (!allDocs || allDocs.length === 0) {
      Logger.info("No documents found in database");
      return;
    }
    
    // Filter to find docs that should be undeleted
    const docsToUndelete = allDocs.filter(doc => {
      // Keep deleted if the path contains any of the deletedPaths
      const shouldRemainDeleted = deletedPaths.some(path => 
        doc.file_path && doc.file_path.includes(path)
      );
      
      // Check if it's in a known valid path that should be undeleted
      const isKnownValid = knownValidPaths.some(path => 
        doc.file_path && doc.file_path.startsWith(path)
      );
      
      // Undelete only if:
      // 1. It's a known valid path that should exist AND
      // 2. Currently marked as deleted
      return isKnownValid && doc.is_deleted === true;
    });
    
    Logger.info(`Found ${docsToUndelete.length} documents that need to be undeleted out of ${allDocs.length} total`);
    
    // Undelete in batches to handle large numbers
    const batchSize = 50;
    let undeleteCount = 0;
    
    for (let i = 0; i < docsToUndelete.length; i += batchSize) {
      const batch = docsToUndelete.slice(i, i + batchSize);
      const ids = batch.map(doc => doc.id);
      
      Logger.debug(`Processing batch ${i/batchSize + 1}, size: ${batch.length}`);
      
      const { data, error } = await supabase
        .from('documentation_files')
        .update({
          is_deleted: false,
          last_modified_at: now,
          updated_at: now
        })
        .in('id', ids)
        .select();
      
      if (error) {
        Logger.error(`Error updating batch: ${error.message}`);
      } else {
        undeleteCount += data?.length || 0;
        Logger.debug(`Successfully updated ${data?.length || 0} records in batch`);
      }
    }
    
    Logger.info(`Full undelete complete. Undeleted ${undeleteCount} documents.`);
  } catch (error) {
    Logger.error(`Exception in undeleteAllDocumentation: ${error}`);
  }
}

/**
 * Force undelete known document paths - used as a fallback
 */
async function undeleteKnownDocuments() {
  Logger.info("Starting emergency undelete of known markdown documents");
  
  // Get all docs marked as deleted
  const { data: deletedDocs, error: fetchError } = await supabase
    .from('documentation_files')
    .select('id, file_path')
    .eq('is_deleted', true);
  
  if (fetchError) {
    Logger.error(`Error fetching deleted documents: ${fetchError.message}`);
    return;
  }
  
  if (!deletedDocs || deletedDocs.length === 0) {
    Logger.info("No deleted documents found");
    return;
  }
  
  Logger.info(`Found ${deletedDocs.length} deleted documents. Undeleting docs in /docs directory.`);
  
  let undeletedCount = 0;
  
  // Define valid paths that should never be marked as deleted
  const validPaths = [
    'docs/',
    'README.md',
    'CLAUDE.md',
    'prompts/'
  ];
  
  // For each path that looks like it should still exist, undelete it
  for (const doc of deletedDocs) {
    const shouldUndelete = validPaths.some(validPath => 
      doc.file_path && doc.file_path.startsWith(validPath)
    );
    
    if (shouldUndelete) {
      // This is likely a valid doc that should not be deleted
      Logger.debug(`Undeleting document: ${doc.file_path}`);
      
      try {
        // Create a timestamp for now
        const now = new Date().toISOString();
        
        // First update to just set is_deleted explicitly
        const { data, error } = await supabase
          .from('documentation_files')
          .update({ 
            is_deleted: false,
            last_modified_at: now,
            updated_at: now
          })
          .eq('id', doc.id)
          .select();
        
        if (error) {
          Logger.error(`Error undeleting ${doc.file_path}: ${error.message}`);
        } else {
          undeletedCount++;
          Logger.debug(`Successfully undeleted ${doc.file_path}, new is_deleted value: ${data && data.length > 0 ? data[0].is_deleted : 'unknown'}`);
        }
      } catch (error) {
        Logger.error(`Exception undeleting ${doc.file_path}: ${error}`);
      }
    }
  }
  
  Logger.info(`Emergency undelete complete. Undeleted ${undeletedCount} documents.`);
}

/**
 * Check if a file is already marked as deleted
 */
async function checkFileStatus(id: string): Promise<{ is_deleted: boolean; file_path: string } | null> {
  try {
    Logger.debug(`Checking current status for file ID ${id}`);
    
    const { data, error } = await supabase
      .from('documentation_files')
      .select('file_path, is_deleted')
      .eq('id', id)
      .single();
    
    if (error) {
      Logger.warn(`Could not fetch file status: ${error.message}`);
      return null;
    }
    
    Logger.debug(`Current status for file ID ${id}: is_deleted = ${data.is_deleted}`);
    return data as { is_deleted: boolean; file_path: string };
  } catch (error) {
    Logger.error(`Error checking file status: ${error}`);
    return null;
  }
}

/**
 * Mark a file as deleted in the database
 */
async function markFileAsDeleted(id: string) {
  Logger.debug(`Marking file with ID ${id} as deleted`);
  
  // Get the current file information before marking as deleted (for logging)
  const { data: fileData, error: fetchError } = await supabase
    .from('documentation_files')
    .select('file_path, is_deleted')
    .eq('id', id)
    .single();
  
  if (fetchError) {
    Logger.warn(`Could not fetch file details before marking as deleted: ${fetchError.message}`);
  } else {
    Logger.debug(`File ${fileData.file_path} current status: is_deleted = ${fileData.is_deleted}`);
  }
  
  const updateData = {
    is_deleted: true // Set is_deleted to TRUE for files that no longer exist on disk
  };
  
  // Log the data being updated
  Logger.debug(`Delete data for file ID ${id}:`, updateData);
  
  // Update the file to set is_deleted = TRUE
  const { data, error } = await supabase
    .from('documentation_files')
    .update(updateData)
    .eq('id', id)
    .select();
  
  if (error) {
    throw new Error(`Failed to mark file as deleted: ${error.message}`);
  }
  
  // Log the actual update result for debugging
  Logger.debug(`Delete result for file ID ${id}:`, data);
  
  if (fileData) {
    Logger.debug(`Successfully marked file as deleted: ${fileData.file_path}, is_deleted = ${data && data.length > 0 ? data[0].is_deleted : 'unknown'}`);
  } else {
    Logger.debug(`Successfully marked file with ID ${id} as deleted, is_deleted = ${data && data.length > 0 ? data[0].is_deleted : 'unknown'}`);
  }
}

/**
 * Calculate a hash for a file's content
 */
function calculateFileHash(content: string): string {
  const hash = crypto.createHash('md5').update(content).digest('hex');
  const contentLength = content.length.toString();
  return `${hash.slice(0, 8)}-${contentLength}`;
}

/**
 * Extract title from markdown content
 */
function extractTitle(content: string, filePath: string): string {
  // Try to find the first heading
  const headingMatch = content.match(/^#\s+(.+)$/m);
  if (headingMatch && headingMatch[1]) {
    return headingMatch[1].trim();
  }
  
  // If no heading found, use the filename
  const filename = path.basename(filePath, '.md');
  return filename
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Check if a markdown file is a prompt
 */
function isPromptFile(content: string, filePath: string): boolean {
  // Check the path for prompt-related directories
  if (filePath.includes('/prompts/') || filePath.toLowerCase().includes('prompt')) {
    return true;
  }
  
  // Check content for prompt-related keywords
  const promptKeywords = [
    'Here is a prompt template',
    'Prompt:',
    'Instruction:',
    'Instructions:',
    'You are a',
    'As an AI',
    'You will be given',
    'Given the following'
  ];
  
  return promptKeywords.some(keyword => content.includes(keyword));
}

/**
 * Normalize a file path for comparison
 */
function normalizePath(filePath: string): string {
  // Remove leading path elements up to a common point
  const normalizedPath = filePath
    .replace(/^.*?\/dhg-mono\//, '') // Remove path up to repo root
    .replace(/^\/?/, ''); // Remove leading slash if present
  
  return normalizedPath;
}

/**
 * Convert an absolute path to a relative path within the repository
 */
function makeRelativePath(filePath: string): string {
  // If it's already a relative path, return it
  if (!path.isAbsolute(filePath)) {
    return filePath;
  }
  
  // Remove path up to repo root
  const repoRootPattern = /^.*?\/dhg-mono\//;
  const match = filePath.match(repoRootPattern);
  
  if (match) {
    return filePath.replace(repoRootPattern, '');
  }
  
  // If no match found, just return the basename as a fallback
  return path.basename(filePath);
}

// Run the main function if this script is executed directly
if (require.main === module) {
  syncMarkdownFiles().catch(err => {
    Logger.error('Unhandled error:', err);
    process.exit(1);
  });
}

// Export for testing and importing
export {
  syncMarkdownFiles,
  findMarkdownFiles,
  calculateFileHash,
  extractTitle,
  isPromptFile,
  normalizePath,
  makeRelativePath
};