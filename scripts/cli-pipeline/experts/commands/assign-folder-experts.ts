/**
 * Assign Folder Experts Command
 * 
 * Interactively assign experts to high-level folders (path_depth = 0)
 * with document_type_id = bd903d99-64a1-4297-ba76-1094ab235dac
 * that don't have experts assigned.
 */

import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';
import { Logger } from '../../../../packages/shared/utils/logger';
import * as readline from 'readline';
// Work around TypeScript error for Winston import
const loggerUtil = Logger;

// Interface for command options
interface AssignFolderExpertsOptions {
  dryRun: boolean;
  isPrimary: boolean;
  verbose: boolean;
  limit?: number;
  skipAssigned?: boolean;
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
  document_type_id: string;
  path_depth: number;
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
 * Get high-level folders with path_depth = 0 that need expert assignment
 */
async function getHighLevelFoldersNeedingExperts(): Promise<MinimalFolder[]> {
  const supabaseClientService = SupabaseClientService.getInstance();
  const supabase = supabaseClientService.getClient();
  
  // Find high-level folders with path_depth = 0 that don't have expert links
  const { data: folders, error } = await supabase
    .from('google_sources')
    .select(`
      id, 
      name, 
      path,
      path_depth,
      document_type_id,
      google_sources_experts!left(id)
    `)
    .eq('document_type_id', 'bd903d99-64a1-4297-ba76-1094ab235dac')
    .eq('path_depth', 0)
    .eq('is_deleted', false)
    .eq('mime_type', 'application/vnd.google-apps.folder')
    .order('name');
  
  if (error || !folders) {
    throw new Error(`Failed to fetch folders: ${error?.message || 'Unknown error'}`);
  }
  
  // Filter out folders that already have experts assigned
  return folders
    .filter(folder => folder.google_sources_experts.length === 0)
    .map(folder => ({
      id: folder.id,
      name: folder.name,
      path: folder.path,
      document_type_id: folder.document_type_id,
      path_depth: folder.path_depth
    }));
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
      .from('google_sources')
      .select('id, name, path, path_depth')
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
      .from('google_sources_experts')
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
          .from('google_sources_experts')
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
      .from('google_sources_experts')
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
 * Run the interactive mode for assigning experts to folders
 */
async function runInteractiveMode(options: AssignFolderExpertsOptions): Promise<void> {
  const { dryRun, verbose } = options;
  
  // Create a new readline interface for each iteration
  // to avoid "readline was closed" errors
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
    // Get all experts with mnemonics
    const experts = await getAllExperts();
    loggerUtil.info(`Found ${experts.length} experts in the system.`);
    
    // Display the expert list with mnemonics
    displayExpertList(experts);
    
    // Get high-level folders needing experts
    const folders = await getHighLevelFoldersNeedingExperts();
    loggerUtil.info(`\nFound ${folders.length} high-level folders (path_depth = 0) that need expert assignment.\n`);
    
    if (folders.length === 0) {
      loggerUtil.info('No high-level folders found that need expert assignment.');
      return;
    }
    
    // Track processed folders to avoid showing them again
    const processedFolderIds = new Set<string>();
    
    // Confirm before proceeding
    const confirmAnswer = await questionAsync('Do you want to proceed with assignment? (y/n): ');
    if (confirmAnswer.toLowerCase() !== 'y') {
      loggerUtil.info('Cancelled assignment process.');
      return;
    }
    
    // Main loop - process folders until done or interrupted
    let keepGoing = true;
    while (keepGoing) {
      // Filter out folders we've already processed (whether assigned or skipped)
      const remainingFolders = folders.filter(folder => !processedFolderIds.has(folder.id));
      
      if (remainingFolders.length === 0) {
        loggerUtil.info('🎉 All folders have been assigned experts or skipped!');
        keepGoing = false;
        break;
      }
      
      // Get the next folder to process
      const currentFolder = remainingFolders[0];
      
      // Mark this folder as processed so we don't show it again
      processedFolderIds.add(currentFolder.id);
      
      loggerUtil.info('\n================================================================================');
      loggerUtil.info(`FOLDER: ${currentFolder.name}`);
      loggerUtil.info(`PATH: ${currentFolder.path}`);
      loggerUtil.info(`PATH DEPTH: ${currentFolder.path_depth}`);
      loggerUtil.info('================================================================================');
      
      // Get user input
      const mnemonicInput = await questionAsync('Enter expert mnemonic (or "SKIP" to skip, Ctrl+C to quit): ');
      
      // Handle empty input or explicit SKIP command
      if (!mnemonicInput.trim() || mnemonicInput.trim().toUpperCase() === 'SKIP') {
        loggerUtil.info('Skipping this folder and moving to next...');
        continue;
      }
      
      // Find the expert with this mnemonic
      const mnemonicToFind = mnemonicInput.trim().toLowerCase();
      const expert = experts.find(e => (e.mnemonic || '').toLowerCase() === mnemonicToFind);
      
      if (!expert) {
        loggerUtil.error(`❌ Expert with mnemonic "${mnemonicInput}" not found. Try again...`);
        // Remove from processed so we'll show this folder again
        processedFolderIds.delete(currentFolder.id);
        continue;
      }
      
      // Assign the expert to this folder
      await assignExpertToFolder({
        folderId: currentFolder.id,
        expertId: expert.id,
        isPrimary: options.isPrimary,
        dryRun: dryRun,
        verbose: verbose
      });
      
      loggerUtil.info(`✅ ${dryRun ? '[DRY RUN] Would assign' : 'Assigned'} expert "${expert.name}" to folder "${currentFolder.name}"`);
    }
  } catch (error: any) {
    loggerUtil.error(`Error in interactive mode: ${error?.message || error}`);
  }
}

/**
 * Main function for assigning experts to high-level folders
 */
export async function assignFolderExperts(options: AssignFolderExpertsOptions): Promise<void> {
  const { dryRun, isPrimary, verbose, limit = 50 } = options;
  
  if (verbose) {
    loggerUtil.info(`Options: ${JSON.stringify(options, null, 2)}`);
  }
  
  try {
    loggerUtil.info('Assigning experts to high-level folders with path_depth = 0...');
    
    // Get Supabase client
    const supabaseClientService = SupabaseClientService.getInstance();
    const supabase = supabaseClientService.getClient();
    
    // Count total high-level folders with path_depth = 0
    const { data: folderCountData, error: folderCountError } = await supabase
      .from('google_sources')
      .select('id', { count: 'exact' })
      .eq('document_type_id', 'bd903d99-64a1-4297-ba76-1094ab235dac')
      .eq('path_depth', 0)
      .eq('is_deleted', false)
      .eq('mime_type', 'application/vnd.google-apps.folder');
    
    if (folderCountError) {
      throw new Error(`Failed to count folders: ${folderCountError.message}`);
    }
    
    const totalFolders = folderCountData?.length || 0;
    loggerUtil.info(`Found ${totalFolders} high-level folders with path_depth = 0.`);
    
    // Run the interactive assignment process
    await runInteractiveMode(options);
    
  } catch (error: any) {
    loggerUtil.error(`Error assigning experts to folders: ${error?.message || error}`);
  }
}