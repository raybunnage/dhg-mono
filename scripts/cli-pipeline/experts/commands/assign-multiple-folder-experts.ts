/**
 * Assign Multiple Folder Experts Command
 * 
 * Interactive command to assign multiple experts to a sources_google folder
 * Stays on the current folder and allows adding multiple experts one by one
 * using their 3-character mnemonics until the user chooses to move to the next folder
 * Shows currently assigned experts for each folder being processed
 */

import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';
import { Logger } from '../../../../packages/shared/utils/logger';
import * as readline from 'readline';
// Work around TypeScript error for Winston import
const loggerUtil = Logger;

// Interface for command options
interface AssignMultipleFolderExpertsOptions {
  folderId?: string;
  dryRun: boolean;
  verbose: boolean;
  limit?: number;
}

/**
 * Create a minimal expert information object
 */
interface MinimalExpert {
  id: string;
  name: string;
  mnemonic: string;
}

/**
 * Create a relationship object between source and expert
 */
interface ExpertRelationship {
  id: string;
  expert_id: string;
  source_id: string;
  is_primary: boolean;
}

/**
 * Create a minimal folder information object
 */
interface MinimalFolder {
  id: string;
  name: string;
  path: string;
  path_depth: number;
  document_type_id: string | null;
  main_video_id: string | null;
}

/**
 * Enhanced folder information including associated document content
 */
interface EnhancedFolderInfo {
  folder: MinimalFolder;
  videoTitle?: string;
  videoContent?: string;
  currentExperts: MinimalExpert[];
}

/**
 * Map of custom mnemonics from expert-list.md
 * Key is the lowercase name, value is the custom mnemonic
 */
const CUSTOM_MNEMONICS: Record<string, string> = {
  'abcdedfghi': 'ABC',
  'abernathy': 'ABE',
  'abernethy': 'ABR',
  'aria, carter, patterson': 'ACP',
  'allison': 'ALL',
  'amster': 'AMS',
  'anderson': 'AND',
  'anonymous': 'ANO',
  'apkarian': 'APK',
  'aria': 'ARI',
  'arndt': 'ARN',
  'ashar': 'ASH',
  'baker': 'BAK',
  'barrett': 'BAR',
  'barsalou': 'BAS',
  'bezruchka': 'BEZ',
  'bunnage': 'BUN',
  'carter': 'CAR',
  'carter,clawson,hanscom': 'CCH',
  'carter clawson hanscom': 'CCH',
  'cook clawson': 'CCK',
  'carter, horn': 'CHN',
  'clark': 'CLK',
  'clauw': 'CLW',
  'clawson': 'CLW',
  'cole': 'COL',
  'constable': 'CON',
  'cook': 'COK',
  'dale': 'DAL',
  'dantzer': 'DAN',
  'dehaene': 'DEH',
  'duncan': 'DUN',
  'eagle': 'EAG',
  'eagle armster': 'EAR',
  'ebunnage': 'EBN',
  'eisenberger': 'EIS',
  'escalante': 'ESC',
  'fradkin': 'FRA',
  'friston': 'FRI',
  'garbo': 'GAR',
  'germer': 'GER',
  'gervitz': 'GEV',
  'gevirtz': 'GEZ',
  'grinevich': 'GRI',
  'halaris': 'HAL',
  'hanscom': 'HAN',
  'harris': 'HAR',
  'hanscom, clawson': 'HCL',
  'horn, carter': 'HCT',
  'horn': 'HRN',
  'kjaervik': 'KJV',
  'kjearvik': 'KJR',
  'kovacic, porges': 'KPG',
  'langenecker': 'LAN',
  'lanius': 'LNS',
  'lane davis': 'LDV',
  'lederman': 'LDR',
  'lipov': 'LIP',
  'lipton': 'LPN',
  'luskin': 'LSK',
  'lustig': 'LST',
  'mancini': 'MAN',
  'marano': 'MAR',
  'meredith': 'MER',
  'napadow': 'NAP',
  'nathan': 'NAT',
  'naviaux': 'NAV',
  'naviaux, clawson': 'NCL',
  'newman': 'NEW',
  'overman': 'OVE',
  'panda': 'PAN',
  'pandi': 'PND',
  'patterson carter': 'PCR',
  'porges, clawson': 'PCL',
  'pennebaker': 'PEN',
  'peper': 'PEP',
  'pepper': 'PPR',
  'pezzulo': 'PEZ',
  'porges, lederman': 'PLT',
  'pohl': 'POH',
  'porges': 'POR',
  'wager': 'WAG',
  'raichle': 'RAI',
  'redfield': 'RED',
  'restauri': 'RES',
  'roger': 'ROG',
  'sabey': 'SAB',
  'sanders': 'SAN',
  'sullivan, ballantyne': 'SBL',
  'schubiner': 'SCH',
  'staats, clawson': 'SCL',
  'seigel': 'SEI',
  'shah': 'SHA',
  'siegel': 'SIG',
  'simonsson': 'SIM',
  'staats': 'STA',
  'stone': 'STO',
  'sullivan': 'SUL',
  'sutphin': 'SUT',
  'tarnopolosy': 'TAR',
  'terry miller': 'TMI'
};

/**
 * Create a unique mnemonic shortcut from the expert name
 * Creates a 3-character code that uniquely identifies each expert
 */
function createMnemonic(name: string, index: number): string {
  if (!name) return '???';
  
  // Split by space, dash, or period
  const parts = name.split(/[\s\-\.]+/).filter(Boolean);
  
  let mnemonic = '';
  
  if (parts.length === 1) {
    // Single word - take first three letters
    mnemonic = parts[0].substring(0, 3).toUpperCase();
  } else if (parts.length === 2) {
    // Two words - take first two letters of first word + first letter of second word
    mnemonic = parts[0].substring(0, 2).toUpperCase() + parts[1].charAt(0).toUpperCase();
  } else {
    // Multiple words - take first letter of first three words
    mnemonic = parts.slice(0, 3)
      .map(part => part.charAt(0).toUpperCase())
      .join('');
    
    // If less than three parts, pad with first letters of first part
    while (mnemonic.length < 3) {
      mnemonic += parts[0].charAt(mnemonic.length).toUpperCase();
    }
  }
  
  // Add numeric suffix if we need to make it unique
  if (mnemonic.length < 3) {
    // Add zeros to reach 3 chars if needed
    mnemonic = mnemonic.padEnd(3, '0');
  }
  
  return mnemonic;
}

/**
 * Get a list of all experts with their mnemonics
 */
async function getAllExperts(): Promise<MinimalExpert[]> {
  const supabaseClientService = SupabaseClientService.getInstance();
  const supabase = supabaseClientService.getClient();
  
  const { data: experts, error } = await supabase
    .from('expert_profiles')
    .select('id, expert_name, full_name, mnemonic')
    .order('expert_name');
    
  if (error || !experts) {
    throw new Error(`Failed to fetch experts: ${error?.message || 'Unknown error'}`);
  }
  
  return experts.map((expert) => {
    // Prioritize full_name over expert_name for display
    const name = expert.full_name || expert.expert_name || 'Unknown';
    const shortName = expert.expert_name || 'Unknown'; // Keep track of short name for mnemonics
    
    // Use the database mnemonic if available, otherwise fall back to the mapping or generate one
    let mnemonic = expert.mnemonic;
    if (!mnemonic) {
      const nameLower = shortName.toLowerCase();
      mnemonic = CUSTOM_MNEMONICS[nameLower] || createMnemonic(shortName, 0);
    }
    
    return { 
      id: expert.id, 
      name, // Now using full_name as primary display name
      mnemonic
    };
  });
}

/**
 * Get a list of folders that might need multiple expert assignments
 * Focuses on high-level folders (path_depth = 0) that likely represent presentations
 */
async function getFoldersForExpertAssignment(limit: number = 500): Promise<MinimalFolder[]> {
  const supabaseClientService = SupabaseClientService.getInstance();
  const supabase = supabaseClientService.getClient();
  
  // If limit is 0, use a very large number to effectively remove the limit
  const effectiveLimit = limit === 0 ? 1000 : limit;
  
  // Find high-level folders that represent presentations
  const { data: folders, error } = await supabase
    .from('sources_google')
    .select(`
      id, 
      name, 
      path,
      path_depth,
      document_type_id,
      main_video_id
    `)
    .eq('path_depth', 0)
    .eq('is_deleted', false)
    .eq('mime_type', 'application/vnd.google-apps.folder')
    .not('main_video_id', 'is', null) // Folders with videos are likely presentations
    .order('name')
    .limit(effectiveLimit);
  
  if (error || !folders) {
    throw new Error(`Failed to fetch folders: ${error?.message || 'Unknown error'}`);
  }
  
  console.log(`Found ${folders.length} high-level folders with main video IDs`);
  
  return folders.map(folder => ({
    id: folder.id,
    name: folder.name || 'Unknown',
    path: folder.path || '',
    path_depth: folder.path_depth,
    document_type_id: folder.document_type_id,
    main_video_id: folder.main_video_id
  }));
}

/**
 * Get video document information for a folder
 * First tries the main_video_id, then looks for related videos based on path
 */
async function getVideoDocumentInfo(mainVideoId: string | null, folderPath?: string, folderId?: string): Promise<{ title?: string; content?: string; fileName?: string; sourceInfo?: string }> {
  const supabaseClientService = SupabaseClientService.getInstance();
  const supabase = supabaseClientService.getClient();
  let sourceInfo = '';
  
  try {
    let videoId = mainVideoId;
    let videoSource = null;
    
    // If we have a mainVideoId, try to use it first
    if (mainVideoId) {
      // Get the sources_google record for the video
      const { data, error } = await supabase
        .from('sources_google')
        .select('id, name, mime_type, path')
        .eq('id', mainVideoId)
        .single();
      
      if (!error && data) {
        videoSource = data;
        sourceInfo = `Using main_video_id: ${mainVideoId}`;
      } else {
        sourceInfo = `Main video with ID ${mainVideoId} not found: ${error?.message || 'Not found'}`;
      }
    }
    
    // If we couldn't get a video from main_video_id and we have a folder path, 
    // try to find a related video based on the folder path
    if (!videoSource && folderPath) {
      // Search for video files that match the folder path pattern
      // Using LIKE pattern to match videos that might be in a subfolder but related
      const { data, error } = await supabase
        .from('sources_google')
        .select('id, name, mime_type, path')
        .like('path', `${folderPath}%`) // Find files with paths starting with the folder path
        .in('mime_type', ['video/mp4', 'video/quicktime']) // Common video MIME types
        .eq('is_deleted', false)
        .order('created_at', { ascending: false }) // Most recent first
        .limit(1);
      
      if (!error && data && data.length > 0) {
        videoSource = data[0];
        videoId = videoSource.id;
        sourceInfo = `Found video by path: ${videoSource.path}`;
      } else {
        sourceInfo += `\nNo related videos found by path: ${folderPath}`;
      }
    }
    
    // If we still don't have a video and we have folder ID, 
    // try to find videos with the same parent_folder_id
    if (!videoSource && folderId) {
      const { data, error } = await supabase
        .from('sources_google')
        .select('id, name, mime_type, path')
        .eq('parent_folder_id', folderId)
        .in('mime_type', ['video/mp4', 'video/quicktime'])
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })
        .limit(1);
      
      if (!error && data && data.length > 0) {
        videoSource = data[0];
        videoId = videoSource.id;
        sourceInfo = `Found video as child of folder: ${videoSource.path}`;
      } else {
        sourceInfo += `\nNo child videos found for folder ID: ${folderId}`;
      }
    }
    
    // If we still don't have a video, return empty
    if (!videoSource || !videoId) {
      return { sourceInfo };
    }
    
    // Now that we have a video ID, get the expert_document
    const { data: documents, error: docError } = await supabase
      .from('expert_documents')
      .select('id, title, raw_content')
      .eq('source_id', videoId);
    
    if (docError || !documents || documents.length === 0) {
      sourceInfo += `\nNo expert document found for video ID ${videoId}`;
      return { 
        fileName: videoSource.name,
        sourceInfo
      };
    }
    
    const document = documents[0];
    
    // Get first 3000 characters of content if available
    let contentPreview = '';
    if (document.raw_content) {
      contentPreview = document.raw_content.substring(0, 3000);
      // Add ellipsis if content was truncated
      if (document.raw_content.length > 3000) {
        contentPreview += '...';
      }
    }
    
    return {
      title: document.title,
      content: contentPreview,
      fileName: videoSource.name,
      sourceInfo
    };
  } catch (error) {
    console.log(`Error fetching video document info: ${error instanceof Error ? error.message : String(error)}`);
    return {};
  }
}

/**
 * Get the current experts assigned to a folder including relationship details
 */
async function getFolderExpertsWithRelationships(folderId: string): Promise<{ experts: MinimalExpert[], relationships: ExpertRelationship[] }> {
  const supabaseClientService = SupabaseClientService.getInstance();
  const supabase = supabaseClientService.getClient();
  
  const { data, error } = await supabase
    .from('sources_google_experts')
    .select(`
      id,
      is_primary,
      expert_id,
      source_id
    `)
    .eq('source_id', folderId);
  
  if (error) {
    throw new Error(`Failed to fetch folder experts: ${error.message}`);
  }
  
  if (!data || data.length === 0) {
    return { experts: [], relationships: [] };
  }
  
  // Store the relationships
  const relationships: ExpertRelationship[] = data.map(record => ({
    id: record.id,
    expert_id: record.expert_id,
    source_id: record.source_id,
    is_primary: record.is_primary || false
  }));
  
  // Get the unique expert IDs
  const expertIds = data.map(record => record.expert_id);
  
  // Fetch the actual expert details
  const { data: expertData, error: expertError } = await supabase
    .from('expert_profiles')
    .select('id, expert_name, full_name, mnemonic')
    .in('id', expertIds);
  
  if (expertError) {
    throw new Error(`Failed to fetch expert details: ${expertError.message}`);
  }
  
  const experts = (expertData || []).map(expert => {
    const name = expert.expert_name || expert.full_name || 'Unknown';
    
    // Use the database mnemonic if available, otherwise generate one
    let mnemonic = expert.mnemonic;
    if (!mnemonic) {
      const nameLower = name.toLowerCase();
      mnemonic = CUSTOM_MNEMONICS[nameLower] || createMnemonic(name, 0);
    }
    
    return { 
      id: expert.id, 
      name, 
      mnemonic
    };
  });
  
  return { experts, relationships };
}

/**
 * Get the current experts assigned to a folder
 */
async function getFolderExperts(folderId: string): Promise<MinimalExpert[]> {
  const { experts } = await getFolderExpertsWithRelationships(folderId);
  return experts;
}

/**
 * Display expert list with mnemonics for selection
 */
function displayExpertList(experts: MinimalExpert[]): void {
  loggerUtil.info('================================================================================');
  loggerUtil.info(`Mne | Expert Name`);
  loggerUtil.info('--------------------------------------------------------------------------------');
  
  // Display in two columns to save space
  const halfLength = Math.ceil(experts.length / 2);
  for (let i = 0; i < halfLength; i++) {
    const leftExpert = experts[i];
    const rightExpert = experts[i + halfLength];
    
    let line = `${leftExpert.mnemonic} | ${leftExpert.name.padEnd(30, ' ')}`;
    
    if (rightExpert) {
      line += `  ${rightExpert.mnemonic} | ${rightExpert.name}`;
    }
    
    loggerUtil.info(line);
  }
  
  loggerUtil.info('================================================================================');
}

/**
 * Delete an expert assignment from a folder
 */
async function deleteExpertFromFolder(options: {
  relationshipId: string;
  dryRun: boolean;
  verbose: boolean;
}): Promise<void> {
  const { 
    relationshipId, 
    dryRun, 
    verbose 
  } = options;
  
  if (verbose) {
    loggerUtil.info(`Delete options: ${JSON.stringify(options, null, 2)}`);
  }
  
  try {
    // Get Supabase client
    const supabaseClientService = SupabaseClientService.getInstance();
    const supabase = supabaseClientService.getClient();
    
    // Step 1: Verify relationship exists and get details for better logging
    if (verbose) loggerUtil.info(`Verifying relationship ID: ${relationshipId}`);
    
    const { data: relationshipData, error: relationshipError } = await supabase
      .from('sources_google_experts')
      .select(`
        id,
        source_id,
        expert_id,
        is_primary
      `)
      .eq('id', relationshipId)
      .single();
    
    if (relationshipError || !relationshipData) {
      throw new Error(`Relationship not found: ${relationshipError?.message || 'No relationship with that ID'}`);
    }
    
    // Get folder and expert details for better user feedback
    const { data: folderData, error: folderError } = await supabase
      .from('sources_google')
      .select('id, name')
      .eq('id', relationshipData.source_id)
      .single();
    
    if (folderError) {
      loggerUtil.warn(`Could not get folder details: ${folderError.message}`);
    }
    
    const { data: expertData, error: expertError } = await supabase
      .from('expert_profiles')
      .select('id, expert_name, full_name')
      .eq('id', relationshipData.expert_id)
      .single();
    
    if (expertError) {
      loggerUtil.warn(`Could not get expert details: ${expertError.message}`);
    }
    
    const folderName = folderData?.name || relationshipData.source_id;
    const expertName = expertData ? (expertData.expert_name || expertData.full_name) : relationshipData.expert_id;
    
    // Step 2: Delete the relationship
    if (dryRun) {
      loggerUtil.info(`[DRY RUN] Would delete the relationship between:`);
      loggerUtil.info(`- Folder: ${folderName} (${relationshipData.source_id})`);
      loggerUtil.info(`- Expert: ${expertName} (${relationshipData.expert_id})`);
      return;
    }
    
    const { error: deleteError } = await supabase
      .from('sources_google_experts')
      .delete()
      .eq('id', relationshipId);
    
    if (deleteError) {
      throw new Error(`Failed to delete relationship: ${deleteError.message}`);
    }
    
    if (verbose) {
      loggerUtil.info(`✅ Successfully deleted relationship between folder "${folderName}" and expert "${expertName}"`);
    }
    
  } catch (error: any) {
    loggerUtil.error(`Error deleting expert assignment: ${error?.message || error}`);
  }
}

/**
 * Assign an expert to a specific folder
 */
async function assignExpertToFolder(options: {
  folderId: string;
  expertId: string;
  isPrimary: boolean;
  dryRun: boolean;
  verbose: boolean;
}): Promise<void> {
  const { 
    folderId, 
    expertId, 
    isPrimary, 
    dryRun, 
    verbose 
  } = options;
  
  if (verbose) {
    loggerUtil.info(`Options: ${JSON.stringify(options, null, 2)}`);
  }
  
  try {
    // Get Supabase client
    const supabaseClientService = SupabaseClientService.getInstance();
    const supabase = supabaseClientService.getClient();
    
    // Step 1: Verify folder exists
    if (verbose) loggerUtil.info(`Verifying folder ID: ${folderId}`);
    const { data: folderData, error: folderError } = await supabase
      .from('sources_google')
      .select('id, name, path, path_depth, main_video_id')
      .eq('id', folderId)
      .single();
    
    if (folderError || !folderData) {
      throw new Error(`Folder not found: ${folderError?.message || 'No folder with that ID'}`);
    }
    
    // Step 2: Verify expert exists
    if (verbose) loggerUtil.info(`Verifying expert ID: ${expertId}`);
    const { data: expertData, error: expertError } = await supabase
      .from('expert_profiles')
      .select('id, expert_name, full_name')
      .eq('id', expertId)
      .single();
    
    if (expertError || !expertData) {
      throw new Error(`Expert not found: ${expertError?.message || 'No expert with that ID'}`);
    }
    
    const expertName = expertData.expert_name || expertData.full_name;
    
    // Step 3: Check if this relationship already exists
    if (verbose) loggerUtil.info(`Checking for existing relationship between folder and expert...`);
    const { data: existingLink, error: linkError } = await supabase
      .from('sources_google_experts')
      .select('id')
      .eq('source_id', folderId)
      .eq('expert_id', expertId);
    
    if (linkError) {
      loggerUtil.warn(`Error checking for existing link: ${linkError.message}`);
    } else if (existingLink && existingLink.length > 0) {
      if (verbose) {
        loggerUtil.warn(`A link already exists between this folder and expert`);
        loggerUtil.info(`Link ID: ${existingLink[0].id}`);
      }
      
      if (!dryRun) {
        // Update the existing link
        const { error: updateError } = await supabase
          .from('sources_google_experts')
          .update({
            is_primary: isPrimary,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingLink[0].id);
          
        if (updateError) {
          throw new Error(`Failed to update existing link: ${updateError.message}`);
        }
        
        if (verbose) {
          loggerUtil.info(`Successfully updated link between folder "${folderData.name}" and expert "${expertName}"`);
        }
        return;
      }
    }
    
    // Step 4: Create the link if it doesn't exist
    if (dryRun) {
      loggerUtil.info(`[DRY RUN] Would create link between:`);
      loggerUtil.info(`- Folder: ${folderData.name} (${folderId})`);
      loggerUtil.info(`- Expert: ${expertName} (${expertId})`);
      loggerUtil.info(`- Primary: ${isPrimary}`);
      return;
    }
    
    // Insert the record
    const { data: insertData, error: insertError } = await supabase
      .from('sources_google_experts')
      .insert({
        source_id: folderId,
        expert_id: expertId,
        is_primary: isPrimary,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select();
    
    if (insertError) {
      throw new Error(`Failed to create link: ${insertError.message}`);
    }
    
    if (verbose) {
      loggerUtil.info(`Successfully created link between folder "${folderData.name}" and expert "${expertName}"`);
      loggerUtil.info(`Link ID: ${insertData[0].id}`);
    }
    
  } catch (error: any) {
    loggerUtil.error(`Error assigning expert: ${error?.message || error}`);
  }
}

/**
 * Run the interactive mode for assigning multiple experts to a single folder
 * This mode allows adding multiple experts to the same folder until user moves to next folder
 */
async function runInteractiveFolderMode(folderId: string, options: AssignMultipleFolderExpertsOptions): Promise<boolean> {
  const { dryRun, verbose } = options;
  
  // Create a new readline interface for each iteration
  const createReadlineInterface = () => {
    return readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
  };
  
  const questionAsync = (query: string): Promise<string> => {
    const rl = createReadlineInterface();
    return new Promise(resolve => {
      rl.question(query, (answer) => {
        rl.close();
        resolve(answer);
      });
    });
  };
  
  try {
    // Get Supabase client
    const supabaseClientService = SupabaseClientService.getInstance();
    const supabase = supabaseClientService.getClient();
    
    // Get folder details
    const { data: folderData, error: folderError } = await supabase
      .from('sources_google')
      .select('id, name, path, path_depth, document_type_id, main_video_id')
      .eq('id', folderId)
      .single();
    
    if (folderError || !folderData) {
      loggerUtil.error(`Folder not found: ${folderError?.message || 'No folder with that ID'}`);
      return false;
    }
    
    // Get all experts with mnemonics for selection
    const experts = await getAllExperts();
    
    // Get current experts for this folder with relationship details for potential deletion
    const { experts: currentExperts, relationships } = await getFolderExpertsWithRelationships(folderId);
    
    // Create a mnemonic-to-relationship map for easy lookup during DELETE operations
    const mnemonicToRelationship = new Map<string, ExpertRelationship>();
    for (let i = 0; i < currentExperts.length; i++) {
      const expert = currentExperts[i];
      // Find the relationship for this expert
      const relationship = relationships.find(rel => rel.expert_id === expert.id);
      if (expert && relationship && expert.mnemonic) {
        mnemonicToRelationship.set(expert.mnemonic.toLowerCase(), relationship);
      }
    }
    
    // Get video document info if available
    // Pass folder path and ID to help find the right video if main_video_id is not accurate
    const videoInfo = await getVideoDocumentInfo(folderData.main_video_id, folderData.path, folderId);
    
    // Display the expert list with mnemonics first
    loggerUtil.info('\n================================================================================');
    loggerUtil.info(`EXPERT MNEMONICS LIST`);
    loggerUtil.info('================================================================================');
    displayExpertList(experts);
    
    // Display video content if available
    if (videoInfo.title || videoInfo.content || videoInfo.fileName || videoInfo.sourceInfo) {
      loggerUtil.info('\n================================================================================');
      loggerUtil.info(`VIDEO CONTENT`);
      loggerUtil.info('================================================================================');
      
      if (videoInfo.sourceInfo) {
        loggerUtil.info(`SOURCE INFO: ${videoInfo.sourceInfo}`);
        loggerUtil.info('');
      }
      
      if (videoInfo.fileName) {
        loggerUtil.info(`VIDEO FILE: ${videoInfo.fileName}`);
        loggerUtil.info('');
      }
      
      if (videoInfo.title) {
        loggerUtil.info(`TITLE: ${videoInfo.title}`);
        loggerUtil.info('');
      }
      
      if (videoInfo.content) {
        loggerUtil.info(`CONTENT PREVIEW:`);
        loggerUtil.info('--------------------------------------------------------------------------------');
        loggerUtil.info(videoInfo.content);
        loggerUtil.info('--------------------------------------------------------------------------------');
      }
    }
    
    // Display folder information last
    loggerUtil.info('\n================================================================================');
    loggerUtil.info(`FOLDER INFORMATION`);
    loggerUtil.info('================================================================================');
    loggerUtil.info(`FOLDER: ${folderData.name}`);
    loggerUtil.info(`PATH: ${folderData.path}`);
    loggerUtil.info(`PATH DEPTH: ${folderData.path_depth}`);
    if (folderData.main_video_id) {
      loggerUtil.info(`HAS MAIN VIDEO: Yes (ID: ${folderData.main_video_id})`);
    }
    
    // Display current experts if any
    if (currentExperts.length > 0) {
      loggerUtil.info('\nCURRENT EXPERTS ASSIGNED TO THIS FOLDER:');
      currentExperts.forEach(expert => {
        const relationship = mnemonicToRelationship.get(expert.mnemonic.toLowerCase());
        loggerUtil.info(`- ${expert.mnemonic} | ${expert.name} ${relationship ? `| Relationship ID: ${relationship.id}` : ''}`);
      });
      
      // Instructions for DELETE
      loggerUtil.info('\nTo delete an expert from this folder, type DELETE followed by the expert\'s mnemonic');
      loggerUtil.info('Example: DELETE WAG');
    }
    
    loggerUtil.info('\n================================================================================');
    
    // Keep processing the same folder until the user moves to the next one
    let keepAddingExperts = true;
    while (keepAddingExperts) {
      // Get user input
      const mnemonicInput = await questionAsync('\nEnter expert mnemonic (or press Enter/NEXT to move to next folder, "SKIP" to skip this folder, "DONE" to finish, "LIST" to see experts, "DELETE <mnemonic>" to remove expert): ');
      
      const input = mnemonicInput.trim().toUpperCase();
      
      // Check for special commands
      if (input === 'NEXT' || input === '') {
        loggerUtil.info('Moving to the next folder...');
        return true; // Continue to the next folder
      } else if (input === 'SKIP') {
        loggerUtil.info('Skipping this folder...');
        return true; // Continue to the next folder
      } else if (input === 'DONE') {
        loggerUtil.info('Finishing the assignment process...');
        return false; // Stop processing folders
      } else if (input === 'LIST') {
        // Show expert list again
        displayExpertList(experts);
        continue;
      } else if (input.startsWith('DELETE ')) {
        // Handle DELETE command
        const expertMnemonic = input.substring(7).trim().toLowerCase(); // Remove "DELETE " prefix
        
        if (!expertMnemonic) {
          loggerUtil.error('❌ Please specify an expert mnemonic to delete (e.g. DELETE WAG)');
          continue;
        }
        
        // Look up the relationship based on the mnemonic
        const relationship = mnemonicToRelationship.get(expertMnemonic);
        if (!relationship) {
          loggerUtil.error(`❌ No expert with mnemonic "${expertMnemonic.toUpperCase()}" found for this folder`);
          continue;
        }
        
        // Get expert details for better user feedback
        const expertToDelete = currentExperts.find(e => e.mnemonic.toLowerCase() === expertMnemonic);
        if (!expertToDelete) {
          loggerUtil.error(`❌ Cannot find expert with mnemonic "${expertMnemonic.toUpperCase()}"`);
          continue;
        }
        
        // Confirm deletion
        const confirmDelete = await questionAsync(`Are you sure you want to delete expert "${expertToDelete.name}" (${expertMnemonic.toUpperCase()}) from this folder? (y/n): `);
        if (confirmDelete.toLowerCase() !== 'y') {
          loggerUtil.info('Deletion cancelled.');
          continue;
        }
        
        // Delete the relationship
        await deleteExpertFromFolder({
          relationshipId: relationship.id,
          dryRun: dryRun,
          verbose: verbose
        });
        
        if (!dryRun) {
          // Remove from the current experts list and relationship map
          const expertIndex = currentExperts.findIndex(e => e.mnemonic.toLowerCase() === expertMnemonic);
          if (expertIndex !== -1) {
            currentExperts.splice(expertIndex, 1);
          }
          mnemonicToRelationship.delete(expertMnemonic);
          
          loggerUtil.info(`✅ Removed expert "${expertToDelete.name}" from folder "${folderData.name}"`);
        } else {
          loggerUtil.info(`[DRY RUN] Would remove expert "${expertToDelete.name}" from folder "${folderData.name}"`);
        }
        
        continue;
      }
      
      // Find the expert with this mnemonic
      const mnemonicToFind = input.toLowerCase();
      const expert = experts.find(e => (e.mnemonic || '').toLowerCase() === mnemonicToFind);
      
      if (!expert) {
        loggerUtil.error(`❌ Expert with mnemonic "${input}" not found. Try again...`);
        continue;
      }
      
      // Check if this expert is already assigned to avoid duplicates
      const alreadyAssigned = currentExperts.some(e => e.id === expert.id);
      if (alreadyAssigned) {
        const confirmReassign = await questionAsync(`Expert "${expert.name}" is already assigned to this folder. Reassign anyway? (y/n): `);
        if (confirmReassign.toLowerCase() !== 'y') {
          loggerUtil.info('Skipping reassignment...');
          continue;
        }
      }
      
      // Assign the expert to this folder
      await assignExpertToFolder({
        folderId: folderId,
        expertId: expert.id,
        isPrimary: alreadyAssigned ? false : currentExperts.length === 0, // First expert is primary
        dryRun: dryRun,
        verbose: verbose
      });
      
      loggerUtil.info(`✅ ${dryRun ? '[DRY RUN] Would assign' : 'Assigned'} expert "${expert.name}" to folder "${folderData.name}"`);
      
      // Add to the current experts list if not in dry run mode
      if (!dryRun && !alreadyAssigned) {
        currentExperts.push(expert);
      }
    }
    
    return true;
    
  } catch (error: any) {
    loggerUtil.error(`Error in interactive folder mode: ${error?.message || error}`);
    return false;
  }
}

/**
 * Run the interactive mode for assigning multiple experts to folders
 */
async function runInteractiveMode(options: AssignMultipleFolderExpertsOptions): Promise<void> {
  const { dryRun, verbose, limit = 50 } = options;
  
  // Create a new readline interface for each iteration
  const createReadlineInterface = () => {
    return readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
  };
  
  const questionAsync = (query: string): Promise<string> => {
    const rl = createReadlineInterface();
    return new Promise(resolve => {
      rl.question(query, (answer) => {
        rl.close();
        resolve(answer);
      });
    });
  };
  
  try {
    // Get all experts with mnemonics at the start (for reference)
    const experts = await getAllExperts();
    loggerUtil.info(`Found ${experts.length} experts in the system.`);
    
    // Get folders for expert assignment
    const folders = await getFoldersForExpertAssignment(limit);
    loggerUtil.info(`\nFound ${folders.length} folders that may need additional expert assignments.\n`);
    
    if (folders.length === 0) {
      loggerUtil.info('No folders found for expert assignment.');
      return;
    }
    
    // Confirm before proceeding
    const confirmAnswer = await questionAsync('Do you want to proceed with assignment? (y/n): ');
    if (confirmAnswer.toLowerCase() !== 'y') {
      loggerUtil.info('Cancelled assignment process.');
      return;
    }
    
    // Process folders one at a time
    for (let i = 0; i < folders.length; i++) {
      const folder = folders[i];
      
      // Display progress
      loggerUtil.info(`\nProcessing folder ${i+1} of ${folders.length}`);
      
      // Process this folder and allow multiple expert assignments
      const shouldContinue = await runInteractiveFolderMode(folder.id, options);
      
      // If false is returned, stop processing folders
      if (!shouldContinue) {
        loggerUtil.info('Stopping folder processing as requested.');
        break;
      }
    }
    
    loggerUtil.info('\n🎉 Completed expert assignment process!');
    
  } catch (error: any) {
    loggerUtil.error(`Error in interactive mode: ${error?.message || error}`);
  }
}

/**
 * Main function for assigning multiple experts to folders
 */
export async function assignMultipleFolderExperts(options: AssignMultipleFolderExpertsOptions): Promise<void> {
  const { folderId, dryRun, verbose, limit = 50 } = options;
  
  if (verbose) {
    loggerUtil.info(`Options: ${JSON.stringify(options, null, 2)}`);
  }
  
  try {
    // If a specific folder ID is provided, only process that folder
    if (folderId) {
      loggerUtil.info(`Processing only folder with ID: ${folderId}`);
      await runInteractiveFolderMode(folderId, options);
      return;
    }
    
    // Otherwise, run the full interactive mode
    await runInteractiveMode(options);
    
  } catch (error: any) {
    loggerUtil.error(`Error assigning experts to folders: ${error?.message || error}`);
  }
}