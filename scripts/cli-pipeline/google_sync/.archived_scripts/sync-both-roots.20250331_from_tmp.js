#!/usr/bin/env node
/**
 * Sync Both Root Folders
 * 
 * This script performs a full recursive sync of both the Polyvagal Steering 
 * and Dynamic Healing Group root folders.
 * 
 * Usage:
 *   node tmp/sync-both-roots.js [--dry-run]
 * 
 * Options:
 *   --dry-run   Show what would be synced without making changes
 */

const { execSync } = require('child_process');
const path = require('path');

// Root folder IDs
const POLYVAGAL_FOLDER_ID = '1uCAx4DmubXkzHtYo8d9Aw4MD-NlZ7sGc';
const DYNAMIC_HEALING_FOLDER_ID = '1wriOM2j2IglnMcejplqG_XcCxSIfoRMV';

// Process command-line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const dryRunFlag = isDryRun ? '--dry-run' : '';

console.log('=== Syncing Both Root Folders ===');
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

// Finally, sync the Polyvagal folder
console.log('\n*** Step 3: Syncing Polyvagal Steering folder ***');
try {
  const polyvagalCommand = `ts-node ${path.resolve(__dirname, '../scripts/polyvagal-steering-sync.ts')} ${dryRunFlag}`;
  console.log(`Running: ${polyvagalCommand}`);
  
  const polyvagalOutput = execSync(polyvagalCommand, { encoding: 'utf8' });
  console.log(polyvagalOutput);
} catch (error) {
  console.error('Error syncing Polyvagal folder:', error.message);
  process.exit(1);
}

console.log('\n=== Sync Complete ===');
console.log('Both folders have been synced successfully!');
console.log(`Mode: ${isDryRun ? 'DRY RUN (no changes made)' : 'ACTUAL SYNC (changes applied)'}`);