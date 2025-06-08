#!/usr/bin/env ts-node

import { analyzeGoogleSyncUsage, CommandUsageInfo } from './analyze-command-usage';
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
import * as fs from 'fs';
import * as path from 'path';

interface ArchiveCandidate {
  commandName: string;
  description: string | null;
  filePath: string;
  usageCount: number;
  lastUsed: string | null;
}

async function findCommandFiles(): Promise<Map<string, string>> {
  const googleSyncDir = path.join(__dirname);
  const commandFiles = new Map<string, string>();
  
  // Read all TypeScript files in the google_sync directory
  const files = fs.readdirSync(googleSyncDir)
    .filter(file => file.endsWith('.ts') && file !== 'analyze-command-usage.ts' && file !== 'archive-unused-commands.ts')
    .filter(file => !file.startsWith('.'));
  
  files.forEach(file => {
    // Extract command name from filename (remove .ts extension and convert to command format)
    const commandName = file.replace('.ts', '').replace(/-/g, '-');
    commandFiles.set(commandName, path.join(googleSyncDir, file));
  });
  
  return commandFiles;
}

async function archiveCommand(candidate: ArchiveCandidate): Promise<string> {
  const archiveDir = path.join(__dirname, '.archived_scripts');
  
  // Ensure archive directory exists
  if (!fs.existsSync(archiveDir)) {
    fs.mkdirSync(archiveDir, { recursive: true });
  }
  
  // Create archived filename with date
  const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
  const originalFilename = path.basename(candidate.filePath);
  const nameWithoutExt = originalFilename.replace('.ts', '');
  const archivedFilename = `${nameWithoutExt}.${today}.ts`;
  const archivedPath = path.join(archiveDir, archivedFilename);
  
  // Move file to archive
  fs.renameSync(candidate.filePath, archivedPath);
  
  console.log(`✅ Archived: ${originalFilename} -> .archived_scripts/${archivedFilename}`);
  
  return path.relative(__dirname, archivedPath);
}

async function recordArchival(candidate: ArchiveCandidate, archivedPath: string): Promise<void> {
  const supabase = SupabaseClientService.getInstance().getClient();
  
  const { error } = await supabase
    .from('sys_archived_cli_pipeline_files')
    .insert({
      pipeline_name: 'google_sync',
      command_name: candidate.commandName,
      original_file_path: candidate.filePath,
      archived_file_path: archivedPath,
      last_used_date: candidate.lastUsed,
      usage_count: candidate.usageCount,
      description: candidate.description,
      archived_date: new Date().toISOString()
    });
    
  if (error) {
    console.error(`❌ Failed to record archival for ${candidate.commandName}:`, error);
  } else {
    console.log(`📝 Recorded archival in database for ${candidate.commandName}`);
  }
}

async function archiveUnusedCommands(dryRun: boolean = false): Promise<void> {
  console.log(`🔍 Starting Google Sync command usage analysis ${dryRun ? '(DRY RUN)' : 'and archival'}...\n`);
  
  // Get usage statistics
  const usageInfo = await analyzeGoogleSyncUsage();
  
  // Get available command files
  const commandFiles = await findCommandFiles();
  
  console.log(`\n📁 Found ${commandFiles.size} command files in google_sync directory`);
  
  // Find unused commands that have corresponding files
  const archiveCandidates: ArchiveCandidate[] = [];
  
  usageInfo.forEach(cmd => {
    if (cmd.usage_count === 0) {
      // Try to find the corresponding file
      const possibleFilenames = [
        cmd.command_name + '.ts',
        cmd.command_name.replace(/-/g, '_') + '.ts',
        cmd.command_name.replace(/_/g, '-') + '.ts'
      ];
      
      let foundFile = null;
      for (const filename of possibleFilenames) {
        const fullPath = path.join(__dirname, filename);
        if (fs.existsSync(fullPath)) {
          foundFile = fullPath;
          break;
        }
      }
      
      if (foundFile) {
        archiveCandidates.push({
          commandName: cmd.command_name,
          description: cmd.description,
          filePath: foundFile,
          usageCount: cmd.usage_count,
          lastUsed: cmd.last_used
        });
      }
    }
  });
  
  console.log(`\n🗃️  Found ${archiveCandidates.length} unused commands with files to archive:`);
  
  if (archiveCandidates.length === 0) {
    console.log('✨ No unused commands found - all commands have been used recently!');
    return;
  }
  
  // Show candidates before archiving
  archiveCandidates.forEach(candidate => {
    console.log(`  - ${candidate.commandName}: ${candidate.description || 'No description'}`);
  });
  
  if (dryRun) {
    console.log(`\n📋 DRY RUN: Would archive ${archiveCandidates.length} unused commands.`);
    console.log('No files will be moved or database records created.');
    return;
  }
  
  console.log('\n📦 Starting archival process...\n');
  
  // Archive each unused command
  for (const candidate of archiveCandidates) {
    try {
      const archivedPath = await archiveCommand(candidate);
      await recordArchival(candidate, archivedPath);
    } catch (error) {
      console.error(`❌ Failed to archive ${candidate.commandName}:`, error);
    }
  }
  
  console.log(`\n✅ Archival complete! Processed ${archiveCandidates.length} unused commands.`);
  console.log('📋 Archive records have been saved to sys_archived_cli_pipeline_files table.');
}

// Run if called directly
if (require.main === module) {
  const dryRun = process.argv.includes('--dry-run');
  archiveUnusedCommands(dryRun).catch(console.error);
}

export { archiveUnusedCommands };