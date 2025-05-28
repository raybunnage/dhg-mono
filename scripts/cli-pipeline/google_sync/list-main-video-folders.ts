import { Command } from 'commander';
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';

interface FolderInfo {
  name: string;
  path_depth: number;
  main_video_name: string | null;
  document_type: string | null;
}

export const listMainVideoFolders = async (): Promise<void> => {
  try {
    const supabase = SupabaseClientService.getInstance().getClient();
    
    // Query folders with main_video_id that is not null
    const { data, error } = await supabase
      .from('google_sources')
      .select(`
        id,
        name,
        path_depth,
        main_video_id,
        document_type_id
      `)
      .is('is_root', false)
      .not('main_video_id', 'is', null)
      .order('name', { ascending: false }); // Sort in reverse alphabetical order

    if (error) {
      console.error('Error fetching folders:', error);
      return;
    }

    if (!data || data.length === 0) {
      console.log('No folders with main_video_id found.');
      return;
    }

    // Fetch the names of all main_video_ids
    const videoIds = data.map(folder => folder.main_video_id).filter(Boolean);
    const { data: videoData, error: videoError } = await supabase
      .from('google_sources')
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

    // Second query to get document types
    const { data: documentTypeData, error: documentTypeError } = await supabase
      .from('document_types')
      .select('id, name');
    
    if (documentTypeError) {
      console.error('Error fetching document types:', documentTypeError);
      return;
    }
    
    // Create a lookup map for document types
    const documentTypeMap = new Map<string, string>();
    documentTypeData?.forEach(docType => {
      documentTypeMap.set(docType.id, docType.name);
    });

    // Prepare the folder info array
    const folderInfo: FolderInfo[] = data.map(folder => {
      return {
        name: folder.name || 'Unknown',
        path_depth: folder.path_depth || 0,
        main_video_name: folder.main_video_id ? videoNameMap.get(folder.main_video_id) || 'Unknown Video' : null,
        document_type: folder.document_type_id ? documentTypeMap.get(folder.document_type_id) || null : null
      };
    });

    // Find the maximum length of folder names for proper formatting
    const maxNameLength = Math.max(...folderInfo.map(folder => folder.name.length), 30);
    
    // Display the results in a nicely formatted table
    console.log('\nFolders with Main Video IDs:');
    console.log('-'.repeat(maxNameLength + 65));
    console.log(`${'Folder Name'.padEnd(maxNameLength)} | ${'Depth'.padEnd(6)} | ${'Main Video'.padEnd(30)} | ${'Document Type'}`);
    console.log('-'.repeat(maxNameLength + 65));
    
    folderInfo.forEach(folder => {
      console.log(
        `${folder.name.padEnd(maxNameLength)} | ` +
        `${String(folder.path_depth).padEnd(6)} | ` +
        `${(folder.main_video_name || 'N/A').padEnd(30)} | ` +
        `${folder.document_type || 'N/A'}`
      );
    });
    
    console.log('-'.repeat(maxNameLength + 65));
    console.log(`Total folders with main_video_id: ${folderInfo.length}`);

  } catch (error) {
    console.error('Unexpected error:', error);
  }
};

// If this file is run directly
if (require.main === module) {
  const program = new Command();
  
  program
    .name('list-main-video-folders')
    .description('List folders that have a main_video_id set')
    .action(listMainVideoFolders);
  
  program.parse(process.argv);
}