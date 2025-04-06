/**
 * Link Assets command for the Media Processing CLI Pipeline
 * Link assets to a presentation
 */

import * as path from 'path';
import * as fs from 'fs';
import { Logger } from '../../../../packages/shared/utils';
import { fileService } from '../../../../packages/shared/services/file-service/file-service';
import { SupabaseService } from '../../../../packages/shared/services/supabase-service/supabase-service';
import { createTable } from '../../../../packages/shared/utils/table';

// Define interfaces
interface LinkAssetsOptions {
  presentationId: string;
  assetType?: string;
  assetId?: string;
  assetFile?: string;
  position?: string;
  replace?: boolean;
  list?: boolean;
  unlink?: string;
  dryRun?: boolean;
}

interface PresentationAsset {
  id: string;
  presentation_id: string;
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
 * List all assets linked to a presentation
 */
async function listAssets(
  presentationId: string
): Promise<CommandResult> {
  Logger.info(`📋 Listing assets for presentation: ${presentationId}`);
  
  try {
    const supabaseService = new SupabaseService();
    
    // First, check if the presentation exists
    const presentation = await supabaseService.getPresentationById(presentationId);
    
    if (!presentation) {
      return {
        success: false,
        error: `Presentation with ID ${presentationId} not found.`,
      };
    }
    
    // Get assets
    const assets = await supabaseService.getPresentationAssets(presentationId);
    
    if (!assets || assets.length === 0) {
      return {
        success: true,
        message: `No assets found for presentation "${presentation.title}".`,
        data: [],
      };
    }
    
    // Create table
    const tableData = assets.map((asset) => ({
      ID: asset.id || 'N/A',
      Type: asset.asset_type || 'N/A',
      'Asset ID': asset.asset_id || 'N/A',
      Position: asset.position || 'N/A',
      'Created At': asset.created_at ? new Date(asset.created_at).toLocaleString() : 'N/A',
    }));
    
    const table = createTable(tableData);
    
    return {
      success: true,
      message: `Found ${assets.length} assets for presentation "${presentation.title}":`,
      data: table,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    Logger.error(`❌ Error listing assets: ${errorMessage}`);
    
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Link an asset to a presentation
 */
async function linkAsset(
  options: LinkAssetsOptions
): Promise<CommandResult> {
  const { presentationId, assetType, assetId, assetFile, position, replace, dryRun } = options;
  
  Logger.info(`🔗 Linking asset to presentation: ${presentationId}`);
  
  // Validate required fields
  if (!assetType) {
    return {
      success: false,
      error: 'Asset type is required to link an asset.',
    };
  }
  
  if (!assetId && !assetFile) {
    return {
      success: false,
      error: 'Either asset ID or asset file must be provided.',
    };
  }
  
  try {
    const supabaseService = new SupabaseService();
    
    // First, check if the presentation exists
    const presentation = await supabaseService.getPresentationById(presentationId);
    
    if (!presentation) {
      return {
        success: false,
        error: `Presentation with ID ${presentationId} not found.`,
      };
    }
    
    // If asset file is provided, upload it to get an asset ID
    let actualAssetId = assetId;
    let uploadResult: any;
    
    if (assetFile) {
      // Validate that the file exists
      if (!fs.existsSync(assetFile)) {
        return {
          success: false,
          error: `Asset file not found: ${assetFile}`,
        };
      }
      
      // Skip file upload in dry run mode
      if (dryRun) {
        Logger.info(`🔄 [DRY RUN] Would upload file: ${assetFile}`);
        actualAssetId = 'dry-run-asset-id';
      } else {
        // Upload the file
        const fileContent = fileService.readFile(assetFile);
        
        if (!fileContent.success) {
          return {
            success: false,
            error: `Failed to read asset file: ${fileContent.error}`,
          };
        }
        
        // Determine appropriate storage bucket based on asset type
        let bucketName = 'presentations';
        switch (assetType.toLowerCase()) {
          case 'document':
            bucketName = 'documents';
            break;
          case 'summary':
            bucketName = 'summaries';
            break;
          case 'video':
            bucketName = 'videos';
            break;
          case 'image':
            bucketName = 'images';
            break;
        }
        
        // Upload to storage
        uploadResult = await supabaseService.uploadFile(
          bucketName,
          path.basename(assetFile),
          fileContent.content!,
          {
            contentType: determineContentType(assetFile),
            metadata: {
              presentationId,
              assetType,
              uploadedAt: new Date().toISOString(),
            },
          }
        );
        
        if (!uploadResult.success) {
          return {
            success: false,
            error: `Failed to upload asset file: ${uploadResult.error}`,
          };
        }
        
        actualAssetId = uploadResult.id;
        Logger.info(`📤 Uploaded asset file with ID: ${actualAssetId}`);
      }
    }
    
    // Check if the asset is already linked (if replace is not specified)
    if (!replace && !dryRun) {
      const existingAssets = await supabaseService.getPresentationAssets(presentationId);
      const isDuplicate = existingAssets.some((asset) => 
        asset.asset_type === assetType && asset.asset_id === actualAssetId
      );
      
      if (isDuplicate) {
        return {
          success: false,
          error: 'Asset is already linked to this presentation. Use --replace to replace it.',
        };
      }
    }
    
    // Prepare asset data
    const assetData = {
      presentation_id: presentationId,
      asset_type: assetType,
      asset_id: actualAssetId!,
      position: position || 'main',
      metadata: {
        linked_by: 'media-processing-cli',
        linked_at: new Date().toISOString(),
        file_path: assetFile,
      },
    };
    
    // Skip actual linking in dry run mode
    if (dryRun) {
      Logger.info('🔄 [DRY RUN] Would link asset:', assetData);
      return {
        success: true,
        message: '[DRY RUN] Asset would be linked to presentation.',
        data: assetData,
      };
    }
    
    // Link the asset
    const result = await supabaseService.linkAssetToPresentation(assetData, replace);
    
    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Failed to link asset to presentation.',
      };
    }
    
    return {
      success: true,
      message: `✅ Linked asset to presentation with ID: ${result.id}`,
      data: result.data,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    Logger.error(`❌ Error linking asset: ${errorMessage}`);
    
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Unlink an asset from a presentation
 */
async function unlinkAsset(
  presentationId: string,
  assetId: string,
  dryRun: boolean
): Promise<CommandResult> {
  Logger.info(`🔓 Unlinking asset ${assetId} from presentation ${presentationId}`);
  
  try {
    const supabaseService = new SupabaseService();
    
    // First, check if the presentation exists
    const presentation = await supabaseService.getPresentationById(presentationId);
    
    if (!presentation) {
      return {
        success: false,
        error: `Presentation with ID ${presentationId} not found.`,
      };
    }
    
    // Check if the asset exists and is linked to the presentation
    const assets = await supabaseService.getPresentationAssets(presentationId);
    const assetToUnlink = assets.find((asset) => asset.id === assetId);
    
    if (!assetToUnlink) {
      return {
        success: false,
        error: `Asset with ID ${assetId} not found in presentation ${presentationId}.`,
      };
    }
    
    // Skip actual unlinking in dry run mode
    if (dryRun) {
      Logger.info('🔄 [DRY RUN] Would unlink asset:', assetToUnlink);
      return {
        success: true,
        message: '[DRY RUN] Asset would be unlinked from presentation.',
        data: assetToUnlink,
      };
    }
    
    // Unlink the asset
    const result = await supabaseService.unlinkAssetFromPresentation(presentationId, assetId);
    
    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Failed to unlink asset from presentation.',
      };
    }
    
    return {
      success: true,
      message: `✅ Unlinked asset ${assetId} from presentation ${presentationId}`,
      data: assetToUnlink,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    Logger.error(`❌ Error unlinking asset: ${errorMessage}`);
    
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Determine content type based on file extension
 */
function determineContentType(filePath: string): string {
  const extension = path.extname(filePath).toLowerCase();
  
  switch (extension) {
    case '.txt':
      return 'text/plain';
    case '.html':
      return 'text/html';
    case '.json':
      return 'application/json';
    case '.pdf':
      return 'application/pdf';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.png':
      return 'image/png';
    case '.gif':
      return 'image/gif';
    case '.mp4':
      return 'video/mp4';
    case '.mp3':
      return 'audio/mpeg';
    case '.wav':
      return 'audio/wav';
    case '.doc':
      return 'application/msword';
    case '.docx':
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    default:
      return 'application/octet-stream';
  }
}

/**
 * Main command implementation
 */
export default async function command(options: LinkAssetsOptions): Promise<void> {
  Logger.info('🚀 Starting link-assets command');
  Logger.debug('Options:', options);
  
  try {
    let result: CommandResult = { success: false };
    
    // Handle different operations
    if (options.list) {
      result = await listAssets(options.presentationId);
    } else if (options.unlink) {
      result = await unlinkAsset(options.presentationId, options.unlink, options.dryRun || false);
    } else {
      result = await linkAsset(options);
    }
    
    // Output the result
    if (result.error) {
      Logger.error(`❌ Error: ${result.error}`);
    } else if (result.message) {
      Logger.info(result.message);
    }
    
    if (result.data) {
      if (typeof result.data === 'string') {
        console.log(result.data);
      } else {
        console.log(JSON.stringify(result.data, null, 2));
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