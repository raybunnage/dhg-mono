import { Logger } from '../../../../packages/shared/utils/logger';
import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';

/**
 * Create presentation_assets for presentations with a high_level_folder_source_id
 * 
 * For each presentation, recursively search for files in its high_level_folder,
 * filter out unsupported file types, and create presentation_assets for supported files.
 */
export async function createPresentationAssetsCommand(options: {
  presentationId?: string;
  dryRun: boolean;
  limit?: number;
  depth?: number;
}): Promise<{
  success: boolean;
  count?: number;
  created?: number;
  failed?: number;
  message?: string;
}> {
  try {
    Logger.info(`Starting create-presentation-assets command ${options.dryRun ? "(dry run)" : ""}`);
    
    const supabase = SupabaseClientService.getInstance().getClient();
    
    // Get presentations with high_level_folder_source_id
    let query = supabase
      .from('presentations')
      .select('id, title, high_level_folder_source_id, video_source_id')
      .not('high_level_folder_source_id', 'is', null)
      .order('created_at', { ascending: false });
    
    // Apply filters if specific presentation ID provided
    if (options.presentationId) {
      query = query.eq('id', options.presentationId);
    }
    
    // Apply limit if provided
    if (options.limit) {
      query = query.limit(options.limit);
    }
    
    const { data: presentations, error } = await query;
    
    if (error) {
      Logger.error('Error fetching presentations with high_level_folder_source_id:', error);
      return {
        success: false, 
        message: `Error fetching presentations: ${error.message}`
      };
    }
    
    if (!presentations || presentations.length === 0) {
      Logger.info('No presentations found with high_level_folder_source_id');
      return {
        success: true, 
        count: 0, 
        message: 'No presentations found with high_level_folder_source_id'
      };
    }
    
    Logger.info(`Found ${presentations.length} presentations with high_level_folder_source_id`);
    
    // Get the list of unsupported document type IDs
    const unsupportedDocTypeIds = [
      '6ece37e7-840d-4a0c-864d-9f1f971b1d7e', // m4a audio
      'e9d3e473-5315-4837-9f5f-61f150cbd137', // Code Documentation Markdown
      '4edfb133-ffeb-4b9c-bfd4-79ee9a9d73af', // mp3 audio
      'd2206940-e4f3-476e-9245-0e1eb12fd195', // aac audio
      '8ce8fbbc-b397-4061-a80f-81402515503b', // m3u file
      'fe697fc5-933c-41c9-9b11-85e0defa86ed', // wav audio
      'db6518ad-765c-4a02-a684-9c2e49d77cf5', // png image
      '68b95822-2746-4ce1-ad35-34e5b0297177', // jpg image
      '3e7c880c-d821-4d01-8cc5-3547bdd2e347', // video mpeg
      'd70a258e-262b-4bb3-95e3-f826ee9b918b', // video quicktime
      '91fa92a3-d606-493b-832d-9ba1fa83dc9f', // video microsoft avi
      '28ab55b9-b408-486f-b1c3-8f0f0a174ad4', // m4v
      '2c1d3bdc-b429-4194-bec2-7e4bbb165dbf', // conf file
      '53f42e7d-78bd-4bde-8106-dc12a4835695', // Document Processing Script
      '4fdbd8be-fe5a-4341-934d-2b6bd43be7be', // CI CD Pipeline Script
      'a1dddf8e-1264-4ec0-a5af-52eafb536ee3', // Deployment Script
      '561a86b0-7064-4c20-a40e-2ec6905c4a42', // Database Management Script
      'f7e83857-8bb8-4b18-9d8f-16d5cb783650', // Environment Setup Script
      'b26a68ed-a0d1-415d-8271-cba875bfe3ce', // xlsx document
      '920893fc-f0be-4211-85b4-fc29882ade97', // google sheet
      'e29b5194-7ba0-4a3c-a7db-92b0d8adca6a', // Unknown Type
      '9dbe32ff-5e82-4586-be63-1445e5bcc548', // unknown document type
    ];

    // Unsupported MIME types
    const unsupportedMimeTypes = [
      'application/vnd.google-apps.audio',
      'application/vnd.google-apps.video',
      'application/vnd.google-apps.drawing',
      'application/vnd.google-apps.form',
      'application/vnd.google-apps.map',
      'application/vnd.google-apps.presentation',
      'audio/mpeg',
      'audio/mp3',
      'audio/wav',
      'audio/ogg',
      'video/mpeg',
      'video/quicktime',
      'video/x-msvideo',
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/svg+xml',
    ];
    
    let totalCreated = 0;
    let totalFailed = 0;
    
    // Process each presentation
    for (const presentation of presentations) {
      try {
        Logger.info(`Processing presentation: ${presentation.title} (${presentation.id})`);
        
        if (!presentation.high_level_folder_source_id) {
          Logger.warn(`Presentation ${presentation.id} has null high_level_folder_source_id despite query filter`);
          continue;
        }
        
        // Verify folder source exists and has a path_depth of 0
        const { data: folderSource, error: folderError } = await supabase
          .from('sources_google')
          .select('id, name, drive_id, path, path_depth')
          .eq('id', presentation.high_level_folder_source_id)
          .eq('path_depth', 0)
          .single();
        
        if (folderError || !folderSource) {
          Logger.warn(`Skipping presentation ${presentation.id}: folder source not found or path_depth != 0`);
          totalFailed++;
          continue;
        }
        
        Logger.info(`Found folder source: ${folderSource.name} (path_depth: ${folderSource.path_depth})`);
        
        // NEW APPROACH: Use drive_id to find files in the folder hierarchy
        Logger.info(`Searching for files in folder hierarchy using drive_id matching...`);
        
        const maxDepth = options.depth || 6; // Default to max depth of 6 levels
        let allFiles: any[] = [];
        
        // Step 1: First find the direct children of this folder (matching the Google Drive ID)
        Logger.info(`Looking for files directly under folder with drive_id: ${folderSource.drive_id}`);
        const { data: directDriveChildren, error: driveError } = await supabase
          .from('sources_google')
          .select('id, name, mime_type, path, drive_id, parent_folder_id')
          .eq('parent_folder_id', folderSource.drive_id)
          .not('mime_type', 'eq', 'application/vnd.google-apps.folder');
        
        if (driveError) {
          Logger.error(`Error fetching direct children by drive_id:`, driveError);
        } else if (directDriveChildren && directDriveChildren.length > 0) {
          Logger.info(`Found ${directDriveChildren.length} files directly under folder ${folderSource.name}`);
          allFiles.push(...directDriveChildren);
        }
        
        // Step 2: Find all subfolders within this folder
        const { data: subfolders, error: subfoldersError } = await supabase
          .from('sources_google')
          .select('id, name, mime_type, path, drive_id')
          .eq('parent_folder_id', folderSource.drive_id)
          .eq('mime_type', 'application/vnd.google-apps.folder');
        
        if (subfoldersError) {
          Logger.error(`Error fetching subfolders:`, subfoldersError);
        } else if (subfolders && subfolders.length > 0) {
          Logger.info(`Found ${subfolders.length} subfolders under ${folderSource.name}`);
          
          // Step 3: For each subfolder, find files within it
          for (const subfolder of subfolders) {
            Logger.info(`Looking for files in subfolder: ${subfolder.name} (drive_id: ${subfolder.drive_id})`);
            
            const { data: subfolderFiles, error: subFilesError } = await supabase
              .from('sources_google')
              .select('id, name, mime_type, path, drive_id, parent_folder_id')
              .eq('parent_folder_id', subfolder.drive_id)
              .not('mime_type', 'eq', 'application/vnd.google-apps.folder');
            
            if (subFilesError) {
              Logger.error(`Error fetching files from subfolder ${subfolder.name}:`, subFilesError);
            } else if (subfolderFiles && subfolderFiles.length > 0) {
              Logger.info(`Found ${subfolderFiles.length} files in subfolder ${subfolder.name}`);
              allFiles.push(...subfolderFiles);
            } else {
              Logger.info(`No files found in subfolder ${subfolder.name}`);
            }
          }
        }
        
        // Fallback to path-based search if no files found
        if (allFiles.length === 0) {
          Logger.info(`No files found using drive_id matching, trying path-based search...`);
          
          // Step 1: Get all children within the path of the high-level folder
          const folderPath = folderSource.path;
          Logger.info(`Using folder path: ${folderPath}`);
          
          const { data: allContents, error: contentsError } = await supabase
            .from('sources_google')
            .select('id, name, mime_type, path, drive_id')
            .ilike('path', `${folderPath}/%`);
          
          if (contentsError) {
            Logger.error(`Error fetching contents using path matching:`, contentsError);
            totalFailed++;
            continue;
          }
          
          if (!allContents || allContents.length === 0) {
            Logger.info(`No contents found for path ${folderPath}`);
            continue;
          } else {
            // Process contents found by path matching
            Logger.info(`Found ${allContents.length} items in path hierarchy`);
            
            // Get all files (not folders) from the contents
            const contentFiles = allContents.filter(item => item.mime_type !== 'application/vnd.google-apps.folder');
            const contentFolders = allContents.filter(item => item.mime_type === 'application/vnd.google-apps.folder');
            
            if (contentFiles.length > 0) {
              Logger.info(`Found ${contentFiles.length} files in folder hierarchy`);
              allFiles.push(...contentFiles);
            }
            
            if (contentFolders.length > 0) {
              Logger.info(`Found ${contentFolders.length} subfolders - looking inside them...`);
              
              // Look one more level inside these subfolders
              for (const subfolder of contentFolders) {
                Logger.info(`Looking in subfolder: ${subfolder.name} (drive_id: ${subfolder.drive_id})`);
                
                // Look for files with parent_folder_id matching this subfolder's drive_id
                const { data: driveIdFiles, error: driveIdError } = await supabase
                  .from('sources_google')
                  .select('id, name, mime_type, path, drive_id')
                  .eq('parent_folder_id', subfolder.drive_id)
                  .not('mime_type', 'eq', 'application/vnd.google-apps.folder');
                
                if (driveIdError) {
                  Logger.error(`Error querying subfolder ${subfolder.name} by drive_id:`, driveIdError);
                } else if (driveIdFiles && driveIdFiles.length > 0) {
                  Logger.info(`Found ${driveIdFiles.length} files in subfolder ${subfolder.name} using drive_id lookup`);
                  allFiles.push(...driveIdFiles);
                } else {
                  Logger.info(`No files found in subfolder ${subfolder.name} using drive_id lookup`);
                }
              }
            }
          }
        }
        
        if (allFiles.length === 0) {
          Logger.info(`No files found in folder hierarchy for presentation ${presentation.id}`);
          continue;
        }
        
        Logger.info(`Found ${allFiles.length} total files in folder hierarchy (up to depth ${maxDepth})`);
        
        // Filter out unsupported file types
        const supportedFiles = allFiles.filter(file => {
          // Skip files with unsupported MIME types
          if (unsupportedMimeTypes.includes(file.mime_type)) {
            return false;
          }
          
          return true;
        });
        
        Logger.info(`Found ${supportedFiles.length} supported files after filtering`);
        
        // Check which files already have presentation_assets
        const { data: existingAssets, error: assetsError } = await supabase
          .from('presentation_assets')
          .select('asset_source_id')
          .eq('presentation_id', presentation.id);
        
        if (assetsError) {
          Logger.error(`Error checking existing assets for presentation ${presentation.id}:`, assetsError);
          totalFailed++;
          continue;
        }
        
        const existingAssetSourceIds = existingAssets ? existingAssets.map(a => a.asset_source_id) : [];
        
        // Filter out files that already have presentation_assets
        // Also filter out any files that match the presentation's video_source_id
        const filesToProcess = supportedFiles.filter(file => 
          !existingAssetSourceIds.includes(file.id) && 
          file.id !== presentation.video_source_id
        );
        
        // Log if we're skipping the main video
        if (presentation.video_source_id && supportedFiles.some(file => file.id === presentation.video_source_id)) {
          Logger.info(`Skipping main video file (${presentation.video_source_id}) as it's already linked to the presentation`);
        }
        
        Logger.info(`${filesToProcess.length} files need presentation_assets created`);
        
        let createdForPresentation = 0;
        let failedForPresentation = 0;
        
        // Create presentation_assets for each file
        for (const file of filesToProcess) {
          try {
            // Get the expert_document_id if available
            let expertDocumentId = null;
            
            // Lookup expert document for this file source
            const { data: expertDocuments, error: docError } = await supabase
              .from('expert_documents')
              .select('id, document_type_id')
              .eq('source_id', file.id);
              
            if (!docError && expertDocuments && expertDocuments.length > 0) {
              // Check if document type is in the unsupported list
              if (!unsupportedDocTypeIds.includes(expertDocuments[0].document_type_id)) {
                expertDocumentId = expertDocuments[0].id;
              } else {
                // Skip this file if its document type is unsupported
                Logger.info(`Skipping file ${file.id} with unsupported document type`);
                continue;
              }
            }
            
            if (options.dryRun) {
              Logger.info(`[DRY RUN] Would create presentation_asset for file: ${file.name} (${file.id})`);
              Logger.info(`  source_id: ${file.id}`);
              Logger.info(`  expert_document_id: ${expertDocumentId || 'null'}`);
              createdForPresentation++;
              continue;
            }
            
            // Create the presentation_asset
            const { data: newAsset, error: createError } = await supabase
              .from('presentation_assets')
              .insert({
                presentation_id: presentation.id,
                asset_source_id: file.id,
                asset_expert_document_id: expertDocumentId,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              })
              .select();
            
            if (createError) {
              Logger.error(`Error creating presentation_asset for file ${file.id}:`, createError);
              failedForPresentation++;
            } else {
              Logger.info(`Created presentation_asset for file: ${file.name} (${file.id})`);
              createdForPresentation++;
            }
          } catch (fileError) {
            Logger.error(`Error processing file ${file.id}:`, fileError);
            failedForPresentation++;
          }
        }
        
        totalCreated += createdForPresentation;
        totalFailed += failedForPresentation;
        
        Logger.info(`Completed processing presentation ${presentation.id}: created ${createdForPresentation}, failed ${failedForPresentation}`);
        
      } catch (presentationError) {
        Logger.error(`Error processing presentation ${presentation.id}:`, presentationError);
        totalFailed++;
      }
    }
    
    const resultMessage = options.dryRun
      ? `[DRY RUN] Would create ${totalCreated} presentation_assets (${totalFailed} would fail)`
      : `Created ${totalCreated} presentation_assets (${totalFailed} failed)`;
    
    Logger.info(resultMessage);
    
    return {
      success: true,
      count: presentations.length,
      created: totalCreated,
      failed: totalFailed,
      message: resultMessage
    };
    
  } catch (error) {
    Logger.error('Error in createPresentationAssetsCommand:', error);
    return {
      success: false,
      message: `Error in createPresentationAssetsCommand: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}