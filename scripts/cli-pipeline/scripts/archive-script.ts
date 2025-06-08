#!/usr/bin/env ts-node
/**
 * Script: archive-script.ts
 * Purpose: Archive legacy or unused scripts to .archived_scripts folders
 * Pipeline: scripts
 * Tags: archive, legacy, cleanup
 */

import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
import * as fs from 'fs/promises';
import * as path from 'path';
import { format } from 'date-fns';

/**
 * Archive a script file
 */
async function archiveScript(scriptPath?: string) {
  const filePath = scriptPath || process.argv[2];
  
  if (!filePath) {
    console.error('❌ Error: Please provide a script file path');
    console.log('Usage: ./scripts-cli.sh archive <file-path>');
    process.exit(1);
  }
  
  try {
    // Check if file exists
    await fs.access(filePath);
    
    console.log(`📦 Archiving script: ${filePath}`);
    
    // Get file info
    const stats = await fs.stat(filePath);
    const fileDir = path.dirname(filePath);
    const fileName = path.basename(filePath);
    const fileExt = path.extname(filePath);
    const baseName = path.basename(filePath, fileExt);
    
    // Create archive folder if it doesn't exist
    const archiveDir = path.join(fileDir, '.archived_scripts');
    await fs.mkdir(archiveDir, { recursive: true });
    
    // Generate archive filename with date
    const archiveDate = format(new Date(), 'yyyyMMdd');
    const archiveFileName = `${baseName}.${archiveDate}${fileExt}`;
    const archivePath = path.join(archiveDir, archiveFileName);
    
    // Check if archive already exists
    try {
      await fs.access(archivePath);
      console.log(`⚠️  Archive already exists: ${archivePath}`);
      console.log('   Adding timestamp to filename...');
      const timestamp = format(new Date(), 'HHmmss');
      const uniqueArchivePath = path.join(archiveDir, `${baseName}.${archiveDate}.${timestamp}${fileExt}`);
      await fs.rename(filePath, uniqueArchivePath);
      console.log(`✅ Archived to: ${uniqueArchivePath}`);
    } catch {
      // Archive doesn't exist, proceed normally
      await fs.rename(filePath, archivePath);
      console.log(`✅ Archived to: ${archivePath}`);
    }
    
    // Update database if script exists in registry
    const supabase = SupabaseClientService.getInstance().getClient();
    
    // Check if script exists in registry
    const { data: existingScript } = await supabase
      .from('registry_scripts')
      .select('id, file_path, metadata')
      .eq('file_path', filePath)
      .single();
    
    if (existingScript) {
      console.log('💾 Updating script registry...');
      
      // Update the file path and mark as archived
      const newMetadata = {
        ...existingScript.metadata,
        is_archived: true,
        archived_date: new Date().toISOString(),
        original_path: filePath
      };
      
      const { error: updateError } = await supabase
        .from('registry_scripts')
        .update({
          file_path: path.relative(process.cwd(), archivePath),
          metadata: newMetadata,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingScript.id);
      
      if (updateError) {
        console.error('❌ Error updating script registry:', updateError);
      } else {
        console.log('✅ Script registry updated');
      }
    }
    
    // Check for references to this script
    console.log('\n🔍 Checking for references to this script...');
    
    // Search in package.json files
    const packageJsonFiles = await findPackageJsonFiles();
    let foundReferences = false;
    
    for (const pkgFile of packageJsonFiles) {
      const content = await fs.readFile(pkgFile, 'utf-8');
      if (content.includes(fileName) || content.includes(baseName)) {
        console.log(`   ⚠️  Found reference in: ${pkgFile}`);
        foundReferences = true;
      }
    }
    
    // Search in other script files
    const scriptName = baseName.replace(/[-_]/g, '[-_]?');
    try {
      const { exec } = require('child_process');
      const { promisify } = require('util');
      const execAsync = promisify(exec);
      
      const rgPath = '/Users/raybunnage/Documents/github/dhg-mono/node_modules/@anthropic-ai/claude-code/vendor/ripgrep/arm64-darwin/rg';
      const { stdout } = await execAsync(
        `${rgPath} -l "${scriptName}" scripts/ --glob "*.{ts,js,sh}" 2>/dev/null || true`
      );
      
      if (stdout) {
        const files = stdout.split('\n').filter(Boolean);
        for (const file of files) {
          if (file !== filePath) {
            console.log(`   ⚠️  Found reference in: ${file}`);
            foundReferences = true;
          }
        }
      }
    } catch (error) {
      // Ignore ripgrep errors
    }
    
    if (foundReferences) {
      console.log('\n⚠️  Warning: This script is referenced in other files.');
      console.log('   Please update those references to avoid broken dependencies.');
    } else {
      console.log('   ✅ No references found');
    }
    
    console.log('\n✨ Archive complete!');
    console.log(`   Original: ${filePath}`);
    console.log(`   Archived: ${archivePath}`);
    
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      console.error(`❌ Error: File not found: ${filePath}`);
    } else {
      console.error('❌ Error archiving script:', error.message);
    }
    process.exit(1);
  }
}

/**
 * Find all package.json files in the project
 */
async function findPackageJsonFiles(): Promise<string[]> {
  const { glob } = await import('glob');
  return glob('**/package.json', {
    ignore: ['**/node_modules/**', '**/.archived_scripts/**'],
    absolute: true
  });
}

// Run if called directly
if (require.main === module) {
  archiveScript().catch(console.error);
}

export { archiveScript };