#!/usr/bin/env ts-node

/**
 * Migrate Claude Service imports to use consistent paths
 */

import * as fs from 'fs';
import { execSync } from 'child_process';

async function migrateClaudeImports() {
  console.log('Starting Claude Service import migration...\n');
  
  // Find all TypeScript files with claude-service imports
  const findCmd = `find . -name "*.ts" -type f ! -path "*/node_modules/*" ! -path "*/dist/*" ! -path "*/.archived_scripts/*" -exec grep -l "claude-service" {} \\;`;
  const filesOutput = execSync(findCmd, { encoding: 'utf-8' });
  const files = filesOutput.trim().split('\n').filter(f => f.length > 0);
  
  console.log(`Found ${files.length} files with claude-service imports\n`);
  
  let updatedCount = 0;
  const updates: { file: string; oldImport: string; newImport: string }[] = [];
  
  for (const file of files) {
    // Skip the claude-service files themselves
    if (file.includes('packages/shared/services/claude-service/')) continue;
    
    const content = fs.readFileSync(file, 'utf-8');
    let newContent = content;
    let fileUpdated = false;
    
    // Pattern 1: Long relative paths to claude-service/claude-service
    const pattern1 = /from\s+['"](.*)\/claude-service\/claude-service['"]/g;
    if (pattern1.test(content)) {
      newContent = content.replace(pattern1, `from '@shared/services/claude-service'`);
      fileUpdated = true;
      updates.push({
        file,
        oldImport: 'claude-service/claude-service',
        newImport: '@shared/services/claude-service'
      });
    }
    
    // Pattern 2: Paths ending in just /claude-service
    const pattern2 = /from\s+['"](.*)packages\/shared\/services\/claude-service['"]/g;
    if (pattern2.test(newContent)) {
      newContent = newContent.replace(pattern2, `from '@shared/services/claude-service'`);
      fileUpdated = true;
      if (!updates.find(u => u.file === file)) {
        updates.push({
          file,
          oldImport: 'packages/shared/services/claude-service',
          newImport: '@shared/services/claude-service'
        });
      }
    }
    
    // Pattern 3: Old ClaudeService imports from CLI
    const pattern3 = /from\s+['"].*\/cli\/src\/services\/claude-service['"]/g;
    if (pattern3.test(newContent)) {
      newContent = newContent.replace(pattern3, `from '@shared/services/claude-service'`);
      fileUpdated = true;
      updates.push({
        file,
        oldImport: 'cli/src/services/claude-service',
        newImport: '@shared/services/claude-service'
      });
    }
    
    // Pattern 4: Fix import statements for destructured imports
    newContent = newContent.replace(
      /import\s*{\s*ClaudeService\s*}\s*from\s*['"]@shared\/services\/claude-service['"]/g,
      `import { ClaudeService } from '@shared/services/claude-service'`
    );
    
    if (fileUpdated) {
      fs.writeFileSync(file, newContent);
      updatedCount++;
    }
  }
  
  console.log(`\nMigration Summary:`);
  console.log(`- Files checked: ${files.length}`);
  console.log(`- Files updated: ${updatedCount}`);
  console.log(`- Total imports migrated: ${updates.length}\n`);
  
  if (updates.length > 0) {
    console.log('Updated files:');
    updates.forEach(({ file, oldImport, newImport }) => {
      console.log(`  ${file}`);
      console.log(`    From: .../${oldImport}`);
      console.log(`    To:   ${newImport}\n`);
    });
  }
  
  console.log('\nNext steps:');
  console.log('1. Run TypeScript compilation to verify no errors: tsc --noEmit');
  console.log('2. Test a few scripts that use claudeService');
  console.log('3. Commit the import updates');
}

// Run the migration
migrateClaudeImports().catch(console.error);