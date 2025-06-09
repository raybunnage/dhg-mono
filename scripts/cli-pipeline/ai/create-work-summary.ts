import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
import { formatterService } from '../../../packages/shared/services/formatter-service';
import chalk from 'chalk';

interface WorkSummaryData {
  title: string;
  summary: string;
  files_modified: string[];
  commands_used: string[];
  category: 'feature' | 'bugfix' | 'refactor' | 'docs' | 'chore';
  tags: string[];
  worktree_path?: string;
  git_branch?: string;
  git_commit?: string;
}

export async function createWorkSummary(data: WorkSummaryData) {
  const supabase = SupabaseClientService.getInstance().getClient();
  
  try {
    const { data: result, error } = await supabase
      .from('ai_work_summaries')
      .insert({
        title: data.title,
        summary: data.summary,
        files_modified: data.files_modified,
        commands_used: data.commands_used,
        category: data.category,
        tags: data.tags,
        worktree_path: data.worktree_path,
        git_branch: data.git_branch,
        git_commit: data.git_commit,
        created_at: new Date().toISOString()
      })
      .select()
      .single();
      
    if (error) throw error;
    
    console.log(chalk.green('✓ Work summary created successfully'));
    console.log(chalk.blue(`ID: ${result.id}`));
    
    return result;
  } catch (error) {
    console.error(chalk.red('Error creating work summary:'), error);
    throw error;
  }
}

// Main execution
async function main() {
  const workSummary: WorkSummaryData = {
    title: 'Enhanced database CLI pipeline with comprehensive audit commands',
    summary: `Implemented three major database audit commands to help maintain database consistency and best practices:

1. **table-audit**: Comprehensive table evaluation that checks naming conventions, standard fields, constraints, indexes, RLS policies, triggers, and data types. Provides a health score (0-100) for each table and specific fix recommendations.

2. **function-audit**: Analyzes database functions to identify unused ones, categorizes them by type, shows usage in views/functions/triggers, and can generate SQL to safely remove unused functions.

3. **consistency-check**: Checks cross-table consistency including field naming patterns, data type consistency, foreign key relationships, and can generate SQL fixes for identified issues.

Also created:
- Database audit functions migration with 7 helper functions
- Comprehensive database maintenance documentation
- Fixed import issues with backup commands by creating wrapper commands
- Integrated all new commands into both TypeScript and shell CLI
- Updated command registry (now 44 total database commands)`,
    files_modified: [
      'scripts/cli-pipeline/database/cli.ts',
      'scripts/cli-pipeline/database/database-cli.sh',
      'scripts/cli-pipeline/database/commands/table-audit.ts',
      'scripts/cli-pipeline/database/commands/function-audit.ts',
      'scripts/cli-pipeline/database/commands/consistency-check.ts',
      'scripts/cli-pipeline/database/commands/table-audit-cmd.ts',
      'scripts/cli-pipeline/database/commands/function-audit-cmd.ts',
      'scripts/cli-pipeline/database/commands/consistency-check-cmd.ts',
      'scripts/cli-pipeline/database/commands/backup/create-backup-cmd.ts',
      'scripts/cli-pipeline/database/commands/backup/add-backup-table-cmd.ts',
      'scripts/cli-pipeline/database/commands/backup/list-backup-config-cmd.ts',
      'supabase/migrations/20250608_database_audit_functions.sql',
      'docs/continuously-updated/database-maintenance-guide.md'
    ],
    commands_used: [
      './database-cli.sh table-audit',
      './database-cli.sh function-audit',
      './database-cli.sh consistency-check',
      './database-cli.sh migration validate',
      './database-cli.sh migration dry-run',
      './database-cli.sh migration run-staged',
      './all-pipelines-cli.sh populate-command-registry'
    ],
    category: 'feature',
    tags: ['database', 'cli', 'audit', 'maintenance', 'consistency', 'best-practices'],
    worktree_path: '/Users/raybunnage/Documents/github/dhg-mono-feature/dhg-mono-docs',
    git_branch: 'feature/continuous-documentation-archiving'
  };
  
  await createWorkSummary(workSummary);
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}