import { Command } from 'commander';
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

/**
 * Lists high-level folders with main_video_id and their hierarchical contents.
 * Filters to show only files with the following:
 * 1. Files with extensions .txt, .mp4, .docx, or .pptx
 * 2. Files that have an associated main_video_id (from the file or its parent folder)
 * 
 * This provides a comprehensive view of all content associated with each main video folder.
 */

interface FolderInfo {
  id: string;
  name: string;
  path_depth: number;
  main_video_name: string | null;
  document_type: string | null;
}

interface FileInfo {
  id: string;
  name: string;
  document_type: string | null;
  expert_document_id: string | null;
  document_processing_status: string | null;
  processed_content_preview: string | null;
}

export const listMainVideoFoldersTree = async (): Promise<void> => {
  try {
    const supabase = SupabaseClientService.getInstance().getClient();
    
    // Get high-level folders (path_depth = 0) with main_video_id that is not null
    const { data: highLevelFolders, error: folderError } = await supabase
      .from('sources_google')
      .select(`
        id,
        name,
        path_depth,
        main_video_id,
        document_type_id
      `)
      .eq('path_depth', 0)
      .is('is_root', false)
      .not('main_video_id', 'is', null)
      .order('name', { ascending: false }); // Sort in reverse alphabetical order

    if (folderError) {
      console.error('Error fetching high-level folders:', folderError);
      return;
    }

    if (!highLevelFolders || highLevelFolders.length === 0) {
      console.log('No high-level folders with main_video_id found.');
      return;
    }

    // Fetch the names of all main_video_ids
    const videoIds = highLevelFolders.map(folder => folder.main_video_id).filter(Boolean);
    const { data: videoData, error: videoError } = await supabase
      .from('sources_google')
      .select('id, name')
      .in('id', videoIds);

    if (videoError) {
      console.error('Error fetching video names:', videoError);
      return;
    }

    // Create a lookup map for video names
    const videoNameMap = new Map<string, string>();
    videoData?.forEach(video => {
      videoNameMap.set(video.id, video.name);
    });

    // Get document types for lookup
    const { data: documentTypeData, error: documentTypeError } = await supabase
      .from('document_types')
      .select('id, document_type');
    
    if (documentTypeError) {
      console.error('Error fetching document types:', documentTypeError);
      return;
    }
    
    // Create a lookup map for document types
    const documentTypeMap = new Map<string, string>();
    documentTypeData?.forEach(docType => {
      documentTypeMap.set(docType.id, docType.document_type);
    });

    // Prepare the folder info array
    const folderInfo: FolderInfo[] = highLevelFolders.map(folder => {
      return {
        id: folder.id,
        name: folder.name || 'Unknown',
        path_depth: folder.path_depth || 0,
        main_video_name: folder.main_video_id ? videoNameMap.get(folder.main_video_id) || 'Unknown Video' : null,
        document_type: folder.document_type_id ? documentTypeMap.get(folder.document_type_id) || null : null
      };
    });

    // Find the maximum length of folder names for proper formatting
    const maxNameLength = Math.max(...folderInfo.map(folder => folder.name.length), 30);
    
    // Display the results in a nicely formatted table
    console.log('\nHigh-Level Folders with Main Video IDs:');
    console.log('-'.repeat(maxNameLength + 65));
    console.log(`${'Folder Name'.padEnd(maxNameLength)} | ${'Depth'.padEnd(6)} | ${'Main Video'.padEnd(30)} | ${'Document Type'}`);
    console.log('-'.repeat(maxNameLength + 65));
    
    // Process each high-level folder
    for (const folder of folderInfo) {
      // Display the main folder information
      console.log(
        `${folder.name.padEnd(maxNameLength)} | ` +
        `${String(folder.path_depth).padEnd(6)} | ` +
        `${(folder.main_video_name || 'N/A').padEnd(30)} | ` +
        `${folder.document_type || 'N/A'}`
      );
      
      // Get all subfolders and files under this folder
      const { data: subItems, error: subItemsError } = await supabase
        .from('sources_google')
        .select(`
          id,
          name,
          path,
          document_type_id,
          main_video_id
        `)
        .like('path', `%${folder.name}/%`) // Files/folders under this high-level folder
        .order('name');
      
      if (subItemsError) {
        console.error(`Error fetching subitems for folder ${folder.name}:`, subItemsError);
        continue;
      }
      
      if (!subItems || subItems.length === 0) {
        console.log(`    No subitems found for folder ${folder.name}`);
        continue;
      }
      
      // Filter to only show files with the correct extensions and that have a main_video_id
      const filteredSubItems = subItems.filter(item => {
        const fileName = item.name || '';
        const hasValidExtension = ['.txt', '.mp4', '.docx', '.pptx'].some(ext => 
          fileName.toLowerCase().endsWith(ext.toLowerCase())
        );
        // Files inherit main_video_id from parent folder if not explicitly set
        const hasMainVideoId = item.main_video_id !== null || folder.main_video_name !== null;
        
        return hasValidExtension && hasMainVideoId;
      });
      
      if (filteredSubItems.length === 0) {
        console.log(`    No matching files (.txt, .mp4, .docx, .pptx) with main_video_id found for folder ${folder.name}`);
        continue;
      }
      
      // Get expert documents for this folder's files
      const { data: expertDocs, error: expertDocsError } = await supabase
        .from('expert_documents')
        .select(`
          id,
          source_id,
          document_type_id,
          document_processing_status,
          processed_content
        `)
        .in('source_id', filteredSubItems.map(item => item.id));
        
      if (expertDocsError) {
        console.error(`Error fetching expert documents for folder ${folder.name}:`, expertDocsError);
      }
      
      // Create a lookup map for expert documents by source_id
      const expertDocMap = new Map<string, any>();
      if (expertDocs) {
        expertDocs.forEach(doc => {
          expertDocMap.set(doc.source_id, doc);
        });
      }
      
      // Process each filtered subitem
      for (const item of filteredSubItems) {
        
        // Check if this item has an associated main_video_id (might inherit from parent)
        // We know the parent folder has a main_video_id since that's how we selected it
        
        const docType = item.document_type_id ? documentTypeMap.get(item.document_type_id) || 'Unknown' : 'N/A';
        let processedContentPreview = 'N/A';
        let docProcessingStatus = 'N/A';
        
        // Get expert document info if available
        const expertDoc = expertDocMap.get(item.id);
        if (expertDoc) {
          docProcessingStatus = expertDoc.document_processing_status || 'N/A';
          
          // Get a preview of processed content if available
          if (expertDoc.processed_content) {
            let contentStr = '';
            
            if (typeof expertDoc.processed_content === 'string') {
              contentStr = expertDoc.processed_content;
            } else if (typeof expertDoc.processed_content === 'object') {
              contentStr = JSON.stringify(expertDoc.processed_content);
            }
            
            // Limit to a short preview
            if (contentStr.length > 50) {
              processedContentPreview = contentStr.substring(0, 47) + '...';
            } else {
              processedContentPreview = contentStr;
            }
          }
        }
        
        // Calculate indent based on path depth
        const pathParts = item.path ? item.path.split('/') : [];
        const depth = pathParts.length;
        const indent = '  '.repeat(depth);
        
        // Display the subitem
        console.log(
          `${indent}${item.name || 'Unknown'} - ` +
          `Type: ${docType}, ` +
          `Status: ${docProcessingStatus}, ` +
          `Content: ${processedContentPreview}`
        );
      }
      
      // Add a separator between folders
      console.log('-'.repeat(maxNameLength + 65));
    }
    
    console.log(`Total high-level folders with main_video_id: ${folderInfo.length}`);

  } catch (error) {
    console.error('Unexpected error:', error);
  }
};

// If this file is run directly
if (require.main === module) {
  const program = new Command();
  
  program
    .name('list-main-video-folders-tree')
    .description('List high-level folders with main_video_id and their hierarchical contents')
    .action(listMainVideoFoldersTree);
  
  program.parse(process.argv);
}