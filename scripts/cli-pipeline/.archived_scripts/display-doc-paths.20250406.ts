#!/usr/bin/env ts-node

/**
 * SIMPLE SCRIPT TO COUNT RECORDS IN DOCUMENTATION_FILES TABLE
 * This is a minimal script that just connects and counts records
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import config from '../../packages/cli/src/utils/config';
import { Logger } from '../../packages/cli/src/utils/logger';
import { ErrorHandler } from '../../packages/cli/src/utils/error-handler';

// Load environment variables from different .env files
dotenv.config(); // Load base .env
dotenv.config({ path: path.resolve(process.cwd(), '.env.development') }); // Load environment specific
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') }); // Load local overrides

/**
 * Configuration service for CLI scripts
 * Provides a common interface for accessing configuration values
 */
class ConfigService {
  private static instance: ConfigService;
  
  // Allow manual override of values for testing
  private supabaseUrlOverride: string | null = null;
  private supabaseKeyOverride: string | null = null;
  private claudeApiKeyOverride: string | null = null;
  
  private constructor() {
    // Private constructor to ensure singleton
    Logger.info('ConfigService initialized');
  }
  
  /**
   * Get the singleton instance
   */
  public static getInstance(): ConfigService {
    if (!ConfigService.instance) {
      ConfigService.instance = new ConfigService();
    }
    return ConfigService.instance;
  }
  
  /**
   * Get Supabase URL from config or environment
   */
  public getSupabaseUrl(): string {
    // First check for override
    if (this.supabaseUrlOverride) {
      return this.supabaseUrlOverride;
    }
    
    // Then try main config utility from packages/cli
    try {
      if (config && config.supabaseUrl) {
        return config.supabaseUrl;
      }
    } catch (error) {
      Logger.warn('Could not access packages/cli config, falling back to env vars');
    }
    
    // Fall back to environment variables with priorities
    const envVars = [
      'CLI_SUPABASE_URL',
      'SUPABASE_URL',
      'VITE_SUPABASE_URL'
    ];
    
    for (const varName of envVars) {
      if (process.env[varName] && !process.env[varName]?.includes('${')) {
        return process.env[varName] as string;
      }
    }
    
    throw new Error('Supabase URL not found in config or environment variables');
  }
  
  /**
   * Get Supabase API key from config or environment
   */
  public getSupabaseKey(): string {
    // First check for override
    if (this.supabaseKeyOverride) {
      return this.supabaseKeyOverride;
    }
    
    // Then try main config utility from packages/cli
    try {
      if (config && config.supabaseKey) {
        return config.supabaseKey;
      }
    } catch (error) {
      console.warn('Could not access packages/cli config, falling back to env vars');
    }
    
    // Fall back to environment variables with priorities
    const envVars = [
      'CLI_SUPABASE_KEY',
      'SUPABASE_SERVICE_ROLE_KEY',
      'VITE_SUPABASE_SERVICE_ROLE_KEY'
    ];
    
    for (const varName of envVars) {
      if (process.env[varName] && !process.env[varName]?.includes('${')) {
        return process.env[varName] as string;
      }
    }
    
    throw new Error('Supabase API key not found in config or environment variables');
  }
  
  /**
   * Get Claude API key from config or environment
   */
  public getClaudeApiKey(): string {
    // First check for override
    if (this.claudeApiKeyOverride) {
      return this.claudeApiKeyOverride;
    }
    
    // Then try main config utility from packages/cli
    try {
      if (config && config.anthropicApiKey) {
        return config.anthropicApiKey;
      }
    } catch (error) {
      console.warn('Could not access packages/cli config, falling back to env vars');
    }
    
    // Fall back to environment variables with priorities
    const envVars = [
      'CLAUDE_API_KEY',
      'ANTHROPIC_API_KEY',
      'CLI_CLAUDE_API_KEY',
      'VITE_ANTHROPIC_API_KEY'
    ];
    
    for (const varName of envVars) {
      if (process.env[varName] && !process.env[varName]?.includes('${')) {
        return process.env[varName] as string;
      }
    }
    
    throw new Error('Claude API key not found in config or environment variables');
  }
  
  // Allow manual override for testing
  public setSupabaseUrl(url: string): void {
    this.supabaseUrlOverride = url;
  }
  
  public setSupabaseKey(key: string): void {
    this.supabaseKeyOverride = key;
  }
  
  public setClaudeApiKey(key: string): void {
    this.claudeApiKeyOverride = key;
  }
  
  public clearOverrides(): void {
    this.supabaseUrlOverride = null;
    this.supabaseKeyOverride = null;
    this.claudeApiKeyOverride = null;
  }
}
import * as fs from 'fs';
import * as readline from 'readline';
import { 
  normalizePath, 
  PathUpdate 
} from '../../packages/cli/src/services/file-management/path-normalizer';
import { 
  updateDeletionStatus, 
  DocumentationFile 
} from '../../packages/cli/src/services/file-management/status-checker';
import { 
  updateFilePaths 
} from '../../packages/cli/src/services/file-management/db-updater';
import {
  FileDiscoveryService,
  DiscoveryResult
} from '../../packages/cli/src/services/file-management/file-discovery';
import {
  DocumentTypeChecker,
  DocumentationFileWithoutType,
  DocumentTypeCheckResult
} from '../../packages/cli/src/services/document-type-checker';
import { 
  SupabaseClient, 
  SupabaseClientService, 
  getSupabaseClient 
} from '../../packages/cli/src/services/supabase-client';
import {
  PromptDocumentClassifier,
  DocumentTypeAssignment
} from '../../packages/cli/src/services/prompt-document-classifier';
import { ClaudeService } from '../../packages/cli/src/services/claude-service';
import { FileService } from '../../packages/cli/src/services/file-service';
import {
  DocumentClassificationService,
  ClassificationResult,
  DocumentInfo
} from '../../packages/cli/src/services/document-classification-service';
import { 
  PromptQueryService,
  PromptQueryResult,
  Prompt
} from '../../packages/cli/src/services/prompt-query-service';

/**
 * Prompt the user to confirm they want to update the file paths
 */
async function promptUserForUpdate(paths: Array<PathUpdate>): Promise<boolean> {
  // Display sample of changes
  console.log('\nSample of path changes:');
  console.log('-----------------------');
  
  // Show at most 5 examples
  const sampleSize = Math.min(paths.length, 5);
  for (let i = 0; i < sampleSize; i++) {
    console.log(`Original: ${paths[i].originalPath}`);
    console.log(`    New: ${paths[i].normalizedPath}`);
    console.log('');
  }
  
  if (paths.length > sampleSize) {
    console.log(`...and ${paths.length - sampleSize} more paths`);
  }
  
  // Create readline interface
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise((resolve) => {
    rl.question(`\nDo you want to update ${paths.length} file paths in the database? (y/n): `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

/**
 * Prompt the user to confirm they want to check file existence and update deletion status
 */
async function promptUserForDeletionCheck(): Promise<boolean> {
  // Create readline interface
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  console.log('\n=== CHECK FILE EXISTENCE AND UPDATE DELETION STATUS ===');
  console.log('This will:');
  console.log('1. Check each file path to see if the file exists on disk');
  console.log('2. Set is_deleted = FALSE for files that exist');
  console.log('3. Set is_deleted = TRUE for files that don\'t exist');
  console.log('This helps maintain accurate file tracking in the database.');
  
  return new Promise((resolve) => {
    rl.question(`\nDo you want to check file existence and update deletion status? (y/n): `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

/**
 * Check for files without document type assignments using execute_sql RPC
 * @returns Promise<{success: boolean, error?: string, filesWithoutType?: number}>
 */
async function checkFilesWithoutDocumentType(): Promise<{success: boolean, error?: string, filesWithoutType?: number}> {
  console.log('\n=== CHECKING FOR FILES WITHOUT DOCUMENT TYPE ASSIGNMENTS ===');
  
  try {
    // Initialize Supabase connection
    console.log('Initializing Supabase connection...');
    const supabase = await initSupabaseConnection();
    
    // Initialize our shared PromptQueryService
    console.log('Initializing shared PromptQueryService...');
    const configService = ConfigService.getInstance();
    const supabaseUrl = configService.getSupabaseUrl();
    const supabaseKey = configService.getSupabaseKey();
    
    if (!supabaseUrl || !supabaseUrl.startsWith('http')) {
      return {
        success: false,
        error: `Invalid Supabase URL: URL must start with http:// or https://`
      };
    }
    
    if (!supabaseKey) {
      return {
        success: false,
        error: 'Missing Supabase API key'
      };
    }
    
    const promptQueryService = new PromptQueryService(supabaseUrl, supabaseKey);
    
    console.log('Using PromptQueryService to execute queries...');
    
    // First, get counts using execute_sql RPC
    const totalFilesQuery = `
      SELECT COUNT(*) as count
      FROM documentation_files
      WHERE is_deleted = false
    `;
    
    const filesWithTypeQuery = `
      SELECT COUNT(*) as count
      FROM documentation_files
      WHERE is_deleted = false AND document_type_id IS NOT NULL
    `;
    
    const filesWithoutTypeQuery = `
      SELECT COUNT(*) as count
      FROM documentation_files
      WHERE is_deleted = false AND document_type_id IS NULL
    `;
    
    const unassignedFilesQuery = `
      SELECT id, file_path, title, summary, created_at, updated_at
      FROM documentation_files
      WHERE is_deleted = false AND document_type_id IS NULL
      ORDER BY file_path
    `;
    
    // Execute queries using our shared PromptQueryService
    console.log('Running count queries using shared PromptQueryService...');
    console.log('DEBUG: Using shared PromptQueryService with the following queries:');
    console.log(`1. Total files query: ${totalFilesQuery}`);
    console.log(`2. Files with type query: ${filesWithTypeQuery}`);
    console.log(`3. Files without type query: ${filesWithoutTypeQuery}`);
    console.log(`4. Unassigned files query: ${unassignedFilesQuery}`);
    
    // Get total files count
    console.log('\nExecuting total files count query...');
    const totalData: any[] | null = await promptQueryService.executeQuery(totalFilesQuery);
    
    if (!totalData) {
      console.error('Error getting total count: No data returned from query');
      return {
        success: false,
        error: 'Error getting total count: No data returned from query'
      };
    }
    
    console.log(`DEBUG: Total files query response: ${JSON.stringify(totalData)}`);
    const totalFiles = totalData && totalData[0] ? parseInt(totalData[0].count, 10) : 0;
    console.log(`DEBUG: Parsed total files count: ${totalFiles}`);
    
    // Get files with type count
    console.log('\nExecuting files with type count query...');
    const withTypeData: any[] | null = await promptQueryService.executeQuery(filesWithTypeQuery);
    
    if (!withTypeData) {
      console.error('Error getting with-type count: No data returned from query');
      return {
        success: false,
        error: 'Error getting with-type count: No data returned from query'
      };
    }
    
    console.log(`DEBUG: Files with type query response: ${JSON.stringify(withTypeData)}`);
    const filesWithType = withTypeData && withTypeData[0] ? parseInt(withTypeData[0].count, 10) : 0;
    console.log(`DEBUG: Parsed files with type count: ${filesWithType}`);
    
    // Get files without type count
    console.log('\nExecuting files without type count query...');
    const withoutTypeData: any[] | null = await promptQueryService.executeQuery(filesWithoutTypeQuery);
    
    if (!withoutTypeData) {
      console.error('Error getting without-type count: No data returned from query');
      return {
        success: false,
        error: 'Error getting without-type count: No data returned from query'
      };
    }
    
    console.log(`DEBUG: Files without type query response: ${JSON.stringify(withoutTypeData)}`);
    const filesWithoutType = withoutTypeData && withoutTypeData[0] ? parseInt(withoutTypeData[0].count, 10) : 0;
    console.log(`DEBUG: Parsed files without type count: ${filesWithoutType}`);
    
    // Get the actual files without document types
    console.log('\nFetching files without document types...');
    const unassignedFiles: any[] | null = await promptQueryService.executeQuery(unassignedFilesQuery);
    
    if (!unassignedFiles) {
      console.error('Error getting unassigned files: No data returned from query');
      return {
        success: false,
        error: 'Error getting unassigned files: No data returned from query'
      };
    }
    
    console.log(`DEBUG: Unassigned files query response received, found: ${unassignedFiles ? unassignedFiles.length : 0} records`);
    if (unassignedFiles) {
      console.log(`DEBUG: First record (if any): ${unassignedFiles.length > 0 ? JSON.stringify(unassignedFiles[0]) : 'No records'}`);
    }
    
    // Display statistics
    console.log('\nDOCUMENTATION FILES DOCUMENT TYPE ASSIGNMENT STATS:');
    console.log('--------------------------------------------------------------');
    console.log(`Total active files: ${totalFiles}`);
    console.log(`Files with document type assigned: ${filesWithType}`);
    console.log(`Files WITHOUT document type assigned: ${filesWithoutType}`);
    console.log(`Assignment percentage: ${totalFiles > 0 ? Math.round((filesWithType / totalFiles) * 100) : 0}%`);
    console.log('--------------------------------------------------------------');
    
    if (totalFiles === 0) {
      console.log('\n⚠️ No documentation files found in the database.');
      return {
        success: true,
        filesWithoutType: 0
      };
    }
    
    if (filesWithoutType === 0) {
      console.log('\n✅ Great! All documentation files have document types assigned!');
      return {
        success: true,
        filesWithoutType: 0
      };
    }
    
    // Display files without document types
    console.log('\nFILES MISSING DOCUMENT TYPE ASSIGNMENTS:');
    console.log('--------------------------------------------------------------');
    
    // Check if we got results from the SQL query
    if (unassignedFiles && unassignedFiles.length > 0) {
      console.log('ID | FILE PATH | TITLE');
      console.log('--------------------------------------------------------------');
      
      unassignedFiles.forEach((file: DocumentationFileWithoutType, index: number) => {
        console.log(`${index + 1}. ${file.id} | ${file.file_path} | ${file.title || '[No Title]'}`);
      });
      
      console.log('--------------------------------------------------------------');
      console.log(`Total: ${unassignedFiles.length} files without document type assignments`);
    } else {
      console.log(`No files found in RPC query results, but count query indicated ${filesWithoutType} files without types.`);
      console.log('\nTrying alternative approach with standard Supabase query...');
      
      // Fallback to standard Supabase query
      try {
        // Use standard Supabase direct query as fallback
        const { data: directQueryFiles, error: directQueryError } = await supabase
          .from('documentation_files')
          .select('id, file_path, title, summary, created_at, updated_at')
          .is('document_type_id', null)
          .eq('is_deleted', false)
          .order('file_path');
          
        if (directQueryError) {
          console.error(`Error in direct query fallback: ${directQueryError.message}`);
        } else if (directQueryFiles && directQueryFiles.length > 0) {
          console.log('Results from direct Supabase query without RPC:');
          console.log('ID | FILE PATH | TITLE');
          console.log('--------------------------------------------------------------');
          
          directQueryFiles.forEach((file: DocumentationFileWithoutType, index: number) => {
            console.log(`${index + 1}. ${file.id} | ${file.file_path} | ${file.title || '[No Title]'}`);
          });
          
          console.log('--------------------------------------------------------------');
          console.log(`Total: ${directQueryFiles.length} files without document type assignments (from direct query)`);
        } else {
          console.log('No files found using direct query approach either.');
          console.log(`This is unusual because count query indicated ${filesWithoutType} files without types.`);
          console.log('Logging SQL queries for debugging:');
          console.log(`Total files query: ${totalFilesQuery}`);
          console.log(`Files without type query: ${filesWithoutTypeQuery}`);
          console.log(`Unassigned files query: ${unassignedFilesQuery}`);
        }
      } catch (fallbackError) {
        console.error('Error in fallback query approach:', fallbackError instanceof Error ? fallbackError.message : 'Unknown error');
      }
    }
    
    console.log('--------------------------------------------------------------');
    console.log('\nTo assign document types to these files, you can:');
    console.log('1. Use the documentation UI in the web interface');
    console.log('2. Run the documentation processor: packages/cli/src/commands/documentation-processor.ts');
    console.log('3. Use the ClassifyDocument AI tool to automatically classify these files');
    console.log('4. Automatically assign document types using Claude 3.7 (option 5 in the main menu)');
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('\nError checking files without document types:', errorMessage);
    return {
      success: false,
      error: errorMessage
    };
  }
  
  return {
    success: true,
    filesWithoutType: 0 // Default value when no error but count couldn't be determined
  };
}

/**
 * Prompt the user to confirm they want to add the discovered files to the database
 */
async function promptUserForFileAddition(files: DiscoveryResult): Promise<boolean> {
  // Create readline interface
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  console.log('\n=== ADD NEW DOCUMENTATION FILES TO DATABASE ===');
  console.log(`Found ${files.newFiles.length} new documentation files that are not in the database.`);
  console.log('This will:');
  console.log('1. Add each file to the documentation_files table');
  console.log('2. Extract titles and summaries from the files');
  console.log('3. Calculate file hashes and gather metadata');
  
  if (files.newFiles.length === 0) {
    console.log('\nNo new files to add. All documentation files are already in the database.');
    rl.close();
    return false;
  }
  
  // Display a sample of the files that will be added
  console.log('\nSample of files that will be added:');
  console.log('----------------------------------');
  
  const sampleSize = Math.min(files.newFiles.length, 10);
  for (let i = 0; i < sampleSize; i++) {
    console.log(`${i + 1}. ${files.newFiles[i].file_path}`);
    if (files.newFiles[i].title) {
      console.log(`   Title: ${files.newFiles[i].title}`);
    }
  }
  
  if (files.newFiles.length > sampleSize) {
    console.log(`... and ${files.newFiles.length - sampleSize} more files`);
  }
  
  return new Promise((resolve) => {
    rl.question(`\nDo you want to add these ${files.newFiles.length} files to the database? (y/n): `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

/**
 * Discover new documentation files and add them to the database
 */
async function discoverAndAddNewFiles(): Promise<void> {
  console.log('\n=== DISCOVERING NEW DOCUMENTATION FILES ===');
  
  try {
    // Initialize Supabase connection
    const supabase = await initSupabaseConnection();
    
    // Create file discovery service
    const discoveryService = new FileDiscoveryService(supabase);
    
    // First discover files without inserting them
    console.log('Scanning project for documentation files...');
    const discoveryResult = await discoveryService.discoverNewFiles(false);
    
    // Display stats
    console.log('\nDISCOVERY RESULTS:');
    console.log(`- Total files scanned: ${discoveryResult.totalScanned}`);
    console.log(`- Existing files in database: ${discoveryResult.existingCount}`);
    console.log(`- New files discovered: ${discoveryResult.newFiles.length}`);
    
    if (discoveryResult.errors.length > 0) {
      console.log('\nErrors encountered during discovery:');
      discoveryResult.errors.forEach((error, index) => {
        console.log(`${index + 1}. ${error}`);
      });
    }
    
    // Prompt user to add files to database
    const shouldAddFiles = await promptUserForFileAddition(discoveryResult);
    
    if (shouldAddFiles) {
      console.log('\nAdding files to database...');
      const insertResult = await discoveryService.discoverNewFiles(true);
      
      console.log('\nINSERT RESULTS:');
      console.log(`- Files successfully added: ${insertResult.newFiles.length}`);
      
      if (insertResult.errors.length > 0) {
        console.log('\nErrors encountered during insertion:');
        insertResult.errors.forEach((error, index) => {
          console.log(`${index + 1}. ${error}`);
        });
      }
    } else {
      console.log('\nNo files were added to the database.');
    }
  } catch (error) {
    console.error('\nError discovering and adding files:', error instanceof Error ? error.message : 'Unknown error');
  }
}

/**
 * Process a single document (the newest) with Claude 3.7
 * @returns Promise<{success: boolean, error?: string, documentUpdated?: boolean}>
 */
async function processDocumentsWithoutTypes(): Promise<{success: boolean, error?: string, documentUpdated?: boolean}> {
  console.log('\n=== PROCESS NEWEST DOCUMENT WITH CLAUDE 3.7 ===');
  
  try {
    // Initialize Supabase connection
    console.log('Initializing Supabase connection...');
    const supabase = await initSupabaseConnection();
    
    // Get configuration values from our singleton ConfigService
    const configService = ConfigService.getInstance();
    
    // Get configuration values from ConfigService
    const claudeApiKey = configService.getClaudeApiKey();
    const supabaseUrl = configService.getSupabaseUrl();
    const supabaseKey = configService.getSupabaseKey();
    
    // Initialize our shared PromptQueryService - will be used by the DocumentClassificationService
    console.log('Initializing shared PromptQueryService...');
    const promptQueryService = new PromptQueryService(supabaseUrl, supabaseKey);
    
    // Prompt for classification prompt name
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    // Display information to the user
    console.log('\nThis will use Claude 3.7 to classify the newest document, regardless of its current document type assignment.');
    console.log('You will need to provide the name of the classification prompt to use.');
    console.log('Recommended prompt: markdown-document-classification-prompt');
    console.log('\nNOTE: This process will:');
    console.log('1. Retrieve the specified prompt and its related document types');
    console.log('2. Run the newest document through Claude 3.7');
    console.log('3. Display the classification result (will NOT update the database)');
    
    const promptName = await new Promise<string>((resolve) => {
      rl.question('\nEnter the prompt name to use for classification [markdown-document-classification-prompt]: ', (answer) => {
        rl.close();
        resolve(answer.trim() || 'markdown-document-classification-prompt');
      });
    });
    
    console.log(`\nProcessing the newest document using prompt: ${promptName}`);
    
    // First, check if the prompt exists using our shared service
    console.log(`Looking up prompt with shared PromptQueryService: ${promptName}`);
    const promptResult: PromptQueryResult = await promptQueryService.getPromptWithQueryResults(promptName);
    
    if (!promptResult.prompt) {
      console.error(`Prompt not found: ${promptName}`);
      if (promptResult.error) {
        console.error(`Error: ${promptResult.error}`);
      }
      return {
        success: false,
        error: `Prompt not found: ${promptName}`,
        documentUpdated: false
      };
    }
    
    console.log(`✅ Found prompt in database: ${promptName}`);
    if (promptResult.databaseQueryResults) {
      console.log(`✅ Successfully executed database query - found ${promptResult.databaseQueryResults.length} document types`);
    }
    
    // Initialize the document classification service
    // Use values from the ConfigService instead of direct env vars
    const classificationService = new DocumentClassificationService(
      supabase, 
      claudeApiKey,
      supabaseUrl,
      supabaseKey
    );
    
    // Get the newest document
    console.log('\nFetching the newest document...');
    const newestDocument = await classificationService.getNewestDocument();
    
    if (!newestDocument) {
      console.error('Failed to find any documents in the database');
      return {
        success: false,
        error: 'Failed to find any documents in the database'
      };
    }
    
    console.log('\n=== NEWEST DOCUMENT DETAILS ===');
    console.log(`ID: ${newestDocument.id}`);
    console.log(`Path: ${newestDocument.file_path}`);
    console.log(`Title: ${newestDocument.title || '[No Title]'}`);
    console.log(`Current Document Type ID: ${newestDocument.document_type_id || '[None]'}`);
    
    // Perform the classification with debug output
    console.log(`\nClassifying document using prompt: ${promptName}`);
    console.log('This process will connect to Claude 3.7 API and may take a few moments...');
    
    // These are all handled by the service now
    const result = await classificationService.classifyDocument(
      newestDocument.file_path,
      promptName,
      false // do not output to markdown
    );
    
    if (!result.success) {
      console.error(`\nError classifying document: ${result.error}`);
      return {
        success: false,
        error: `Error classifying document: ${result.error}`,
        documentUpdated: false
      };
    }
    
    // Display the raw API response for debugging
    console.log('\n=== RAW CLAUDE API RESPONSE ===');
    console.log(JSON.stringify(result.rawResponse, null, 2));
    
    // Display the extracted JSON result
    console.log('\n=== CLASSIFICATION RESULT ===');
    console.log(JSON.stringify(result.jsonResponse, null, 2));
    
    // Display the comparison
    console.log('\n=== CLASSIFICATION COMPARISON ===');
    console.log(`Current document_type_id: ${newestDocument.document_type_id || '[None]'}`);
    console.log(`Claude's document_type_id: ${result.document_type_id}`);
    console.log(`Claude's document_type_name: ${result.document_type_name}`);
    console.log(`Claude's confidence: ${result.confidence}`);
    
    console.log('\nDocument classification complete. No changes were made to the database.');
    
    // Offer to update the document type
    const updateRl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    const shouldUpdate = await new Promise<boolean>((resolve) => {
      updateRl.question('\nWould you like to update the document type in the database? (y/n): ', (answer) => {
        updateRl.close();
        resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
      });
    });
    
    if (shouldUpdate && result.document_type_id) {
      console.log(`\nUpdating document type to ${result.document_type_name} (${result.document_type_id})...`);
      const updateResult = await classificationService.updateDocumentType(
        newestDocument.id,
        result.document_type_id
      );
      
      if (updateResult.success) {
        console.log('✅ Document type updated successfully!');
        return {
          success: true,
          documentUpdated: true
        };
      } else {
        console.error(`❌ Failed to update document type: ${updateResult.error}`);
        return {
          success: false,
          error: updateResult.error,
          documentUpdated: false
        };
      }
    } else {
      console.log('No changes made to the database.');
      return {
        success: true,
        documentUpdated: false
      };
    }
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('\nError processing document:', errorMessage);
    if (error instanceof Error && error.stack) {
      console.error('Stack trace:', error.stack);
    }
    return {
      success: false,
      error: errorMessage,
      documentUpdated: false
    };
  }
  
  return {
    success: true,
    documentUpdated: false // Default to false unless explicitly set to true in the function
  };
}

/**
 * Count documentation files and check for path normalization issues
 * @returns Promise<{success: boolean, error?: string, count?: number}>
 */
async function countDocumentationFiles(): Promise<{success: boolean, error?: string, count?: number}> {
  const pathsToUpdate: PathUpdate[] = [];
  
  try {
    // Use our improved connection function
    console.log('Initializing Supabase connection...');
    let supabase;
    
    try {
      // Use the initSupabaseConnection function we defined
      supabase = await initSupabaseConnection();
      console.log('✅ Successfully connected to Supabase!');
    } catch (error) {
      console.error('❌ Failed to connect to Supabase:');
      console.error(error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
    
    console.log('\n✅ Connected to Supabase successfully!');
    
    // Try table access
    try {
      // JUST GET THE COUNT of records in documentation_files
      console.log('Counting records in documentation_files table...');
      const { count, error } = await supabase
        .from('documentation_files')
        .select('*', { count: 'exact', head: true });
  
      if (error) {
        console.error(`Error counting records: ${error.message}`);
        
        // Try a different table to see if it's specific to documentation_files
        console.log('\nTrying to access a different table to verify database access...');
        const { error: otherError } = await supabase
          .from('document_types')
          .select('*', { count: 'exact', head: true });
          
        if (otherError) {
          console.error(`Error accessing document_types: ${otherError.message}`);
          console.error('Database access appears to be completely broken.');
        } else {
          console.error('document_types table is accessible, but documentation_files is not.');
          console.error('This suggests documentation_files table might not exist or have permission issues.');
        }
        
        process.exit(1);
      }
  
      console.log('----------------------------------------');
      console.log(`✅ RECORDS FOUND IN DOCUMENTATION_FILES: ${count}`);
      console.log('----------------------------------------');
  
      // Success! Now if we have records, let's first check the structure
      if (count && count > 0) {
        console.log('Fetching first record to verify structure...');
        const { data: sampleData, error: recordError } = await supabase
          .from('documentation_files')
          .select('*')
          .limit(1)
          .single();
  
        if (recordError) {
          console.error(`Error fetching sample record: ${recordError.message}`);
        } else if (sampleData) {
          console.log('Sample record columns:');
          Object.keys(sampleData).forEach(key => {
            const value = sampleData[key];
            console.log(`- ${key}: ${typeof value} ${value ? '(has value)' : '(empty)'}`);
          });
          
          // Specifically check for file_path and is_deleted fields
          const hasFilePath = 'file_path' in sampleData;
          const hasIsDeleted = 'is_deleted' in sampleData;
          
          if (hasFilePath) {
            console.log(`\n✅ FILE_PATH COLUMN EXISTS: ${sampleData.file_path ? sampleData.file_path : 'Empty value'}`);
          } else {
            console.log('\n❌ FILE_PATH COLUMN MISSING!');
          }
          
          if (hasIsDeleted) {
            console.log(`✅ IS_DELETED COLUMN EXISTS: ${sampleData.is_deleted !== undefined ? String(sampleData.is_deleted) : 'Empty value'}`);
          } else {
            console.log('❌ IS_DELETED COLUMN MISSING!');
          }
          
          // Now fetch and display all file paths with their is_deleted status
          console.log('\n=== ALL FILE PATHS WITH DELETION STATUS ===');
          
          // Determine query based on available columns
          let selectQuery = 'id, file_path';
          if (hasIsDeleted) {
            selectQuery += ', is_deleted';
          }
          
          const { data: allPaths, error: allPathsError } = await supabase
            .from('documentation_files')
            .select(selectQuery)
            .order('file_path');
            
          if (allPathsError) {
            console.error(`Error fetching all paths: ${allPathsError.message}`);
          } else if (allPaths && allPaths.length > 0) {
            console.log('FILE PATH | IS_DELETED');
            console.log('-------------------------------');
            
            // Store all records for checking file existence later
            const allRecords: DocumentationFile[] = [];
            
            // Type the records properly but safely
            if (Array.isArray(allPaths)) {
              allPaths.forEach((record: any) => {
                const originalPath = record.file_path;
                const normalizedPath = normalizePath(originalPath);
                
                if (normalizedPath !== originalPath && record.id) {
                  pathsToUpdate.push({
                    id: record.id,
                    originalPath,
                    normalizedPath
                  });
                }
                
                console.log(`${normalizedPath || '[empty]'} | ${record.is_deleted === true ? 'DELETED' : 'active'}`);
                
                allRecords.push({
                  id: record.id,
                  file_path: normalizedPath,
                  is_deleted: record.is_deleted
                });
              });
            }
            
            console.log('-------------------------------');
            console.log(`Total: ${allPaths.length} file paths displayed.`);
            
            // Use the services for updates
            if (pathsToUpdate.length > 0) {
              console.log(`\n${pathsToUpdate.length} paths need normalization in the database.`);
              
              const shouldUpdate = await promptUserForUpdate(pathsToUpdate);
              if (shouldUpdate) {
                console.log('\nUpdating file paths in the database...');
                const result = await updateFilePaths(supabase, pathsToUpdate);
                
                console.log('\nUpdate complete!');
                console.log(`- Successfully updated: ${result.successCount} records`);
                if (result.failureCount > 0) {
                  console.log(`- Failed to update: ${result.failureCount} records`);
                }
                
                // Update the normalized paths in our records for the next check
                for (const update of pathsToUpdate) {
                  const record = allRecords.find(r => r.id === update.id);
                  if (record) {
                    record.file_path = update.normalizedPath;
                  }
                }
              }
            } else {
              console.log('\nAll file paths are already normalized. No updates needed.');
            }
            
            // Use the status checker service
            const shouldCheckExistence = await promptUserForDeletionCheck();
            if (shouldCheckExistence) {
              const result = await updateDeletionStatus(supabase, allRecords);
              
              // Verify the database counts after update
              try {
                console.log('\nVerifying database counts after update...');
                const { count: activeCount, error: activeError } = await supabase
                  .from('documentation_files')
                  .select('*', { count: 'exact', head: true })
                  .eq('is_deleted', false);
                  
                if (activeError) {
                  console.error(`Error counting active records: ${activeError.message}`);
                } else {
                  console.log(`- Active records (is_deleted = FALSE): ${activeCount || 0}`);
                }
                
                const { count: deletedCount, error: deletedError } = await supabase
                  .from('documentation_files')
                  .select('*', { count: 'exact', head: true })
                  .eq('is_deleted', true);
                  
                if (deletedError) {
                  console.error(`Error counting deleted records: ${deletedError.message}`);
                } else {
                  console.log(`- Deleted records (is_deleted = TRUE): ${deletedCount || 0}`);
                }
                
                if (activeCount !== null && deletedCount !== null) {
                  const total = (activeCount || 0) + (deletedCount || 0);
                  console.log(`- Total records: ${total}`);
                  
                  if (total === result.existingCount + result.missingCount) {
                    console.log('✅ Database counts match our processed counts - SUCCESS!');
                  } else {
                    console.log('❌ Database counts do not match our processed counts:');
                    console.log(`   Processed: ${result.existingCount + result.missingCount}, Database total: ${total}`);
                  }
                }
              } catch (error) {
                console.error('Error verifying database counts:', error instanceof Error ? error.message : 'Unknown error');
              }
            }
          } else {
            console.log('No file paths found to display.');
          }
        }
      }
    } catch (dbError) {
      console.error('Unexpected database error:', dbError instanceof Error ? dbError.message : 'Unknown error');
      process.exit(1);
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Unexpected error:', errorMessage);
    return {
      success: false,
      error: errorMessage
    };
  }
  
  return {
    success: true
  };
}

/**
 * Prompt user to choose an action from the menu
 * @returns Promise<string> The user's choice
 */
async function promptForAction(): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  Logger.info('\n=== CHOOSE AN ACTION ===');
  console.log('1. Count and verify documentation files');
  console.log('2. Check file existence and update deletion status');
  console.log('3. Discover and add new documentation files');
  console.log('4. Check files without document type assignments');
  console.log('5. Process documents without types using Claude 3.7');
  console.log('6. Exit');
  console.log();
  console.log('Note: Document organization features have been moved to:');
  console.log('packages/cli/src/services/document-organization');
  console.log('Use packages/cli/src/scripts/organize-docs.ts for organization tasks.');
  
  return new Promise((resolve) => {
    rl.question('\nEnter your choice (1-6): ', (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

/**
 * Initialize the Supabase connection using the singleton pattern
 * Leverages the shared SupabaseClientService from packages/cli
 * @returns Promise<SupabaseClient>
 */
async function initSupabaseConnection(): Promise<SupabaseClient> {
  Logger.info('Initializing database connection using shared SupabaseClientService...');
  
  // Get the singleton instance
  const supabaseService = SupabaseClientService.getInstance();
  
  // Check if the client is already initialized
  if (supabaseService.isInitialized()) {
    Logger.info('Using existing Supabase client from singleton');
    return supabaseService.getClient(false);
  }
  
  try {
    // Try to initialize from environment
    const client = supabaseService.initializeFromEnv();
    
    if (!client) {
      throw new Error('Failed to initialize Supabase client from environment variables');
    }
    
    // Test the connection
    console.log('Testing connection...');
    const connectionTest = await supabaseService.testConnection();
    
    if (!connectionTest.success) {
      throw new Error(`Connection test failed: ${connectionTest.error}`);
    }
    
    console.log('✅ Connection successful!');
    return client;
  } catch (error) {
    // If automatic initialization fails, try manual initialization with detailed logging
    console.error('Automatic initialization failed, trying manual initialization');
    
    // Debug environment variables
    console.log('\nDEBUGGING ENVIRONMENT VARIABLES:');
    console.log(`SUPABASE_URL: ${process.env.SUPABASE_URL || '[NOT SET]'}`);
    console.log(`CLI_SUPABASE_URL: ${process.env.CLI_SUPABASE_URL || '[NOT SET]'}`);
    console.log(`SUPABASE_SERVICE_ROLE_KEY: ${process.env.SUPABASE_SERVICE_ROLE_KEY ? '[SET]' : '[NOT SET]'}`);
    console.log(`CLI_SUPABASE_KEY: ${process.env.CLI_SUPABASE_KEY ? '[SET]' : '[NOT SET]'}`);
    
    // Use ConfigService to get credentials
    const config = ConfigService.getInstance();
    const supabaseUrl = config.getSupabaseUrl();
    const supabaseKey = config.getSupabaseKey();
    
    // Initialize the client directly
    if (!supabaseUrl || !supabaseUrl.startsWith('http')) {
      throw new Error(`Invalid Supabase URL: ${supabaseUrl}. It must start with http:// or https://`);
    }
    
    if (!supabaseKey) {
      throw new Error('Missing Supabase API key');
    }
    
    const client = supabaseService.initialize(supabaseUrl, supabaseKey);
    
    // Test the connection
    const connectionTest = await supabaseService.testConnection();
    if (!connectionTest.success) {
      console.error(`Connection test failed: ${connectionTest.error}`);
      if (connectionTest.details) {
        console.error('Error details:', connectionTest.details);
      }
      throw new Error(`Failed to connect to Supabase: ${connectionTest.error}`);
    }
    
    console.log('✅ Connection successful!');
    return client;
  }
}

// Run the function with menu
async function main() {
  try {
    // Initialize a shared Supabase client that we'll reuse - singleton pattern
    // Proper typed variable with clear initialization state
    let supabase: SupabaseClient | undefined;
    let exit = false;
    
    // Log startup with appropriate level
    Logger.info('Starting documentation management script');
    
    while (!exit) {
      const choice = await promptForAction();
      
      switch (choice) {
        case '1':
          // Use typed return values for consistent error handling
          const countResult = await countDocumentationFiles();
          if (!countResult.success) {
            Logger.error(`Failed to count documentation files: ${countResult.error}`);
          }
          break;
          
        case '2':
          try {
            // Use the singleton pattern from SupabaseClientService for connection management
            if (!supabase) {
              // Get supabase client through proper initialization
              supabase = await initSupabaseConnection();
            }
            
            // Get all active records
            const { data: records, error } = await supabase
              .from('documentation_files')
              .select('*');
              
            if (error) {
              Logger.error(`Error fetching records: ${error.message}`);
            } else if (records) {
              // Call service with proper error handling
              await updateDeletionStatus(supabase, records);
            }
          } catch (error) {
            // Use Logger instead of console.error
            Logger.error('Error updating deletion status:', error instanceof Error ? error.message : 'Unknown error');
            ErrorHandler.handle(error as Error);
          }
          break;
          
        case '3':
          // Discover and add new documentation files
          await discoverAndAddNewFiles();
          break;
          
        case '4':
          // Check files without document type assignments
          // Proper typed return values and consistent error handling
          const checkResult = await checkFilesWithoutDocumentType();
          if (!checkResult.success) {
            Logger.error(`Failed to check for files without document types: ${checkResult.error}`);
          } else {
            Logger.info(`Found ${checkResult.filesWithoutType || 0} files without document types`);
          }
          break;
          
        case '5':
          // Process documents without types using Claude 3.7
          // Use typed result with consistent error handling pattern
          const processResult = await processDocumentsWithoutTypes();
          if (!processResult.success) {
            Logger.error(`Failed to process documents: ${processResult.error}`);
          } else if (processResult.documentUpdated) {
            Logger.info('✅ Successfully updated document type in database');
          }
          break;
          
        case '6':
          Logger.info('Exiting script...');
          exit = true;
          break;
          
        default:
          Logger.warn('Invalid choice, please try again.');
      }
    }
  } catch (error) {
    // Use the shared ErrorHandler utility for consistent error handling
    ErrorHandler.handle(error as Error);
    process.exit(1);
  }
}

// Run the main function
main()
  .then(() => Logger.info('Script completed successfully'))
  .catch(error => {
    // Use ErrorHandler from utilities
    ErrorHandler.handle(error as Error);
    process.exit(1);
  });