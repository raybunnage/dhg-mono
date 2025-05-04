#!/usr/bin/env node
/**
 * Sync Dynamic Healing Discussion Group folder
 * 
 * This script fixes and syncs the Dynamic Healing Group folder.
 * 
 * Usage:
 *   node tmp/sync-healing-folder.js [--dry-run]
 * 
 * Options:
 *   --dry-run   Show what would be synced without making changes
 */

const { execSync } = require('child_process');
const path = require('path');

// Root folder ID
const DYNAMIC_HEALING_FOLDER_ID = '1wriOM2j2IglnMcejplqG_XcCxSIfoRMV';

// Process command-line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const dryRunFlag = isDryRun ? '--dry-run' : '';

console.log('=== Syncing Dynamic Healing Discussion Group Folder ===');
console.log(`Mode: ${isDryRun ? 'DRY RUN' : 'ACTUAL SYNC'}`);

// First, fix the folder structure issues
console.log('\n*** Step 1: Fixing folder structure issues ***');
try {
  const fixCommand = `node ${path.resolve(__dirname, 'fix-drive-roots.js')} ${dryRunFlag}`;
  console.log(`Running: ${fixCommand}`);
  
  const fixOutput = execSync(fixCommand, { encoding: 'utf8' });
  console.log(fixOutput);
} catch (error) {
  console.error('Error fixing drive roots:', error.message);
  process.exit(1);
}

// Now sync the Dynamic Healing folder
console.log('\n*** Step 2: Syncing Dynamic Healing Discussion Group folder ***');
try {
  const dynamicHealingCommand = `ts-node ${path.resolve(__dirname, '../scripts/dynamic-healing-sync.ts')} ${dryRunFlag}`;
  console.log(`Running: ${dynamicHealingCommand}`);
  
  const dynamicHealingOutput = execSync(dynamicHealingCommand, { encoding: 'utf8' });
  console.log(dynamicHealingOutput);
} catch (error) {
  console.error('Error syncing Dynamic Healing folder:', error.message);
  process.exit(1);
}

console.log('\n=== Sync Complete ===');
console.log('Dynamic Healing folder has been synced successfully!');
console.log(`Mode: ${isDryRun ? 'DRY RUN (no changes made)' : 'ACTUAL SYNC (changes applied)'}`);