#!/usr/bin/env ts-node

/**
 * Migrate LoggerService imports from CLI pipeline to shared services
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

async function migrateLoggerImports() {
  console.log('Starting LoggerService import migration...\n');
  
  // Use find command to get TypeScript files
  const findCmd = `find . -name "*.ts" -type f ! -path "*/node_modules/*" ! -path "*/dist/*" ! -path "*/.archived_scripts/*" ! -path "*/build/*" ! -path "./packages/shared/services/logger/*"`;
  const filesOutput = execSync(findCmd, { encoding: 'utf-8' });
  const files = filesOutput.trim().split('\n').filter(f => f.length > 0);
  
  console.log(`Found ${files.length} TypeScript files to check\n`);
  
  let updatedCount = 0;
  const updates: { file: string; oldImport: string; newImport: string }[] = [];
  
  for (const file of files) {
    const content = fs.readFileSync(file, 'utf-8');
    
    // Pattern to match old imports - look for any path ending in logger-service
    const oldImportPattern = /from\s+['"](.*\/)?logger-service['"]/g;
    
    // Also check for the exact imports we found
    const specificPatterns = [
      /from\s+['"]\.\/logger-service['"]/g,
      /from\s+['"]\.\.\/logger-service['"]/g,
      /from\s+['"]\.\.\/\.\.\/shared\/services\/logger-service['"]/g,
      /from\s+['"]\.\.\/shared\/services\/logger-service['"]/g
    ];
    
    let newContent = content;
    let fileUpdated = false;
    
    // Check if file imports logger-service
    if (oldImportPattern.test(content) || specificPatterns.some(p => p.test(content))) {
      // Determine if this is a Node.js file (CLI script)
      const isNodeFile = file.includes('scripts/') || 
                        file.includes('server') ||
                        file.includes('cli-') ||
                        file.includes('.test.ts') ||
                        content.includes('#!/usr/bin/env');
      
      const newImportPath = isNodeFile 
        ? '@shared/services/logger/logger-node'
        : '@shared/services/logger';
      
      // Replace all variations of logger-service imports
      newContent = newContent.replace(oldImportPattern, `from '${newImportPath}'`);
      
      // Replace specific patterns
      for (const pattern of specificPatterns) {
        newContent = newContent.replace(pattern, `from '${newImportPath}'`);
      }
      
      // Also update the imported items if needed for Node files
      if (isNodeFile) {
        // Handle different import styles
        newContent = newContent.replace(
          /import\s*{\s*logger\s*}\s*from\s*['"]@shared\/services\/logger\/logger-node['"]/g,
          "import { nodeLogger as logger } from '@shared/services/logger/logger-node'"
        );
        newContent = newContent.replace(
          /import\s*{\s*LoggerService\s*}\s*from\s*['"]@shared\/services\/logger\/logger-node['"]/g,
          "import { NodeLoggerService as LoggerService } from '@shared/services/logger/logger-node'"
        );
      }
      
      fileUpdated = true;
      updates.push({
        file,
        oldImport: 'logger-service',
        newImport: newImportPath
      });
    }
    
    // Also check for LogLevel imports from the old types file
    const typesPattern = /from ['"].*\/cli-pipeline\/shared\/interfaces\/types['"]/g;
    if (typesPattern.test(newContent) && newContent.includes('LogLevel')) {
      // Extract the import statement
      const importMatch = newContent.match(/import\s*{([^}]+)}\s*from\s*['"].*\/cli-pipeline\/shared\/interfaces\/types['"]/);
      if (importMatch) {
        const imports = importMatch[1].split(',').map(i => i.trim());
        const loggerImports = imports.filter(i => ['LogLevel', 'LoggerConfig'].includes(i));
        const otherImports = imports.filter(i => !['LogLevel', 'LoggerConfig'].includes(i));
        
        if (loggerImports.length > 0) {
          // Add new import for logger types
          const loggerTypeImport = `import { ${loggerImports.join(', ')} } from '@shared/services/logger';`;
          
          if (otherImports.length > 0) {
            // Keep the old import with remaining types
            newContent = newContent.replace(
              /import\s*{[^}]+}\s*from\s*['"].*\/cli-pipeline\/shared\/interfaces\/types['"]/,
              `import { ${otherImports.join(', ')} } from '../shared/interfaces/types';\n${loggerTypeImport}`
            );
          } else {
            // Replace entirely
            newContent = newContent.replace(
              /import\s*{[^}]+}\s*from\s*['"].*\/cli-pipeline\/shared\/interfaces\/types['"]/,
              loggerTypeImport
            );
          }
          
          fileUpdated = true;
        }
      }
    }
    
    if (fileUpdated) {
      fs.writeFileSync(file, newContent);
      updatedCount++;
    }
  }
  
  console.log(`\nMigration Summary:`);
  console.log(`- Files updated: ${updatedCount}`);
  console.log(`- Total imports migrated: ${updates.length}\n`);
  
  if (updates.length > 0) {
    console.log('Updated files:');
    updates.forEach(({ file, oldImport, newImport }) => {
      console.log(`  ${file}`);
      console.log(`    From: ${oldImport}`);
      console.log(`    To:   ${newImport}\n`);
    });
  }
  
  console.log('\nNext steps:');
  console.log('1. Run TypeScript compilation to verify no errors: tsc --noEmit');
  console.log('2. Test a few CLI scripts to ensure logging still works');
  console.log('3. Archive the old logger service file');
  console.log('4. Update sys_shared_services with LoggerService metadata');
}

// Run the migration
migrateLoggerImports().catch(console.error);