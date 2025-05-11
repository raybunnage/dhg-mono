#!/usr/bin/env ts-node
/**
 * Command to manage mime_type_processing configuration
 * Creates or updates processing configurations for specific MIME types
 */

import { Command } from 'commander';
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
import { commandTrackingService } from '../../../packages/shared/services/tracking-service/command-tracking-service';
import { v4 as uuidv4 } from 'uuid';

// Initialize Supabase client using the singleton pattern
const supabaseService = SupabaseClientService.getInstance();
const supabaseClient = supabaseService.getClient();

// Common file extensions and their MIME types
const extensionToMimeType: Record<string, string> = {
  'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'txt': 'text/plain',
  'pdf': 'application/pdf',
  'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'mp4': 'video/mp4'
};

/**
 * Interface for processing step configuration
 */
interface ProcessingStep {
  step: string;
  method?: string;
  options?: Record<string, any>;
  model?: string;
  prompt?: string;
  fields?: string[];
  useDocumentTypePrompt?: boolean;
}

// Default processing steps for common file types
const defaultProcessingSteps: Record<string, ProcessingStep[]> = {
  'docx': [
    {
      "step": "content_extraction",
      "method": "mammoth",
      "options": { "preserveStyles": true }
    },
    {
      "step": "ai_classification",
      "model": "claude",
      "prompt": "document-classification-prompt"
    },
    {
      "step": "metadata_extraction",
      "fields": ["title", "concepts"],
      "method": "ai"
    },
    {
      "step": "document_type_processing",
      "useDocumentTypePrompt": true
    },
    {
      "step": "save_processed_content"
    }
  ],
  'txt': [
    {
      "step": "content_extraction",
      "method": "text",
      "options": { "encoding": "utf8" }
    },
    {
      "step": "ai_classification",
      "model": "claude",
      "prompt": "document-classification-prompt"
    },
    {
      "step": "metadata_extraction",
      "fields": ["title", "concepts"],
      "method": "ai"
    },
    {
      "step": "document_type_processing",
      "useDocumentTypePrompt": true
    },
    {
      "step": "save_processed_content"
    }
  ],
  'pdf': [
    {
      "step": "content_extraction",
      "method": "pdf",
      "options": { "splitLargeFiles": true }
    },
    {
      "step": "ai_classification",
      "model": "claude",
      "prompt": "document-classification-prompt"
    },
    {
      "step": "metadata_extraction",
      "fields": ["title", "concepts"],
      "method": "ai"
    },
    {
      "step": "document_type_processing",
      "useDocumentTypePrompt": true
    },
    {
      "step": "save_processed_content"
    }
  ],
  'pptx': [
    {
      "step": "content_extraction",
      "method": "pptx",
      "options": { "extractText": true, "extractImages": false }
    },
    {
      "step": "ai_classification",
      "model": "claude",
      "prompt": "document-classification-prompt"
    },
    {
      "step": "metadata_extraction",
      "fields": ["title", "concepts"],
      "method": "ai"
    },
    {
      "step": "document_type_processing",
      "useDocumentTypePrompt": true
    },
    {
      "step": "save_processed_content"
    }
  ],
  'mp4': [
    {
      "step": "content_extraction",
      "method": "whisper",
      "options": { "model": "medium" }
    },
    {
      "step": "ai_classification",
      "model": "claude",
      "prompt": "document-classification-prompt"
    },
    {
      "step": "metadata_extraction",
      "fields": ["title", "concepts"],
      "method": "ai"
    },
    {
      "step": "document_type_processing",
      "useDocumentTypePrompt": true
    },
    {
      "step": "save_processed_content"
    }
  ]
};

// Default extraction methods for common file types
const defaultExtractionMethods: Record<string, string> = {
  'docx': 'mammoth',
  'txt': 'text',
  'pdf': 'pdf',
  'pptx': 'pptx',
  'mp4': 'whisper'
};

// Which file types require transcription
const requiresTranscription: Record<string, boolean> = {
  'docx': false,
  'txt': false,
  'pdf': false,
  'pptx': false,
  'mp4': true
};

// Default processing priorities
const defaultPriorities: Record<string, number> = {
  'docx': 50,
  'txt': 40,
  'pdf': 60,
  'pptx': 70,
  'mp4': 80
};

/**
 * Interface for the MIME type processing configuration options
 */
export interface MimeTypeProcessingOptions {
  extension: string;    // File extension (e.g., docx, txt, pdf)
  dryRun?: boolean;     // Whether to run in dry-run mode (no changes made)
  verbose?: boolean;    // Whether to output verbose details
  priority?: number;    // Processing priority (higher = higher priority)
}

/**
 * Adds or updates a MIME type processing configuration
 * @param options Configuration options
 * @returns Promise<boolean> Success indicator
 */
async function addMimeTypeProcessingConfig(options: MimeTypeProcessingOptions): Promise<boolean> {
  const { extension, dryRun = false, verbose = false, priority } = options;
  
  // Convert extension to lowercase and remove leading dot if present
  const ext = extension.toLowerCase().replace(/^\./, '');
  
  // Check if this is a supported extension
  if (!extensionToMimeType[ext]) {
    console.error(`Error: Unsupported file extension: ${ext}`);
    console.error('Supported extensions are: ' + Object.keys(extensionToMimeType).join(', '));
    return false;
  }
  
  const mimeType = extensionToMimeType[ext];
  
  console.log(`${dryRun ? '[DRY RUN] ' : ''}Configuring processing for ${ext.toUpperCase()} files (${mimeType})...`);
  
  // Track the command
  let trackingId: string;
  try {
    trackingId = await commandTrackingService.startTracking('mime_types', 'configure-processing');
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
    
    // Verify the mime_types table exists
    console.log('Testing connection with mime_types table...');
    try {
      const { data: mimeTypesTest, error: mimeTypesError } = await supabaseClient
        .from('mime_types')
        .select('id, mime_type')
        .limit(1);
        
      if (mimeTypesError) {
        throw new Error(`Error querying mime_types: ${JSON.stringify(mimeTypesError)}`);
      }
      
      if (mimeTypesTest && mimeTypesTest.length > 0) {
        console.log('✅ Successfully connected to mime_types table');
      } else {
        console.log('⚠️ mime_types table exists but may be empty. Consider running the sync command first.');
      }
    } catch (error) {
      throw new Error(`Testing mime_types table failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    
    // 1. Find the MIME type ID from mime_types table
    console.log(`Looking up MIME type ID for ${mimeType}...`);
    
    const { data: mimeTypeData, error: mimeTypeError } = await supabaseClient
      .from('mime_types')
      .select('id, mime_type')
      .eq('mime_type', mimeType)
      .single();
    
    if (mimeTypeError) {
      // If the MIME type doesn't exist, we need to create it first
      if (mimeTypeError.code === 'PGRST116' || mimeTypeError.message.includes('not found')) {
        console.log(`MIME type ${mimeType} not found in mime_types table. Please run the sync-mime-types command first.`);
        console.log('Example: ./mime-types-cli.sh sync');
        return false;
      }
      
      throw new Error(`Error looking up MIME type: ${mimeTypeError.message}`);
    }
    
    const mimeTypeId = mimeTypeData.id;
    console.log(`Found MIME type ID: ${mimeTypeId}`);
    
    // 2. Check if a processing config already exists for this MIME type
    console.log(`Checking for existing processing config for ${ext.toUpperCase()}...`);
    
    const { data: existingConfig, error: configError } = await supabaseClient
      .from('mime_type_processing')
      .select('*')
      .eq('mime_type_id', mimeTypeId);
    
    if (configError) {
      throw new Error(`Error checking for existing config: ${configError.message}`);
    }
    
    // 3. Prepare the processing configuration
    const processingConfig = {
      mime_type_id: mimeTypeId,
      extraction_method: defaultExtractionMethods[ext],
      default_processing_steps: defaultProcessingSteps[ext],
      requires_transcription: requiresTranscription[ext],
      processing_priority: priority || defaultPriorities[ext]
    };
    
    if (verbose) {
      console.log('Processing configuration:');
      console.log(JSON.stringify(processingConfig, null, 2));
    }
    
    // 4. Either update existing config or create a new one
    if (existingConfig && existingConfig.length > 0) {
      console.log(`Existing processing config found for ${ext.toUpperCase()}. Updating...`);
      
      if (!dryRun) {
        const { data: updatedConfig, error: updateError } = await supabaseClient
          .from('mime_type_processing')
          .update(processingConfig)
          .eq('mime_type_id', mimeTypeId)
          .select();
        
        if (updateError) {
          throw new Error(`Error updating processing config: ${updateError.message}`);
        }
        
        console.log(`✅ Successfully updated processing config for ${ext.toUpperCase()}`);
      } else {
        console.log(`[DRY RUN] Would update processing config for ${ext.toUpperCase()}`);
      }
    } else {
      console.log(`No existing processing config found for ${ext.toUpperCase()}. Creating new config...`);
      
      // Add a UUID for the new record
      const configWithId = {
        ...processingConfig,
        id: uuidv4()
      };
      
      if (!dryRun) {
        const { data: newConfig, error: insertError } = await supabaseClient
          .from('mime_type_processing')
          .insert(configWithId)
          .select();
        
        if (insertError) {
          throw new Error(`Error creating processing config: ${insertError.message}`);
        }
        
        console.log(`✅ Successfully created new processing config for ${ext.toUpperCase()}`);
      } else {
        console.log(`[DRY RUN] Would create new processing config for ${ext.toUpperCase()}`);
      }
    }
    
    // Complete tracking
    if (trackingId !== 'tracking-unavailable') {
      try {
        await commandTrackingService.completeTracking(trackingId, {
          recordsAffected: 1,
          summary: `${dryRun ? '[DRY RUN] ' : ''}Configured processing for ${ext.toUpperCase()} files`
        });
      } catch (error) {
        console.warn(`Warning: Unable to complete command tracking: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    
    console.log(`${dryRun ? '[DRY RUN] ' : ''}Processing configuration for ${ext.toUpperCase()} complete.`);
    return true;
    
  } catch (error) {
    console.error(`Error configuring MIME type processing: ${error instanceof Error ? error.message : String(error)}`);
    
    if (trackingId !== 'tracking-unavailable') {
      try {
        await commandTrackingService.failTracking(trackingId, `Command failed: ${error instanceof Error ? error.message : String(error)}`);
      } catch (trackingError) {
        console.warn(`Warning: Unable to record command failure: ${trackingError instanceof Error ? trackingError.message : String(trackingError)}`);
      }
    }
    
    return false;
  }
}

// Define option interface for the CLI command
interface ProcessingConfigOptions {
  dryRun?: boolean;
  verbose?: boolean;
  priority?: string;
}

// Setup CLI program for when this script is run directly
const program = new Command();

program
  .name('manage-processing-config')
  .description('Manage MIME type processing configurations');

// Direct command instead of using .argument() which may not be supported in this version
program
  .arguments('<extension>')
  .option('--dry-run', 'Show what would be done without making changes')
  .option('-v, --verbose', 'Show detailed information about the configuration')
  .option('-p, --priority <number>', 'Processing priority (higher numbers = higher priority)')
  .action((extension: string, options: ProcessingConfigOptions) => {
    addMimeTypeProcessingConfig({
      extension,
      dryRun: options.dryRun,
      verbose: options.verbose,
      priority: options.priority ? parseInt(options.priority) : undefined
    });
  });

// Run the program if this script is executed directly
if (require.main === module) {
  program.parse(process.argv);
}

// Export for module usage
export { 
  addMimeTypeProcessingConfig
};