/**
 * List Experts Command
 * 
 * Displays a list of experts to help with assignment
 * Includes a unique mnemonic shortcut for each expert
 */

import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';
import { Logger } from '../../../../packages/shared/utils/logger';
// Work around TypeScript error for Winston import
const loggerUtil = Logger;

// Interface for command options
interface ListExpertsOptions {
  limit?: number;
  verbose: boolean;
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
 * Get mnemonic shortcut for an expert name using the custom mnemonics
 * from expert-list.md
 */
function createMnemonic(name: string, index: number): string {
  if (!name) return '???';
  
  const nameLower = name.toLowerCase();
  
  // If there's a custom mnemonic defined, use it
  if (CUSTOM_MNEMONICS[nameLower]) {
    return CUSTOM_MNEMONICS[nameLower];
  }
  
  // Fallback to generated mnemonic logic if no custom mnemonic is found
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
 * List experts in the system
 */
export async function listExperts(options: ListExpertsOptions): Promise<void> {
  const { limit = 100, verbose } = options;
  
  try {
    loggerUtil.info('Fetching experts...');
    
    // Get Supabase client
    const supabaseClientService = SupabaseClientService.getInstance();
    const supabase = supabaseClientService.getClient();
    
    // Get all experts
    const { data: experts, error: expertsError } = await supabase
      .from('experts')
      .select('id, expert_name, full_name, mnemonic')
      .order('expert_name')
      .limit(limit);
    
    if (expertsError) {
      throw new Error(`Failed to fetch experts: ${expertsError.message}`);
    }
    
    if (!experts || experts.length === 0) {
      loggerUtil.warn('No experts found in the database.');
      return;
    }
    
    // Get experts with mnemonics from database or fall back to custom/generated ones
    const expertsWithMnemonics = experts.map((expert, index) => {
      const name = expert.expert_name || expert.full_name || 'Unknown';
      // Use mnemonic from database if available, otherwise fall back to custom mapping or generate one
      const mnemonic = expert.mnemonic || createMnemonic(name, index);
      return { ...expert, mnemonic, name };
    });
    
    // Generate a table-like display
    loggerUtil.info(`Found ${experts.length} experts:`);
    loggerUtil.info('================================================================================');
    loggerUtil.info(`Mne | Name                  | ID`);
    loggerUtil.info('--------------------------------------------------------------------------------');
    
    expertsWithMnemonics.forEach((expert) => {
      loggerUtil.info(`${expert.mnemonic.padEnd(3, ' ')} | ${expert.name.padEnd(20, ' ')} | ${expert.id}`);
      
      if (verbose) {
        loggerUtil.info(`  Assignment command: ./scripts/cli-pipeline/experts/experts-cli.sh assign-expert --expert-id ${expert.id} --folder-id <FOLDER_ID>`);
        loggerUtil.info('--------------------------------------------------------------------------------');
      }
    });
    
    loggerUtil.info('================================================================================');
    loggerUtil.info(`To assign an expert to a folder, use the assign-expert command with the expert ID.`);
    
  } catch (error: any) {
    loggerUtil.error(`Error listing experts: ${error?.message || error}`);
  }
}