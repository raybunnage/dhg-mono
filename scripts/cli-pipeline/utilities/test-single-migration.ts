#!/usr/bin/env ts-node

// Test migration on a single file first
import * as fs from 'fs';
import * as path from 'path';

async function testSingleFileMigration() {
  const testFile = 'scripts/cli-pipeline/presentations/check-prompt.ts';
  const backupFile = testFile + '.backup';
  
  console.log(`🧪 Testing migration on single file: ${testFile}`);
  
  // Create backup
  const filePath = path.join(process.cwd(), testFile);
  const content = await fs.promises.readFile(filePath, 'utf-8');
  await fs.promises.writeFile(path.join(process.cwd(), backupFile), content, 'utf-8');
  console.log(`✅ Backup created: ${backupFile}`);
  
  // Show current imports
  console.log('\n📋 Current imports:');
  const importLines = content.split('\n').filter(line => line.includes('packages/cli'));
  importLines.forEach(line => console.log(`  ${line.trim()}`));
  
  // Apply changes
  let newContent = content;
  
  // Update import
  newContent = newContent.replace(
    "import { PromptQueryService } from '../../../../packages/cli/src/services/prompt-query-service';",
    "import { PromptService } from '../../../../packages/shared/services/prompt-service';"
  );
  
  // Update instantiation
  newContent = newContent.replace(
    'PromptQueryService.getInstance()',
    'PromptService.getInstance()'
  );
  
  // Update variable name
  newContent = newContent.replace(
    /promptQueryService/g,
    'promptService'
  );
  
  // Update method call
  newContent = newContent.replace(
    '.getPromptWithQueryResults(',
    '.loadPrompt('
  );
  
  // Save changes
  await fs.promises.writeFile(filePath, newContent, 'utf-8');
  console.log(`\n✅ File updated: ${testFile}`);
  
  // Show what changed
  console.log('\n📝 Changes made:');
  console.log('  - Import: PromptQueryService → PromptService');
  console.log('  - Variable: promptQueryService → promptService');
  console.log('  - Method: getPromptWithQueryResults → loadPrompt');
  
  console.log('\n⚠️  Manual fixes needed:');
  console.log('  - Update destructuring for loadPrompt return format');
  console.log('  - Test the command to ensure it still works');
  
  console.log(`\n💡 To restore original: cp ${backupFile} ${testFile}`);
}

testSingleFileMigration().catch(console.error);