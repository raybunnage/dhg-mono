/**
 * Manage Presentations command for the Media Processing CLI Pipeline
 * Manage presentations that use summaries
 */

import { Logger } from '../../../../packages/shared/utils';
import { SupabaseService } from '../../../../packages/shared/services/supabase-service/supabase-service';
import { createTable } from '../../../../packages/shared/utils/table';

// Define interfaces
interface ManagePresentationsOptions {
  list?: boolean;
  create?: boolean;
  update?: string;
  delete?: string;
  title?: string;
  description?: string;
  expert?: string;
  format?: 'json' | 'table';
  filter?: string;
  dryRun?: boolean;
}

interface Presentation {
  id?: string;
  title: string;
  description?: string;
  expert_id?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
  metadata?: Record<string, any>;
  assets?: PresentationAsset[];
}

interface PresentationAsset {
  id: string;
  asset_type: string;
  asset_id: string;
  position?: string;
  created_at?: string;
  updated_at?: string;
  metadata?: Record<string, any>;
}

interface CommandResult {
  success: boolean;
  error?: string;
  message?: string;
  data?: any;
}

/**
 * List all presentations
 */
async function listPresentations(
  format: string,
  filter?: string
): Promise<CommandResult> {
  Logger.info('📋 Listing presentations');
  
  try {
    const supabaseService = new SupabaseService();
    const presentations = await supabaseService.getAllPresentations();
    
    if (!presentations || presentations.length === 0) {
      return {
        success: true,
        message: 'No presentations found.',
        data: [],
      };
    }
    
    // Apply filter if specified
    let filteredPresentations = presentations;
    if (filter) {
      const filterLower = filter.toLowerCase();
      filteredPresentations = presentations.filter((presentation) =>
        (presentation.title && presentation.title.toLowerCase().includes(filterLower)) ||
        (presentation.description && presentation.description.toLowerCase().includes(filterLower)) ||
        (presentation.expert_id && presentation.expert_id.includes(filter))
      );
      
      Logger.info(`🔍 Found ${filteredPresentations.length} presentations matching filter: "${filter}"`);
    }
    
    // Format output
    if (format === 'json') {
      return {
        success: true,
        data: filteredPresentations,
      };
    } else {
      // Create table
      const tableData = filteredPresentations.map((presentation) => ({
        ID: presentation.id || 'N/A',
        Title: presentation.title || 'N/A',
        Expert: presentation.expert_id || 'N/A',
        Status: presentation.status || 'N/A',
        Created: presentation.created_at ? new Date(presentation.created_at).toLocaleString() : 'N/A',
        Assets: presentation.assets ? presentation.assets.length : 0,
      }));
      
      const table = createTable(tableData);
      
      return {
        success: true,
        message: `Found ${filteredPresentations.length} presentations:`,
        data: table,
      };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    Logger.error(`❌ Error listing presentations: ${errorMessage}`);
    
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Create a new presentation
 */
async function createPresentation(
  options: ManagePresentationsOptions
): Promise<CommandResult> {
  Logger.info('🆕 Creating new presentation');
  
  // Validate required fields
  if (!options.title) {
    return {
      success: false,
      error: 'Title is required to create a presentation.',
    };
  }
  
  const presentation: Presentation = {
    title: options.title,
    description: options.description,
    expert_id: options.expert,
    status: 'draft',
    metadata: {
      created_by: 'media-processing-cli',
      created_at: new Date().toISOString(),
    },
  };
  
  // Skip actual creation in dry run mode
  if (options.dryRun) {
    Logger.info('🔄 [DRY RUN] Would create presentation:', presentation);
    return {
      success: true,
      message: '[DRY RUN] Presentation would be created.',
      data: presentation,
    };
  }
  
  try {
    const supabaseService = new SupabaseService();
    const result = await supabaseService.createPresentation(presentation);
    
    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Failed to create presentation.',
      };
    }
    
    return {
      success: true,
      message: `✅ Created presentation with ID: ${result.id}`,
      data: result.data,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    Logger.error(`❌ Error creating presentation: ${errorMessage}`);
    
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Update an existing presentation
 */
async function updatePresentation(
  options: ManagePresentationsOptions
): Promise<CommandResult> {
  const presentationId = options.update;
  Logger.info(`🔄 Updating presentation with ID: ${presentationId}`);
  
  // Validate presentation ID
  if (!presentationId) {
    return {
      success: false,
      error: 'Presentation ID is required for update.',
    };
  }
  
  try {
    // First, check if the presentation exists
    const supabaseService = new SupabaseService();
    const existingPresentation = await supabaseService.getPresentationById(presentationId);
    
    if (!existingPresentation) {
      return {
        success: false,
        error: `Presentation with ID ${presentationId} not found.`,
      };
    }
    
    // Prepare update data
    const updateData: Partial<Presentation> = {};
    
    if (options.title) {
      updateData.title = options.title;
    }
    
    if (options.description !== undefined) {
      updateData.description = options.description;
    }
    
    if (options.expert) {
      updateData.expert_id = options.expert;
    }
    
    // Add metadata about update
    updateData.metadata = {
      ...existingPresentation.metadata,
      updated_by: 'media-processing-cli',
      updated_at: new Date().toISOString(),
    };
    
    // Skip actual update in dry run mode
    if (options.dryRun) {
      Logger.info('🔄 [DRY RUN] Would update presentation:', updateData);
      return {
        success: true,
        message: '[DRY RUN] Presentation would be updated.',
        data: {
          id: presentationId,
          ...updateData,
        },
      };
    }
    
    // Perform update
    const result = await supabaseService.updatePresentation(presentationId, updateData);
    
    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Failed to update presentation.',
      };
    }
    
    return {
      success: true,
      message: `✅ Updated presentation with ID: ${presentationId}`,
      data: result.data,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    Logger.error(`❌ Error updating presentation: ${errorMessage}`);
    
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Delete a presentation
 */
async function deletePresentation(
  options: ManagePresentationsOptions
): Promise<CommandResult> {
  const presentationId = options.delete;
  Logger.info(`🗑️ Deleting presentation with ID: ${presentationId}`);
  
  // Validate presentation ID
  if (!presentationId) {
    return {
      success: false,
      error: 'Presentation ID is required for deletion.',
    };
  }
  
  try {
    // First, check if the presentation exists
    const supabaseService = new SupabaseService();
    const existingPresentation = await supabaseService.getPresentationById(presentationId);
    
    if (!existingPresentation) {
      return {
        success: false,
        error: `Presentation with ID ${presentationId} not found.`,
      };
    }
    
    // Skip actual deletion in dry run mode
    if (options.dryRun) {
      Logger.info('🔄 [DRY RUN] Would delete presentation:', existingPresentation);
      return {
        success: true,
        message: '[DRY RUN] Presentation would be deleted.',
        data: existingPresentation,
      };
    }
    
    // Perform deletion
    const result = await supabaseService.deletePresentation(presentationId);
    
    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Failed to delete presentation.',
      };
    }
    
    return {
      success: true,
      message: `✅ Deleted presentation with ID: ${presentationId}`,
      data: existingPresentation,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    Logger.error(`❌ Error deleting presentation: ${errorMessage}`);
    
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Main command implementation
 */
export default async function command(options: ManagePresentationsOptions): Promise<void> {
  Logger.info('🚀 Starting manage-presentations command');
  Logger.debug('Options:', options);
  
  try {
    const format = options.format || 'table';
    let result: CommandResult = { success: false };
    
    // Handle different operations
    if (options.list || (!options.create && !options.update && !options.delete)) {
      // Default to list if no operation is specified
      result = await listPresentations(format, options.filter);
    } else if (options.create) {
      result = await createPresentation(options);
    } else if (options.update) {
      result = await updatePresentation(options);
    } else if (options.delete) {
      result = await deletePresentation(options);
    }
    
    // Output the result
    if (result.error) {
      Logger.error(`❌ Error: ${result.error}`);
    } else if (result.message) {
      Logger.info(result.message);
    }
    
    if (result.data) {
      if (format === 'json' || typeof result.data !== 'string') {
        console.log(JSON.stringify(result.data, null, 2));
      } else {
        console.log(result.data);
      }
    }
    
    if (result.success) {
      Logger.info('✅ Command completed successfully');
    } else {
      Logger.error('❌ Command failed');
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    Logger.error(`❌ Command execution failed: ${errorMessage}`);
  }
}