#!/usr/bin/env ts-node
/**
 * Cleanup script to move stray files from root directory to proper locations
 * or archive them if they're no longer needed
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

const PROJECT_ROOT = path.resolve(__dirname, '../../..');
const TODAY = new Date().toISOString().split('T')[0].replace(/-/g, '');

interface FileMove {
  source: string;
  destination: string;
  type: 'move' | 'archive';
  reason: string;
}

const moves: FileMove[] = [
  // Testing scripts - move to appropriate location
  {
    source: 'check-all-refactored-tests.ts',
    destination: 'scripts/cli-pipeline/refactoring/check-all-refactored-tests.ts',
    type: 'move',
    reason: 'Active refactoring test checker'
  },
  {
    source: 'check-refactored-services.ts',
    destination: 'scripts/cli-pipeline/refactoring/check-refactored-services.ts',
    type: 'move',
    reason: 'Active service checker'
  },
  {
    source: 'test-all-refactored.sh',
    destination: 'scripts/cli-pipeline/refactoring/test-all-refactored.sh',
    type: 'move',
    reason: 'Active test runner'
  },
  {
    source: 'test-all-services.sh',
    destination: 'scripts/cli-pipeline/refactoring/test-all-services.sh',
    type: 'move',
    reason: 'Active service test runner'
  },
  {
    source: 'test-proxy-servers.ts',
    destination: 'scripts/cli-pipeline/proxy/test-proxy-servers.ts',
    type: 'move',
    reason: 'Proxy server testing utility'
  },
  
  // Worktree setup scripts - archive (temporary scripts)
  {
    source: 'setup-alpha-worktree.sh',
    destination: `scripts/cli-pipeline/refactoring/.archived_scripts/setup-alpha-worktree.${TODAY}.sh`,
    type: 'archive',
    reason: 'Temporary worktree setup - alpha phase complete'
  },
  {
    source: 'setup-group-a-worktree.sh',
    destination: `scripts/cli-pipeline/refactoring/.archived_scripts/setup-group-a-worktree.${TODAY}.sh`,
    type: 'archive',
    reason: 'Temporary worktree setup - group A complete'
  },
  {
    source: 'init-alpha-simple.sh',
    destination: `scripts/cli-pipeline/refactoring/.archived_scripts/init-alpha-simple.${TODAY}.sh`,
    type: 'archive',
    reason: 'Temporary init script - alpha phase complete'
  },
  {
    source: 'init-beta-simple.sh',
    destination: `scripts/cli-pipeline/refactoring/.archived_scripts/init-beta-simple.${TODAY}.sh`,
    type: 'archive',
    reason: 'Temporary init script - beta phase complete'
  },
  {
    source: 'init-gamma-simple.sh',
    destination: `scripts/cli-pipeline/refactoring/.archived_scripts/init-gamma-simple.${TODAY}.sh`,
    type: 'archive',
    reason: 'Temporary init script - gamma phase complete'
  },
  
  // Merge scripts - archive (temporary)
  {
    source: 'merge-group-b-services.sh',
    destination: `scripts/cli-pipeline/refactoring/.archived_scripts/merge-group-b-services.${TODAY}.sh`,
    type: 'archive',
    reason: 'Temporary merge script - group B complete'
  },
  {
    source: 'merge-group-c-to-integration.sh',
    destination: `scripts/cli-pipeline/refactoring/.archived_scripts/merge-group-c-to-integration.${TODAY}.sh`,
    type: 'archive',
    reason: 'Temporary merge script - group C complete'
  },
  {
    source: 'merge-group-c-worktree.sh',
    destination: `scripts/cli-pipeline/refactoring/.archived_scripts/merge-group-c-worktree.${TODAY}.sh`,
    type: 'archive',
    reason: 'Temporary merge script - group C complete'
  },
  {
    source: 'continue-cherry-pick.sh',
    destination: `scripts/cli-pipeline/git/.archived_scripts/continue-cherry-pick.${TODAY}.sh`,
    type: 'archive',
    reason: 'Temporary git helper - cherry-pick complete'
  },
  
  // Fix scripts - archive (one-time fixes)
  {
    source: 'fix-all-tests.sh',
    destination: `scripts/cli-pipeline/refactoring/.archived_scripts/fix-all-tests.${TODAY}.sh`,
    type: 'archive',
    reason: 'One-time fix script - tests fixed'
  },
  {
    source: 'fix-database-service-tests.sh',
    destination: `scripts/cli-pipeline/refactoring/.archived_scripts/fix-database-service-tests.${TODAY}.sh`,
    type: 'archive',
    reason: 'One-time fix script - database tests fixed'
  },
  {
    source: 'fix-env-now.sh',
    destination: `scripts/cli-pipeline/utilities/.archived_scripts/fix-env-now.${TODAY}.sh`,
    type: 'archive',
    reason: 'One-time env fix - completed'
  },
  {
    source: 'fix-media-tracking-async.sh',
    destination: `scripts/cli-pipeline/media-processing/.archived_scripts/fix-media-tracking-async.${TODAY}.sh`,
    type: 'archive',
    reason: 'One-time media fix - completed'
  },
  {
    source: 'fix-remaining-tests.sh',
    destination: `scripts/cli-pipeline/refactoring/.archived_scripts/fix-remaining-tests.${TODAY}.sh`,
    type: 'archive',
    reason: 'One-time test fix - completed'
  },
  {
    source: 'fix-validate-dependencies.ts',
    destination: `scripts/cli-pipeline/refactoring/.archived_scripts/fix-validate-dependencies.${TODAY}.ts`,
    type: 'archive',
    reason: 'One-time dependency fix - completed'
  },
  {
    source: 'final-comprehensive-test.sh',
    destination: `scripts/cli-pipeline/refactoring/.archived_scripts/final-comprehensive-test.${TODAY}.sh`,
    type: 'archive',
    reason: 'One-time final test - completed'
  },
  
  // Utility scripts
  {
    source: 'ports.sh',
    destination: 'scripts/cli-pipeline/utilities/show-ports.sh',
    type: 'move',
    reason: 'Active port listing utility'
  },
  {
    source: 'apply-refactoring-migration.ts',
    destination: 'scripts/cli-pipeline/refactoring/apply-refactoring-migration.ts',
    type: 'move',
    reason: 'Active migration tool'
  },
  {
    source: 'start-vite-fix-proxy.sh',
    destination: 'scripts/cli-pipeline/proxy/start-vite-fix-proxy.sh',
    type: 'move',
    reason: 'Active proxy starter'
  },
  
  // Documentation - move to proper location
  {
    source: 'SERVICE_REFACTORING_COMPLETE_GUIDE.md',
    destination: 'docs/refactoring/SERVICE_REFACTORING_COMPLETE_GUIDE.md',
    type: 'move',
    reason: 'Important refactoring guide'
  },
  {
    source: 'SERVICE_REFACTORING_WORKTREE_ASSIGNMENTS.md',
    destination: 'docs/refactoring/SERVICE_REFACTORING_WORKTREE_ASSIGNMENTS.md',
    type: 'move',
    reason: 'Worktree assignment documentation'
  },
  {
    source: 'VITE_ENV_SOLUTION.md',
    destination: 'docs/solution-guides/VITE_ENV_SOLUTION.md',
    type: 'move',
    reason: 'Vite environment solution guide'
  },
  {
    source: 'VITE_FIX_PROXY_SERVER.md',
    destination: 'docs/solution-guides/VITE_FIX_PROXY_SERVER.md',
    type: 'move',
    reason: 'Proxy server documentation'
  },
  {
    source: 'comprehensive-test-status.md',
    destination: 'docs/refactoring/comprehensive-test-status.md',
    type: 'move',
    reason: 'Test status documentation'
  },
  {
    source: 'dev-task-completion-workflow.md',
    destination: 'docs/deployment-environment/dev-task-completion-workflow.md',
    type: 'move',
    reason: 'Dev task workflow guide'
  },
  {
    source: 'final-test-coverage-report.md',
    destination: 'docs/refactoring/final-test-coverage-report.md',
    type: 'move',
    reason: 'Test coverage report'
  },
  {
    source: 'service-categorization.md',
    destination: 'docs/refactoring/service-categorization.md',
    type: 'move',
    reason: 'Service categorization guide'
  },
  {
    source: 'test-coverage-summary.md',
    destination: 'docs/refactoring/test-coverage-summary.md',
    type: 'move',
    reason: 'Test coverage summary'
  },
  
  // Archive old docs
  {
    source: 'MANUAL_MIGRATION_STEPS.md',
    destination: `docs/refactoring/.archive_docs/MANUAL_MIGRATION_STEPS.${TODAY}.md`,
    type: 'archive',
    reason: 'Outdated migration steps'
  },
  {
    source: 'SYS_CLI_PIPELINES_MIGRATION_READY.md',
    destination: `docs/database/.archive_docs/SYS_CLI_PIPELINES_MIGRATION_READY.${TODAY}.md`,
    type: 'archive',
    reason: 'Migration already completed'
  },
  
  // SQL files
  {
    source: 'check_definitions.sql',
    destination: 'supabase/migrations/archive/check_definitions.sql',
    type: 'move',
    reason: 'SQL query file'
  },
  {
    source: 'update-service-test-status.sql',
    destination: 'supabase/migrations/archive/update-service-test-status.sql',
    type: 'move',
    reason: 'SQL update script'
  },
  
  // Other files
  {
    source: 'clipboard-dev-task-completion.txt',
    destination: `docs/deployment-environment/.archive_docs/clipboard-dev-task-completion.${TODAY}.txt`,
    type: 'archive',
    reason: 'Temporary clipboard content'
  },
  {
    source: 'service-deprecation-report-2025-06-08.json',
    destination: 'docs/script-reports/service-deprecation-report-2025-06-08.json',
    type: 'move',
    reason: 'Service deprecation report'
  },
  {
    source: 'service-deprecation-report-2025-06-14.json',
    destination: 'docs/script-reports/service-deprecation-report-2025-06-14.json',
    type: 'move',
    reason: 'Service deprecation report'
  },
  {
    source: 'pnpm-lock.yaml.backup',
    destination: '.archived_scripts/pnpm-lock.yaml.backup',
    type: 'archive',
    reason: 'Old backup file'
  }
];

async function cleanupRootFiles() {
  console.log('🧹 Starting root directory cleanup...\n');
  
  const report = {
    moved: [] as string[],
    archived: [] as string[],
    errors: [] as string[],
    notFound: [] as string[]
  };
  
  // Create necessary directories
  const directories = new Set(moves.map(m => path.dirname(m.destination)));
  for (const dir of directories) {
    const fullPath = path.join(PROJECT_ROOT, dir);
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
      console.log(`📁 Created directory: ${dir}`);
    }
  }
  
  // Process each file
  for (const move of moves) {
    const sourcePath = path.join(PROJECT_ROOT, move.source);
    const destPath = path.join(PROJECT_ROOT, move.destination);
    
    if (!fs.existsSync(sourcePath)) {
      console.log(`❌ Not found: ${move.source}`);
      report.notFound.push(move.source);
      continue;
    }
    
    try {
      // Use git mv for tracked files, fs.rename for untracked
      try {
        execSync(`git ls-files --error-unmatch "${move.source}"`, { 
          cwd: PROJECT_ROOT,
          stdio: 'ignore' 
        });
        // File is tracked, use git mv
        execSync(`git mv "${move.source}" "${move.destination}"`, { cwd: PROJECT_ROOT });
      } catch {
        // File is not tracked, use regular move
        fs.renameSync(sourcePath, destPath);
      }
      
      if (move.type === 'move') {
        console.log(`✅ Moved: ${move.source} → ${move.destination}`);
        report.moved.push(`${move.source} → ${move.destination} (${move.reason})`);
      } else {
        console.log(`📦 Archived: ${move.source} → ${move.destination}`);
        report.archived.push(`${move.source} → ${move.destination} (${move.reason})`);
      }
    } catch (error) {
      console.error(`❌ Error processing ${move.source}:`, error);
      report.errors.push(`${move.source}: ${error}`);
    }
  }
  
  // Generate report
  console.log('\n📊 Cleanup Summary:');
  console.log(`  Moved to proper location: ${report.moved.length} files`);
  console.log(`  Archived: ${report.archived.length} files`);
  console.log(`  Not found: ${report.notFound.length} files`);
  console.log(`  Errors: ${report.errors.length} files`);
  
  // Write detailed report
  const reportContent = `# Root Directory Cleanup Report
Date: ${new Date().toISOString()}

## Summary
- Files moved to proper location: ${report.moved.length}
- Files archived: ${report.archived.length}
- Files not found: ${report.notFound.length}
- Errors encountered: ${report.errors.length}

## Files Moved to Proper Location
${report.moved.map(m => `- ${m}`).join('\n') || 'None'}

## Files Archived
${report.archived.map(a => `- ${a}`).join('\n') || 'None'}

## Files Not Found
${report.notFound.map(f => `- ${f}`).join('\n') || 'None'}

## Errors
${report.errors.map(e => `- ${e}`).join('\n') || 'None'}

## Cleanup Guidelines Applied
1. Scripts moved to scripts/cli-pipeline/{domain}/
2. Documentation moved to docs/{category}/
3. SQL files moved to supabase/migrations/
4. Temporary/one-time scripts archived with date
5. No files left in root directory except necessary config files
`;
  
  const reportPath = path.join(PROJECT_ROOT, 'docs/script-reports', `root-cleanup-report-${TODAY}.md`);
  fs.writeFileSync(reportPath, reportContent);
  console.log(`\n📄 Detailed report saved to: ${reportPath}`);
  
  // Update any references if needed
  console.log('\n🔍 Checking for file references to update...');
  await updateFileReferences();
}

async function updateFileReferences() {
  // Check common files that might reference moved scripts
  const filesToCheck = [
    'package.json',
    'README.md',
    '.github/workflows/*.yml'
  ];
  
  // This would need to be expanded based on actual usage
  console.log('  (Manual review may be needed for updated file paths)');
}

// Run the cleanup
if (require.main === module) {
  cleanupRootFiles().catch(console.error);
}