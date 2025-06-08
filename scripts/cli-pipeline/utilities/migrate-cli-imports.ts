#!/usr/bin/env ts-node

import * as fs from 'fs';
import * as path from 'path';

interface ImportChange {
  file: string;
  oldImport: string;
  newImport: string;
  notes: string;
}

const changes: ImportChange[] = [
  // PromptQueryService -> Use existing PromptService
  {
    file: 'scripts/cli-pipeline/presentations/commands/generate-summary.ts',
    oldImport: "import { PromptQueryService } from '../../../../packages/cli/src/services/prompt-query-service';",
    newImport: "import { PromptService } from '../../../../packages/shared/services/prompt-service';",
    notes: 'Replace with shared PromptService'
  },
  {
    file: 'scripts/cli-pipeline/presentations/commands/test-process-document.ts',
    oldImport: "import { PromptQueryService } from '../../../../packages/cli/src/services/prompt-query-service';",
    newImport: "import { PromptService } from '../../../../packages/shared/services/prompt-service';",
    notes: 'Replace with shared PromptService'
  },
  {
    file: 'scripts/cli-pipeline/presentations/commands/process-mp4-files.ts',
    oldImport: "import { PromptQueryService } from '../../../../packages/cli/src/services/prompt-query-service';",
    newImport: "import { PromptService } from '../../../../packages/shared/services/prompt-service';",
    notes: 'Replace with shared PromptService'
  },
  {
    file: 'scripts/cli-pipeline/presentations/commands/process-mp4-files-action.ts',
    oldImport: "import { PromptQueryService } from '../../../../packages/cli/src/services/prompt-query-service';",
    newImport: "import { PromptService } from '../../../../packages/shared/services/prompt-service';",
    notes: 'Replace with shared PromptService'
  },
  {
    file: 'scripts/cli-pipeline/presentations/check-prompt.ts',
    oldImport: "import { PromptQueryService } from '../../../../packages/cli/src/services/prompt-query-service';",
    newImport: "import { PromptService } from '../../../../packages/shared/services/prompt-service';",
    notes: 'Replace with shared PromptService'
  },
  {
    file: 'scripts/cli-pipeline/scripts/classify-script-with-prompt.ts',
    oldImport: "import { PromptQueryService } from '../../../../packages/cli/src/services/prompt-query-service';",
    newImport: "import { PromptService } from '../../../../packages/shared/services/prompt-service';",
    notes: 'Replace with shared PromptService'
  },
  // Document pipeline imports
  {
    file: 'scripts/cli-pipeline/document/sync-markdown-files.ts',
    oldImport: "import { SupabaseClient } from '../../packages/cli/src/services/supabase-client';",
    newImport: "// Remove - use SupabaseClientService from shared",
    notes: 'Remove redundant import'
  },
  {
    file: 'scripts/cli-pipeline/document/sync-markdown-files.ts',
    oldImport: "import { SupabaseClientService } from '../../packages/cli/src/services/supabase-client';",
    newImport: "import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';",
    notes: 'Use shared SupabaseClientService'
  },
  {
    file: 'scripts/cli-pipeline/document/sync-markdown-files.ts',
    oldImport: "import { Logger } from '../../packages/cli/src/utils/logger';",
    newImport: "import { Logger } from '../../../packages/shared/utils/logger';",
    notes: 'Use shared Logger'
  },
  {
    file: 'scripts/cli-pipeline/document/sync-markdown-files.ts',
    oldImport: "import { ErrorHandler } from '../../packages/cli/src/utils/error-handler';",
    newImport: "// ErrorHandler removed - use try/catch",
    notes: 'Remove ErrorHandler'
  },
  {
    file: 'scripts/cli-pipeline/document/sync-markdown-files.ts',
    oldImport: "import { FileService } from '../../packages/cli/src/services/file-service';",
    newImport: "import { FileService } from '../../../packages/shared/services/file-service';",
    notes: 'Use shared FileService'
  },
  {
    file: 'scripts/cli-pipeline/document/display-doc-paths-simple.ts',
    oldImport: "import config from '../../packages/cli/src/utils/config';",
    newImport: "// Config removed - use environment variables directly",
    notes: 'Remove config import'
  },
  {
    file: 'scripts/cli-pipeline/document/display-doc-paths-simple.ts',
    oldImport: "import { Logger } from '../../packages/cli/src/utils/logger';",
    newImport: "import { Logger } from '../../../packages/shared/utils/logger';",
    notes: 'Use shared Logger'
  },
  {
    file: 'scripts/cli-pipeline/document/display-doc-paths-enhanced.ts',
    oldImport: "import config from '../../packages/cli/src/utils/config';",
    newImport: "// Config removed - use environment variables directly", 
    notes: 'Remove config import'
  },
  {
    file: 'scripts/cli-pipeline/document/display-doc-paths-enhanced.ts',
    oldImport: "import { Logger, LogLevel } from '../../packages/cli/src/utils/logger';",
    newImport: "import { Logger, LogLevel } from '../../../packages/shared/utils/logger';",
    notes: 'Use shared Logger'
  },
  {
    file: 'scripts/cli-pipeline/document/display-doc-paths-enhanced.ts',
    oldImport: "import { ErrorHandler } from '../../packages/cli/src/utils/error-handler';",
    newImport: "// ErrorHandler removed - use try/catch",
    notes: 'Remove ErrorHandler'
  }
];

// Additional changes for service instantiation
const codeChanges = [
  {
    pattern: /PromptQueryService\.getInstance\(\)/g,
    replacement: 'PromptService.getInstance()',
    files: [
      'scripts/cli-pipeline/presentations/commands/generate-summary.ts',
      'scripts/cli-pipeline/presentations/commands/test-process-document.ts',
      'scripts/cli-pipeline/presentations/commands/process-mp4-files.ts',
      'scripts/cli-pipeline/presentations/commands/process-mp4-files-action.ts',
      'scripts/cli-pipeline/presentations/check-prompt.ts',
      'scripts/cli-pipeline/scripts/classify-script-with-prompt.ts'
    ]
  },
  {
    pattern: /const promptQueryService = PromptQueryService\.getInstance\(\);/g,
    replacement: 'const promptService = PromptService.getInstance();',
    files: [
      'scripts/cli-pipeline/presentations/commands/generate-summary.ts',
      'scripts/cli-pipeline/presentations/commands/test-process-document.ts',
      'scripts/cli-pipeline/presentations/commands/process-mp4-files.ts',
      'scripts/cli-pipeline/presentations/commands/process-mp4-files-action.ts',
      'scripts/cli-pipeline/presentations/check-prompt.ts',
      'scripts/cli-pipeline/scripts/classify-script-with-prompt.ts'
    ]
  },
  {
    pattern: /promptQueryService/g,
    replacement: 'promptService',
    files: [
      'scripts/cli-pipeline/presentations/commands/generate-summary.ts',
      'scripts/cli-pipeline/presentations/commands/test-process-document.ts',
      'scripts/cli-pipeline/presentations/commands/process-mp4-files.ts',
      'scripts/cli-pipeline/presentations/commands/process-mp4-files-action.ts',
      'scripts/cli-pipeline/presentations/check-prompt.ts',
      'scripts/cli-pipeline/scripts/classify-script-with-prompt.ts'
    ]
  }
];

// Changes to handle different method signatures
const methodChanges = [
  {
    // getPromptWithQueryResults returns { prompt, databaseQueryResults, databaseQuery2Results }
    // loadPrompt returns { prompt, databaseQueries: [{queryName, queryText, queryResults}] }
    description: 'Update method calls to use loadPrompt',
    files: [
      'scripts/cli-pipeline/presentations/commands/generate-summary.ts',
      'scripts/cli-pipeline/presentations/commands/test-process-document.ts',
      'scripts/cli-pipeline/presentations/commands/process-mp4-files.ts',
      'scripts/cli-pipeline/presentations/commands/process-mp4-files-action.ts',
      'scripts/cli-pipeline/presentations/check-prompt.ts',
      'scripts/cli-pipeline/scripts/classify-script-with-prompt.ts'
    ],
    transform: (content: string) => {
      // Replace getPromptWithQueryResults with loadPrompt
      content = content.replace(/\.getPromptWithQueryResults\(/g, '.loadPrompt(');
      
      // Update destructuring to match new return format
      content = content.replace(
        /const\s*{\s*prompt:\s*(\w+)\s*}\s*=\s*await\s*promptService\.loadPrompt\(/g,
        'const result = await promptService.loadPrompt('
      );
      
      // Add variable extraction after loadPrompt calls
      content = content.replace(
        /(const result = await promptService\.loadPrompt\([^)]+\);)/g,
        '$1\n      const $1 = result.prompt;'
      );
      
      return content;
    }
  }
];

async function migrateFile(change: ImportChange) {
  const filePath = path.join(process.cwd(), change.file);
  
  try {
    let content = await fs.promises.readFile(filePath, 'utf-8');
    
    if (content.includes(change.oldImport)) {
      content = content.replace(change.oldImport, change.newImport);
      await fs.promises.writeFile(filePath, content, 'utf-8');
      console.log(`✅ Updated ${change.file}`);
      console.log(`   ${change.notes}`);
      return true;
    } else {
      console.log(`⚠️  Import not found in ${change.file}`);
      return false;
    }
  } catch (error) {
    console.error(`❌ Error updating ${change.file}:`, error);
    return false;
  }
}

async function applyCodeChanges() {
  for (const change of codeChanges) {
    for (const file of change.files) {
      const filePath = path.join(process.cwd(), file);
      
      try {
        let content = await fs.promises.readFile(filePath, 'utf-8');
        const originalContent = content;
        
        content = content.replace(change.pattern, change.replacement);
        
        if (content !== originalContent) {
          await fs.promises.writeFile(filePath, content, 'utf-8');
          console.log(`✅ Updated code in ${file}`);
          console.log(`   Replaced ${change.pattern.source} with ${change.replacement}`);
        }
      } catch (error) {
        console.error(`❌ Error updating code in ${file}:`, error);
      }
    }
  }
}

async function applyMethodChanges() {
  for (const change of methodChanges) {
    console.log(`\n📝 ${change.description}`);
    
    for (const file of change.files) {
      const filePath = path.join(process.cwd(), file);
      
      try {
        let content = await fs.promises.readFile(filePath, 'utf-8');
        const originalContent = content;
        
        content = change.transform(content);
        
        if (content !== originalContent) {
          await fs.promises.writeFile(filePath, content, 'utf-8');
          console.log(`✅ Updated method calls in ${file}`);
        }
      } catch (error) {
        console.error(`❌ Error updating methods in ${file}:`, error);
      }
    }
  }
}

async function main() {
  console.log('🔄 Phase 2: Migrating imports from packages/cli to shared services');
  console.log('===========================================================\n');
  
  // Apply import changes
  console.log('📝 Updating imports...');
  let successCount = 0;
  for (const change of changes) {
    if (await migrateFile(change)) {
      successCount++;
    }
  }
  
  console.log(`\n✅ Updated ${successCount}/${changes.length} import statements`);
  
  // Apply code changes
  console.log('\n📝 Updating code references...');
  await applyCodeChanges();
  
  // Apply method signature changes
  await applyMethodChanges();
  
  console.log('\n✅ Migration complete!');
  console.log('\n⚠️  Manual fixes needed:');
  console.log('1. Update { prompt: summaryPrompt } destructuring to handle new loadPrompt return format');
  console.log('2. Remove any ErrorHandler.handle() calls - use try/catch instead');
  console.log('3. Replace config usage with environment variables');
  console.log('4. Test all affected pipelines');
  console.log('\nOnce verified, archive packages/cli');
}

main().catch(console.error);