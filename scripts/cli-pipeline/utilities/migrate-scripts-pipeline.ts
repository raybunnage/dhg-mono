#!/usr/bin/env ts-node

import * as fs from 'fs';
import * as path from 'path';

const scriptsFiles = [
  'scripts/cli-pipeline/scripts/classify-script-with-prompt.ts',
  'scripts/cli-pipeline/scripts/classify-untyped-script.ts'
];

async function migrateFile(filePath: string) {
  // Go up three levels from utilities to reach the project root
  const projectRoot = path.resolve(__dirname, '../../..');
  const fullPath = path.join(projectRoot, filePath);
  const backupPath = fullPath + '.backup';
  
  console.log(`\n📄 Processing: ${path.basename(filePath)}`);
  
  try {
    // Read file
    let content = await fs.promises.readFile(fullPath, 'utf-8');
    
    // Create backup
    await fs.promises.writeFile(backupPath, content, 'utf-8');
    console.log(`   ✅ Backup created`);
    
    // Track if changes were made
    let changesMade = false;
    
    // 1. Update FileService import
    if (content.includes("import { FileService } from '../../packages/cli/src/services/file-service'")) {
      content = content.replace(
        "import { FileService } from '../../packages/cli/src/services/file-service'",
        "import { FileService } from '../../../packages/shared/services/file-service'"
      );
      changesMade = true;
    }
    
    // 2. Update require statements for ScriptManagementService
    if (content.includes("require('../../packages/cli/src/services/script-management-service')")) {
      content = content.replace(
        "const { ScriptManagementService } = require('../../packages/cli/src/services/script-management-service')",
        "const { ScriptManagementService } = require('../../../packages/shared/services/script-management-service')"
      );
      changesMade = true;
    }
    
    // 3. Update Logger require
    if (content.includes("require('../../packages/cli/src/utils/logger')")) {
      content = content.replace(
        "const { Logger } = require('../../packages/cli/src/utils/logger')",
        "const { Logger } = require('../../../packages/shared/utils/logger')"
      );
      changesMade = true;
    }
    
    // 4. Update config require
    if (content.includes("require('../../packages/cli/src/utils/config')")) {
      content = content.replace(
        "const config = require('../../packages/cli/src/utils/config')",
        "// Config is now handled by environment variables directly"
      );
      changesMade = true;
    }
    
    // 5. Replace config.anthropicApiKey with process.env.CLAUDE_API_KEY
    if (content.includes("config.anthropicApiKey")) {
      content = content.replace(
        /config\.anthropicApiKey/g,
        "process.env.CLAUDE_API_KEY"
      );
      changesMade = true;
    }
    
    if (changesMade) {
      await fs.promises.writeFile(fullPath, content, 'utf-8');
      console.log(`   ✅ Migrations applied`);
      
      // Test compilation
      console.log(`   🔍 Testing compilation...`);
      const { execSync } = require('child_process');
      try {
        execSync(`tsc --noEmit ${filePath}`, { 
          cwd: projectRoot,
          stdio: 'pipe' 
        });
        console.log(`   ✅ Compilation successful`);
      } catch (error: any) {
        console.log(`   ❌ Compilation failed:`);
        console.error(error.stdout?.toString() || error.message);
        console.log(`   ⚠️  File updated but has compilation errors - manual fixes needed`);
      }
    } else {
      console.log(`   ℹ️  No changes needed`);
    }
    
    return changesMade;
  } catch (error) {
    console.error(`   ❌ Error: ${error}`);
    return false;
  }
}

async function main() {
  console.log('🔄 Migrating Scripts Pipeline Files');
  console.log('=====================================');
  
  let totalMigrated = 0;
  
  for (const file of scriptsFiles) {
    const migrated = await migrateFile(file);
    if (migrated) totalMigrated++;
  }
  
  console.log('\n✅ Migration Summary');
  console.log(`   Successfully migrated: ${totalMigrated}/${scriptsFiles.length} files`);
  
  console.log('\n📋 Next Steps:');
  console.log('   1. Review the changes in each file');
  console.log('   2. Fix any compilation errors');
  console.log('   3. Test the scripts commands');
  console.log('   4. Remove backup files once verified');
}

main().catch(console.error);