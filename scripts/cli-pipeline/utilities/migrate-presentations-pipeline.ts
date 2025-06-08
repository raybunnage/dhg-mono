#!/usr/bin/env ts-node

import * as fs from 'fs';
import * as path from 'path';

const presentationFiles = [
  'scripts/cli-pipeline/presentations/commands/generate-summary.ts',
  'scripts/cli-pipeline/presentations/commands/test-process-document.ts',
  'scripts/cli-pipeline/presentations/commands/process-mp4-files.ts',
  'scripts/cli-pipeline/presentations/commands/process-mp4-files-action.ts'
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
    
    // 1. Update import
    if (content.includes("import { PromptQueryService }")) {
      content = content.replace(
        /import { PromptQueryService } from ['"].*packages\/cli\/src\/services\/prompt-query-service['"]/,
        "import { PromptService } from '../../../../packages/shared/services/prompt-service'"
      );
      changesMade = true;
    }
    
    // 2. Update service instantiation
    if (content.includes("PromptQueryService.getInstance()")) {
      content = content.replace(
        /const promptQueryService = PromptQueryService\.getInstance\(\);/g,
        'const promptService = PromptService.getInstance();'
      );
      content = content.replace(
        /PromptQueryService\.getInstance\(\)/g,
        'PromptService.getInstance()'
      );
      changesMade = true;
    }
    
    // 3. Update variable references
    if (content.includes("promptQueryService")) {
      content = content.replace(/promptQueryService/g, 'promptService');
      changesMade = true;
    }
    
    // 4. Update method calls
    if (content.includes("getPromptWithQueryResults")) {
      // First pass: simple replacement
      content = content.replace(/\.getPromptWithQueryResults\(/g, '.loadPrompt(');
      
      // Second pass: fix destructuring patterns
      // Pattern 1: const { prompt: varName } = await ...
      content = content.replace(
        /const\s*{\s*prompt:\s*(\w+)\s*}\s*=\s*await\s*promptService\.loadPrompt\(/g,
        'const result = await promptService.loadPrompt('
      );
      
      // Add extraction line after loadPrompt if we replaced destructuring
      const lines = content.split('\n');
      const newLines: string[] = [];
      
      for (let i = 0; i < lines.length; i++) {
        newLines.push(lines[i]);
        
        // If this line has our result = await pattern, add extraction on next line
        if (lines[i].includes('const result = await promptService.loadPrompt(')) {
          // Extract the variable name from the original destructuring if possible
          const nextLines = lines.slice(i+1, i+5).join('\n');
          const promptVarMatch = nextLines.match(/if\s*\(\s*(\w+)\s*\)/);
          const varName = promptVarMatch ? promptVarMatch[1] : 'summaryPrompt';
          
          // Add proper indentation
          const indent = lines[i].match(/^\s*/)?.[0] || '';
          newLines.push(`${indent}const ${varName} = result.prompt;`);
        }
      }
      
      content = newLines.join('\n');
      changesMade = true;
    }
    
    if (changesMade) {
      // Save updated file
      await fs.promises.writeFile(fullPath, content, 'utf-8');
      console.log(`   ✅ File updated`);
      console.log(`   💡 To restore: cp ${path.basename(backupPath)} ${path.basename(filePath)}`);
    } else {
      console.log(`   ℹ️  No changes needed`);
      // Remove backup if no changes
      await fs.promises.unlink(backupPath);
    }
    
    return true;
  } catch (error) {
    console.error(`   ❌ Error: ${error}`);
    return false;
  }
}

async function testCompilation(filePath: string) {
  console.log(`   🔍 Testing compilation...`);
  const { execSync } = require('child_process');
  
  try {
    execSync(`npx tsc --noEmit ${filePath}`, { 
      cwd: process.cwd(),
      stdio: 'pipe' 
    });
    console.log(`   ✅ Compilation successful`);
    return true;
  } catch (error: any) {
    console.log(`   ❌ Compilation failed:`);
    console.log(error.stdout?.toString() || error.message);
    return false;
  }
}

async function main() {
  console.log('🔄 Migrating Presentations Pipeline Files');
  console.log('========================================');
  
  let successCount = 0;
  
  for (const file of presentationFiles) {
    const success = await migrateFile(file);
    if (success) {
      const compiles = await testCompilation(file);
      if (compiles) {
        successCount++;
      } else {
        console.log(`   ⚠️  File updated but has compilation errors - manual fixes needed`);
      }
    }
  }
  
  console.log(`\n✅ Migration Summary`);
  console.log(`   Successfully migrated: ${successCount}/${presentationFiles.length} files`);
  
  console.log(`\n📋 Next Steps:`);
  console.log(`   1. Review the changes in each file`);
  console.log(`   2. Fix any compilation errors`);
  console.log(`   3. Test the presentation commands`);
  console.log(`   4. Remove backup files once verified`);
}

main().catch(console.error);