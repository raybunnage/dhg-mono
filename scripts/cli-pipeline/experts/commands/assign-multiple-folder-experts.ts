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
    .from('experts')
    .select('id, expert_name, full_name, mnemonic')
    .order('expert_name');
    
  if (error || !experts) {
    throw new Error(`Failed to fetch experts: ${error?.message || 'Unknown error'}`);
  }
  
  return experts.map((expert) => {
    const name = expert.expert_name || expert.full_name || 'Unknown';
    
    // Use the database mnemonic if available, otherwise fall back to the mapping or generate one
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
}

/**
 * Get a list of folders that might need multiple expert assignments
 * Focuses on high-level folders (path_depth = 0) that likely represent presentations
 */
async function getFoldersForExpertAssignment(limit: number = 50): Promise<MinimalFolder[]> {
  const supabaseClientService = SupabaseClientService.getInstance();
  const supabase = supabaseClientService.getClient();
  
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
    .limit(limit);
  
  if (error || !folders) {
    throw new Error(`Failed to fetch folders: ${error?.message || 'Unknown error'}`);
  }
  
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
 * Get the current experts assigned to a folder
 */
async function getFolderExperts(folderId: string): Promise<MinimalExpert[]> {
  const supabaseClientService = SupabaseClientService.getInstance();
  const supabase = supabaseClientService.getClient();
  
  const { data, error } = await supabase
    .from('sources_google_experts')
    .select(`
      id,
      is_primary,
      expert_id
    `)
    .eq('source_id', folderId);
  
  if (error) {
    throw new Error(`Failed to fetch folder experts: ${error.message}`);
  }
  
  if (!data || data.length === 0) {
    return [];
  }
  
  // Get the unique expert IDs
  const expertIds = data.map(record => record.expert_id);
  
  // Fetch the actual expert details
  const { data: expertData, error: expertError } = await supabase
    .from('experts')
    .select('id, expert_name, full_name, mnemonic')
    .in('id', expertIds);
  
  if (expertError) {
    throw new Error(`Failed to fetch expert details: ${expertError.message}`);
  }
  
  return (expertData || []).map(expert => {
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
      .from('experts')
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
    
    // Display the header with folder information
    loggerUtil.info('\n================================================================================');
    loggerUtil.info(`FOLDER: ${folderData.name}`);
    loggerUtil.info(`PATH: ${folderData.path}`);
    loggerUtil.info(`PATH DEPTH: ${folderData.path_depth}`);
    if (folderData.main_video_id) {
      loggerUtil.info(`HAS MAIN VIDEO: Yes`);
    }
    loggerUtil.info('================================================================================');
    
    // Get and display current experts for this folder
    const currentExperts = await getFolderExperts(folderId);
    if (currentExperts.length > 0) {
      loggerUtil.info('\nCurrent experts assigned to this folder:');
      currentExperts.forEach(expert => {
        loggerUtil.info(`- ${expert.mnemonic} | ${expert.name}`);
      });
      loggerUtil.info('');
    }
    
    // Display the expert list with mnemonics
    displayExpertList(experts);
    
    // Keep processing the same folder until the user moves to the next one
    let keepAddingExperts = true;
    while (keepAddingExperts) {
      // Get user input
      const mnemonicInput = await questionAsync('\nEnter expert mnemonic (or "NEXT" to move to next folder, "SKIP" to skip this folder, "DONE" to finish, "LIST" to see experts): ');
      
      const input = mnemonicInput.trim().toUpperCase();
      
      // Check for special commands
      if (input === 'NEXT') {
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
      } else if (input === '') {
        continue; // Empty input, just continue
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