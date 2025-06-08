#!/usr/bin/env ts-node

import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
import * as fs from 'fs';
import * as path from 'path';

interface FileUsageInfo {
  fileName: string;
  filePath: string;
  usageCount: number;
  lastUsed: string | null;
  commandNames: string[];
}

async function findUnusedGoogleSyncFiles(): Promise<void> {
  const supabase = SupabaseClientService.getInstance().getClient();
  
  // Get all TypeScript files in the google_sync directory
  const googleSyncDir = path.join(__dirname);
  const allFiles = fs.readdirSync(googleSyncDir)
    .filter(file => file.endsWith('.ts'))
    .filter(file => !file.startsWith('.'))
    .filter(file => file !== 'analyze-command-usage.ts' && file !== 'archive-unused-commands.ts' && file !== 'archive-unused-files.ts');
  
  console.log(`📁 Found ${allFiles.length} TypeScript files in google_sync directory`);
  
  // Get usage data from command_tracking for last 6 months
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  
  const { data: usageData, error: usageError } = await supabase
    .from('command_tracking')
    .select('command_name, execution_time')
    .eq('pipeline_name', 'google_sync')
    .gte('execution_time', sixMonthsAgo.toISOString());
    
  if (usageError) {
    console.error('Error fetching usage data:', usageError);
    return;
  }
  
  console.log(`📊 Found ${usageData?.length || 0} command executions in last 6 months`);
  
  // Process usage stats by command name
  const usageStats: Record<string, number> = {};
  const lastUsed: Record<string, string> = {};
  
  usageData?.forEach(record => {
    usageStats[record.command_name] = (usageStats[record.command_name] || 0) + 1;
    if (!lastUsed[record.command_name] || record.execution_time > lastUsed[record.command_name]) {
      lastUsed[record.command_name] = record.execution_time;
    }
  });
  
  // Analyze each file
  const fileAnalysis: FileUsageInfo[] = [];
  
  for (const fileName of allFiles) {
    const filePath = path.join(googleSyncDir, fileName);
    const commandName = fileName.replace('.ts', '').replace(/_/g, '-');
    
    // Look for command names that might match this file
    const possibleCommandNames = [
      commandName,
      fileName.replace('.ts', ''),
      commandName.replace(/-/g, '_'),
      // Also check if the filename appears in any command names
    ];
    
    // Find any usage for this file's potential command names
    let totalUsage = 0;
    let latestUse: string | null = null;
    const matchingCommandNames: string[] = [];
    
    for (const possibleName of possibleCommandNames) {
      if (usageStats[possibleName]) {
        totalUsage += usageStats[possibleName];
        matchingCommandNames.push(possibleName);
        if (!latestUse || (lastUsed[possibleName] && lastUsed[possibleName] > latestUse)) {
          latestUse = lastUsed[possibleName];
        }
      }
    }
    
    // Also check if the filename (without .ts) appears in any tracked command
    Object.keys(usageStats).forEach(cmdName => {
      if (cmdName.includes(commandName) || commandName.includes(cmdName)) {
        totalUsage += usageStats[cmdName];
        matchingCommandNames.push(cmdName);
        if (!latestUse || (lastUsed[cmdName] && lastUsed[cmdName] > latestUse)) {
          latestUse = lastUsed[cmdName];
        }
      }
    });
    
    fileAnalysis.push({
      fileName,
      filePath,
      usageCount: totalUsage,
      lastUsed: latestUse,
      commandNames: [...new Set(matchingCommandNames)]
    });
  }
  
  // Sort by usage count (unused files first)
  fileAnalysis.sort((a, b) => a.usageCount - b.usageCount);
  
  console.log('\n=== Google Sync File Usage Analysis (Last 6 Months) ===\n');
  console.log('File Name                                 | Uses | Last Used           | Command Names');
  console.log('------------------------------------------|------|---------------------|---------------');
  
  const unusedFiles: FileUsageInfo[] = [];
  
  fileAnalysis.forEach(file => {
    const lastUseStr = file.lastUsed ? new Date(file.lastUsed).toLocaleDateString() : 'Never';
    const commandNamesStr = file.commandNames.length > 0 ? file.commandNames.join(', ') : 'No matches';
    
    console.log(`${file.fileName.padEnd(42)}| ${file.usageCount.toString().padStart(4)} | ${lastUseStr.padEnd(19)} | ${commandNamesStr}`);
    
    if (file.usageCount === 0) {
      unusedFiles.push(file);
    }
  });
  
  console.log(`\n🗃️  Summary:`);
  console.log(`   📁 Total files analyzed: ${fileAnalysis.length}`);
  console.log(`   ✅ Files with usage: ${fileAnalysis.length - unusedFiles.length}`);
  console.log(`   🚫 Files with no usage: ${unusedFiles.length}`);
  
  if (unusedFiles.length > 0) {
    console.log(`\n📋 Unused files (candidates for archiving):`);
    unusedFiles.forEach(file => {
      const stats = fs.statSync(file.filePath);
      const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
      console.log(`   - ${file.fileName} (${sizeMB} MB)`);
    });
    
    console.log(`\n💡 To archive these files, run:`);
    console.log(`   ts-node archive-unused-files.ts --archive`);
  } else {
    console.log(`\n✨ All files appear to be in use!`);
  }
}

async function archiveFiles(files: FileUsageInfo[]): Promise<void> {
  const archiveDir = path.join(__dirname, '.archived_scripts');
  
  // Ensure archive directory exists
  if (!fs.existsSync(archiveDir)) {
    fs.mkdirSync(archiveDir, { recursive: true });
  }
  
  const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
  const supabase = SupabaseClientService.getInstance().getClient();
  
  for (const file of files) {
    try {
      // Create archived filename with date
      const nameWithoutExt = file.fileName.replace('.ts', '');
      const archivedFilename = `${nameWithoutExt}.${today}.ts`;
      const archivedPath = path.join(archiveDir, archivedFilename);
      
      // Move file to archive
      fs.renameSync(file.filePath, archivedPath);
      console.log(`✅ Archived: ${file.fileName} -> .archived_scripts/${archivedFilename}`);
      
      // Record in database
      const { error } = await supabase
        .from('sys_archived_cli_pipeline_files')
        .insert({
          pipeline_name: 'google_sync',
          command_name: file.fileName.replace('.ts', ''),
          original_file_path: file.filePath,
          archived_file_path: path.relative(__dirname, archivedPath),
          last_used_date: file.lastUsed,
          usage_count: file.usageCount,
          description: `Archived due to no usage in last 6 months`,
          archived_date: new Date().toISOString()
        });
        
      if (error) {
        console.error(`❌ Failed to record archival for ${file.fileName}:`, error);
      } else {
        console.log(`📝 Recorded archival in database for ${file.fileName}`);
      }
    } catch (error) {
      console.error(`❌ Failed to archive ${file.fileName}:`, error);
    }
  }
}

async function main() {
  const shouldArchive = process.argv.includes('--archive');
  const testMode = process.argv.includes('--test');
  
  if (shouldArchive) {
    console.log('🗃️ Starting archival process...\n');
    
    // First run analysis to get unused files
    const supabase = SupabaseClientService.getInstance().getClient();
    
    // Get all TypeScript files in the google_sync directory
    const googleSyncDir = path.join(__dirname);
    const allFiles = fs.readdirSync(googleSyncDir)
      .filter(file => file.endsWith('.ts'))
      .filter(file => !file.startsWith('.'))
      .filter(file => file !== 'analyze-command-usage.ts' && file !== 'archive-unused-commands.ts' && file !== 'archive-unused-files.ts');
    
    // Get usage data from command_tracking for last 6 months
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    
    const { data: usageData, error: usageError } = await supabase
      .from('command_tracking')
      .select('command_name, execution_time')
      .eq('pipeline_name', 'google_sync')
      .gte('execution_time', sixMonthsAgo.toISOString());
      
    if (usageError) {
      console.error('Error fetching usage data:', usageError);
      return;
    }
    
    // Process usage stats
    const usageStats: Record<string, number> = {};
    const lastUsed: Record<string, string> = {};
    
    usageData?.forEach(record => {
      usageStats[record.command_name] = (usageStats[record.command_name] || 0) + 1;
      if (!lastUsed[record.command_name] || record.execution_time > lastUsed[record.command_name]) {
        lastUsed[record.command_name] = record.execution_time;
      }
    });
    
    // Find unused files
    const unusedFiles: FileUsageInfo[] = [];
    
    for (const fileName of allFiles) {
      const filePath = path.join(googleSyncDir, fileName);
      const commandName = fileName.replace('.ts', '').replace(/_/g, '-');
      
      // Check for any usage
      let totalUsage = 0;
      const possibleCommandNames = [
        commandName,
        fileName.replace('.ts', ''),
        commandName.replace(/-/g, '_'),
      ];
      
      for (const possibleName of possibleCommandNames) {
        if (usageStats[possibleName]) {
          totalUsage += usageStats[possibleName];
        }
      }
      
      // Also check if the filename appears in any tracked command
      Object.keys(usageStats).forEach(cmdName => {
        if (cmdName.includes(commandName) || commandName.includes(cmdName)) {
          totalUsage += usageStats[cmdName];
        }
      });
      
      if (totalUsage === 0) {
        unusedFiles.push({
          fileName,
          filePath,
          usageCount: 0,
          lastUsed: null,
          commandNames: []
        });
      }
    }
    
    if (testMode) {
      // Archive only the first 5 files for testing
      const testFiles = unusedFiles.slice(0, 5);
      console.log(`🧪 TEST MODE: Archiving first ${testFiles.length} unused files...\n`);
      await archiveFiles(testFiles);
    } else {
      console.log(`📦 Archiving ${unusedFiles.length} unused files...\n`);
      await archiveFiles(unusedFiles);
    }
  } else {
    await findUnusedGoogleSyncFiles();
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

export { findUnusedGoogleSyncFiles };