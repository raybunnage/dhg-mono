import { getActiveFilterProfile } from './get-active-filter-profile';

/**
 * Display the active drive filter status prominently in the console
 * This helps users always know which filter is active
 * @returns The active filter profile if one exists
 */
export async function displayActiveFilter() {
  const activeFilter = await getActiveFilterProfile();
  
  if (activeFilter && activeFilter.rootDriveId) {
    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║ 🔍 ACTIVE DRIVE FILTER                                         ║');
    console.log('╠════════════════════════════════════════════════════════════════╣');
    console.log(`║ Profile: "${activeFilter.profile.name}"`);
    console.log(`║ Root Drive ID: ${activeFilter.rootDriveId}`);
    console.log('║ ⚠️  Only items within this root drive will be processed        ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');
  } else {
    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║ 🔍 NO ACTIVE DRIVE FILTER                                      ║');
    console.log('╠════════════════════════════════════════════════════════════════╣');
    console.log('║ All drives and folders are accessible                          ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');
  }
  
  return activeFilter;
}