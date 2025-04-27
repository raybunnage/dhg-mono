/**
 * Add Expert Command
 * 
 * Creates a new expert record in the database
 */

import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';
import { Logger } from '../../../../packages/shared/utils/logger';
// Work around TypeScript error for Winston import
const loggerUtil = Logger;

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

// Interface for command options
interface AddExpertOptions {
  expertName: string;
  fullName?: string;
  expertiseArea?: string;
  isInCoreGroup?: boolean;
  mnemonic?: string;
  dryRun: boolean;
  verbose: boolean;
}

/**
 * Add a new expert to the system
 */
export async function addExpert(options: AddExpertOptions): Promise<void> {
  const { 
    expertName, 
    fullName, 
    expertiseArea, 
    isInCoreGroup,
    mnemonic,
    dryRun, 
    verbose 
  } = options;
  
  if (verbose) {
    loggerUtil.info(`Options: ${JSON.stringify(options, null, 2)}`);
  }
  
  // Log what we have
  if (verbose) {
    loggerUtil.info(`Command line arguments: ${process.argv.join(' ')}`);
    loggerUtil.info(`Expert name from options: ${expertName || 'None found'}`);
  }
  
  if (!expertName) {
    loggerUtil.error('Expert name is required. Use --expert-name option.');
    return;
  }
  
  // Log mnemonic info if verbose
  if (verbose && mnemonic) {
    loggerUtil.info(`Using provided mnemonic: ${mnemonic}`);
  }
  
  try {
    // More verbose logging for debugging
    if (verbose) {
      loggerUtil.info(`Debug: expertName = "${expertName}"`);
      loggerUtil.info(`Debug: fullName = "${fullName}"`);
      loggerUtil.info(`Debug: expertiseArea = "${expertiseArea}"`);
      loggerUtil.info(`Debug: isInCoreGroup = ${isInCoreGroup}`);
      loggerUtil.info(`Debug: mnemonic = "${mnemonic}"`);
    }
    
    // Get Supabase client
    const supabaseClientService = SupabaseClientService.getInstance();
    const supabase = supabaseClientService.getClient();
    
    // Check if the expert already exists
    const { data: existingExperts, error: checkError } = await supabase
      .from('experts')
      .select('id, expert_name')
      .eq('expert_name', expertName)
      .limit(1);
    
    if (checkError) {
      throw new Error(`Failed to check for existing expert: ${checkError.message}`);
    }
    
    if (existingExperts && existingExperts.length > 0) {
      loggerUtil.warn(`Expert with name "${expertName}" already exists (ID: ${existingExperts[0].id})`);
      return;
    }
    
    // Create mnemonic for display in dry run
    let expertMnemonic = mnemonic;
    if (!expertMnemonic) {
      // Check if there's a predefined mnemonic for this expert name
      const nameLower = expertName.toLowerCase();
      if (CUSTOM_MNEMONICS && nameLower in CUSTOM_MNEMONICS) {
        expertMnemonic = CUSTOM_MNEMONICS[nameLower];
      } else {
        // Generate a simple mnemonic (first 3 letters of name)
        expertMnemonic = expertName.slice(0, 3).toUpperCase();
      }
    }
    
    // If dry run, just show what would be added
    if (dryRun) {
      loggerUtil.info(`[DRY RUN] Would add expert:`);
      loggerUtil.info(`- Name: ${expertName}`);
      if (fullName) loggerUtil.info(`- Full Name: ${fullName}`);
      if (expertiseArea) loggerUtil.info(`- Expertise: ${expertiseArea}`);
      loggerUtil.info(`- Core Group: ${isInCoreGroup ? 'Yes' : 'No'}`);
      loggerUtil.info(`- Mnemonic: ${expertMnemonic}`);
      return;
    }
    
    // We've already created the mnemonic above, so we can reuse it here
    
    // Insert the new expert
    const { data: insertedExpert, error: insertError } = await supabase
      .from('experts')
      .insert({
        expert_name: expertName,
        full_name: fullName || expertName,
        expertise_area: expertiseArea || null,
        is_in_core_group: isInCoreGroup || false,
        mnemonic: expertMnemonic,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select();
    
    if (insertError) {
      throw new Error(`Failed to add expert: ${insertError.message}`);
    }
    
    loggerUtil.info(`✅ Successfully added expert "${expertName}" with ID: ${insertedExpert[0].id}`);
    
  } catch (error: any) {
    loggerUtil.error(`Error adding expert: ${error?.message || error}`);
  }
}