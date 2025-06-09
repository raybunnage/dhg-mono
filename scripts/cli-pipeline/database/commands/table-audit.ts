import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';
import { formatterService } from '../../../../packages/shared/services/formatter-service';
import chalk from 'chalk';

interface TableAuditResult {
  table_name: string;
  issues: AuditIssue[];
  score: number;
  recommendations: string[];
}

interface AuditIssue {
  severity: 'critical' | 'warning' | 'info';
  category: string;
  message: string;
  fix?: string;
}

interface TableInfo {
  table_name: string;
  columns: any[];
  constraints: any[];
  indexes: any[];
  policies: any[];
  triggers: any[];
  foreign_keys: any[];
}

export async function tableAudit(tableName?: string) {
  const supabase = SupabaseClientService.getInstance().getClient();
  
  try {
    // Get list of tables to audit
    const tablesToAudit = await getTablesToAudit(supabase, tableName);
    
    if (tablesToAudit.length === 0) {
      console.log(chalk.yellow('No tables found to audit'));
      return;
    }
    
    console.log(chalk.blue(`\nAuditing ${tablesToAudit.length} table(s)...\n`));
    
    const results: TableAuditResult[] = [];
    
    for (const table of tablesToAudit) {
      const result = await auditSingleTable(supabase, table.table_name);
      results.push(result);
      displayTableAuditResult(result);
    }
    
    // Display summary
    displayAuditSummary(results);
    
  } catch (error) {
    console.error(chalk.red('Error during table audit:'), error);
    throw error;
  }
}

async function getTablesToAudit(supabase: any, tableName?: string): Promise<any[]> {
  if (tableName) {
    // Check if specific table exists
    const { data, error } = await supabase.rpc('get_table_info', {
      schema_name: 'public',
      table_name: tableName
    });
    
    if (error || !data || data.length === 0) {
      throw new Error(`Table '${tableName}' not found`);
    }
    
    return [{ table_name: tableName }];
  }
  
  // Get all tables except system tables
  const { data, error } = await supabase
    .from('sys_table_definitions')
    .select('table_name')
    .eq('table_schema', 'public')
    .not('table_name', 'like', 'pg_%')
    .not('table_name', 'like', '__%')
    .order('table_name');
    
  if (error) throw error;
  return data || [];
}

async function auditSingleTable(supabase: any, tableName: string): Promise<TableAuditResult> {
  const issues: AuditIssue[] = [];
  const recommendations: string[] = [];
  
  // Get comprehensive table information
  const tableInfo = await getTableInfo(supabase, tableName);
  
  // Run all audit checks
  checkNamingConventions(tableInfo, issues);
  checkStandardFields(tableInfo, issues);
  checkPrimaryKey(tableInfo, issues);
  checkForeignKeys(tableInfo, issues);
  checkIndexes(tableInfo, issues);
  checkConstraints(tableInfo, issues);
  checkRLSPolicies(tableInfo, issues);
  checkTriggers(tableInfo, issues);
  checkDataTypes(tableInfo, issues);
  
  // Generate recommendations based on issues
  generateRecommendations(issues, recommendations);
  
  // Calculate health score (100 = perfect)
  const score = calculateHealthScore(issues);
  
  return {
    table_name: tableName,
    issues,
    score,
    recommendations
  };
}

async function getTableInfo(supabase: any, tableName: string): Promise<TableInfo> {
  // Get columns
  const { data: columns } = await supabase.rpc('get_table_columns', {
    schema_name: 'public',
    table_name: tableName
  });
  
  // Get constraints
  const { data: constraints } = await supabase.rpc('get_table_constraints', {
    schema_name: 'public',
    table_name: tableName
  });
  
  // Get indexes
  const { data: indexes } = await supabase.rpc('get_table_indexes', {
    schema_name: 'public',
    table_name: tableName
  });
  
  // Get RLS policies
  const { data: policies } = await supabase.rpc('get_table_policies', {
    schema_name: 'public',
    table_name: tableName
  });
  
  // Get triggers
  const { data: triggers } = await supabase.rpc('get_table_triggers', {
    schema_name: 'public',
    table_name: tableName
  });
  
  // Get foreign keys
  const { data: foreign_keys } = await supabase.rpc('get_table_foreign_keys', {
    schema_name: 'public',
    table_name: tableName
  });
  
  return {
    table_name: tableName,
    columns: columns || [],
    constraints: constraints || [],
    indexes: indexes || [],
    policies: policies || [],
    triggers: triggers || [],
    foreign_keys: foreign_keys || []
  };
}

function checkNamingConventions(tableInfo: TableInfo, issues: AuditIssue[]) {
  // Check table name
  const validPrefixes = ['auth_', 'ai_', 'google_', 'learn_', 'media_', 'doc_', 
                        'expert_', 'email_', 'command_', 'filter_', 'batch_', 
                        'scripts_', 'sys_', 'dev_', 'registry_', 'service_', 
                        'worktree_', 'import_'];
  
  const hasValidPrefix = validPrefixes.some(prefix => tableInfo.table_name.startsWith(prefix));
  
  if (!hasValidPrefix && !['clipboard_snippets', 'document_types', 'sources', 'source_experts'].includes(tableInfo.table_name)) {
    issues.push({
      severity: 'warning',
      category: 'naming',
      message: `Table name '${tableInfo.table_name}' doesn't follow prefix convention`,
      fix: `Consider renaming to use one of the standard prefixes: ${validPrefixes.join(', ')}`
    });
  }
  
  // Check column names
  for (const column of tableInfo.columns) {
    if (!isSnakeCase(column.column_name)) {
      issues.push({
        severity: 'warning',
        category: 'naming',
        message: `Column '${column.column_name}' is not in snake_case`,
        fix: `Rename to: ${toSnakeCase(column.column_name)}`
      });
    }
  }
}

function checkStandardFields(tableInfo: TableInfo, issues: AuditIssue[]) {
  const columns = tableInfo.columns.map(c => c.column_name);
  
  // Check for id field
  if (!columns.includes('id')) {
    issues.push({
      severity: 'critical',
      category: 'structure',
      message: 'Missing primary key field "id"',
      fix: 'ALTER TABLE ' + tableInfo.table_name + ' ADD COLUMN id UUID DEFAULT gen_random_uuid() PRIMARY KEY;'
    });
  }
  
  // Check for timestamp fields
  if (!columns.includes('created_at')) {
    issues.push({
      severity: 'warning',
      category: 'structure',
      message: 'Missing "created_at" timestamp field',
      fix: `ALTER TABLE ${tableInfo.table_name} ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();`
    });
  }
  
  if (!columns.includes('updated_at')) {
    issues.push({
      severity: 'warning',
      category: 'structure',
      message: 'Missing "updated_at" timestamp field',
      fix: `ALTER TABLE ${tableInfo.table_name} ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();`
    });
  }
}

function checkPrimaryKey(tableInfo: TableInfo, issues: AuditIssue[]) {
  const pkConstraint = tableInfo.constraints.find(c => c.constraint_type === 'PRIMARY KEY');
  
  if (!pkConstraint) {
    issues.push({
      severity: 'critical',
      category: 'constraints',
      message: 'Table has no primary key',
      fix: `ALTER TABLE ${tableInfo.table_name} ADD PRIMARY KEY (id);`
    });
  }
}

function checkForeignKeys(tableInfo: TableInfo, issues: AuditIssue[]) {
  for (const fk of tableInfo.foreign_keys) {
    // Check ON DELETE action
    if (!fk.delete_rule || fk.delete_rule === 'NO ACTION') {
      issues.push({
        severity: 'warning',
        category: 'foreign_keys',
        message: `Foreign key '${fk.constraint_name}' has no ON DELETE action`,
        fix: `Consider adding ON DELETE CASCADE or ON DELETE SET NULL`
      });
    }
    
    // Check if foreign key column has an index
    const fkColumn = fk.column_name;
    const hasIndex = tableInfo.indexes.some(idx => 
      idx.column_names && idx.column_names.includes(fkColumn)
    );
    
    if (!hasIndex) {
      issues.push({
        severity: 'warning',
        category: 'performance',
        message: `Foreign key column '${fkColumn}' lacks an index`,
        fix: `CREATE INDEX idx_${tableInfo.table_name}_${fkColumn} ON ${tableInfo.table_name}(${fkColumn});`
      });
    }
  }
}

function checkIndexes(tableInfo: TableInfo, issues: AuditIssue[]) {
  // Check for commonly queried fields that might need indexes
  const columnsNeedingIndexes = ['user_id', 'email', 'status', 'type', 'name'];
  
  for (const column of tableInfo.columns) {
    if (columnsNeedingIndexes.includes(column.column_name)) {
      const hasIndex = tableInfo.indexes.some(idx => 
        idx.column_names && idx.column_names.includes(column.column_name)
      );
      
      if (!hasIndex) {
        issues.push({
          severity: 'info',
          category: 'performance',
          message: `Consider adding index on frequently queried column '${column.column_name}'`,
          fix: `CREATE INDEX idx_${tableInfo.table_name}_${column.column_name} ON ${tableInfo.table_name}(${column.column_name});`
        });
      }
    }
  }
}

function checkConstraints(tableInfo: TableInfo, issues: AuditIssue[]) {
  // Check for NOT NULL constraints on important fields
  for (const column of tableInfo.columns) {
    if (['name', 'title', 'email'].includes(column.column_name) && column.is_nullable === 'YES') {
      issues.push({
        severity: 'info',
        category: 'constraints',
        message: `Column '${column.column_name}' allows NULL values`,
        fix: `Consider adding NOT NULL constraint if appropriate`
      });
    }
  }
}

function checkRLSPolicies(tableInfo: TableInfo, issues: AuditIssue[]) {
  if (tableInfo.policies.length === 0) {
    issues.push({
      severity: 'warning',
      category: 'security',
      message: 'Table has no RLS policies',
      fix: 'Consider adding Row Level Security policies for data protection'
    });
  }
}

function checkTriggers(tableInfo: TableInfo, issues: AuditIssue[]) {
  // Check for updated_at trigger
  const hasUpdatedAtColumn = tableInfo.columns.some(c => c.column_name === 'updated_at');
  const hasUpdatedAtTrigger = tableInfo.triggers.some(t => 
    t.trigger_name.includes('updated_at') || t.trigger_name.includes('update_modified')
  );
  
  if (hasUpdatedAtColumn && !hasUpdatedAtTrigger) {
    issues.push({
      severity: 'warning',
      category: 'triggers',
      message: 'Table has updated_at column but no update trigger',
      fix: `CREATE TRIGGER update_${tableInfo.table_name}_updated_at BEFORE UPDATE ON ${tableInfo.table_name} FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();`
    });
  }
}

function checkDataTypes(tableInfo: TableInfo, issues: AuditIssue[]) {
  for (const column of tableInfo.columns) {
    // Check ID fields
    if (column.column_name === 'id' && column.data_type !== 'uuid') {
      issues.push({
        severity: 'warning',
        category: 'data_types',
        message: `ID column is ${column.data_type} instead of UUID`,
        fix: 'Consider using UUID for better uniqueness and distribution'
      });
    }
    
    // Check timestamp fields
    if (column.column_name.endsWith('_at') && !column.data_type.includes('timestamp')) {
      issues.push({
        severity: 'warning',
        category: 'data_types',
        message: `Column '${column.column_name}' should be TIMESTAMPTZ`,
        fix: `ALTER TABLE ${tableInfo.table_name} ALTER COLUMN ${column.column_name} TYPE TIMESTAMPTZ;`
      });
    }
  }
}

function generateRecommendations(issues: AuditIssue[], recommendations: string[]) {
  const criticalCount = issues.filter(i => i.severity === 'critical').length;
  const warningCount = issues.filter(i => i.severity === 'warning').length;
  
  if (criticalCount > 0) {
    recommendations.push('Address critical issues immediately to ensure data integrity');
  }
  
  if (warningCount > 3) {
    recommendations.push('Consider creating a migration to fix multiple issues at once');
  }
  
  const categories = [...new Set(issues.map(i => i.category))];
  if (categories.includes('performance')) {
    recommendations.push('Review query patterns and add appropriate indexes');
  }
  
  if (categories.includes('security')) {
    recommendations.push('Implement Row Level Security policies for better data protection');
  }
}

function calculateHealthScore(issues: AuditIssue[]): number {
  let score = 100;
  
  for (const issue of issues) {
    switch (issue.severity) {
      case 'critical':
        score -= 20;
        break;
      case 'warning':
        score -= 10;
        break;
      case 'info':
        score -= 2;
        break;
    }
  }
  
  return Math.max(0, score);
}

function displayTableAuditResult(result: TableAuditResult) {
  const scoreColor = result.score >= 80 ? chalk.green : 
                    result.score >= 60 ? chalk.yellow : chalk.red;
  
  console.log(chalk.bold(`\nTable: ${result.table_name}`));
  console.log(`Health Score: ${scoreColor(result.score + '/100')}`);
  
  if (result.issues.length === 0) {
    console.log(chalk.green('✓ No issues found!'));
    return;
  }
  
  // Group issues by severity
  const critical = result.issues.filter(i => i.severity === 'critical');
  const warnings = result.issues.filter(i => i.severity === 'warning');
  const info = result.issues.filter(i => i.severity === 'info');
  
  if (critical.length > 0) {
    console.log(chalk.red('\nCritical Issues:'));
    critical.forEach(issue => {
      console.log(chalk.red(`  ✗ [${issue.category}] ${issue.message}`));
      if (issue.fix) {
        console.log(chalk.gray(`    Fix: ${issue.fix}`));
      }
    });
  }
  
  if (warnings.length > 0) {
    console.log(chalk.yellow('\nWarnings:'));
    warnings.forEach(issue => {
      console.log(chalk.yellow(`  ⚠ [${issue.category}] ${issue.message}`));
      if (issue.fix) {
        console.log(chalk.gray(`    Fix: ${issue.fix}`));
      }
    });
  }
  
  if (info.length > 0) {
    console.log(chalk.blue('\nInfo:'));
    info.forEach(issue => {
      console.log(chalk.blue(`  ℹ [${issue.category}] ${issue.message}`));
      if (issue.fix) {
        console.log(chalk.gray(`    Fix: ${issue.fix}`));
      }
    });
  }
  
  if (result.recommendations.length > 0) {
    console.log(chalk.cyan('\nRecommendations:'));
    result.recommendations.forEach(rec => {
      console.log(chalk.cyan(`  • ${rec}`));
    });
  }
}

function displayAuditSummary(results: TableAuditResult[]) {
  console.log(chalk.bold('\n═══════════════════════════════════════'));
  console.log(chalk.bold('AUDIT SUMMARY'));
  console.log(chalk.bold('═══════════════════════════════════════'));
  
  const totalTables = results.length;
  const avgScore = results.reduce((sum, r) => sum + r.score, 0) / totalTables;
  const perfectTables = results.filter(r => r.score === 100).length;
  const criticalTables = results.filter(r => r.score < 60).length;
  
  console.log(`Total Tables Audited: ${totalTables}`);
  console.log(`Average Health Score: ${avgScore.toFixed(1)}/100`);
  console.log(`Perfect Tables: ${chalk.green(perfectTables)}`);
  console.log(`Tables Needing Attention: ${chalk.red(criticalTables)}`);
  
  // Show worst tables
  const worstTables = results
    .filter(r => r.score < 80)
    .sort((a, b) => a.score - b.score)
    .slice(0, 5);
    
  if (worstTables.length > 0) {
    console.log(chalk.yellow('\nTables Requiring Attention:'));
    worstTables.forEach(table => {
      console.log(`  ${table.table_name}: ${table.score}/100 (${table.issues.length} issues)`);
    });
  }
}

// Helper functions
function isSnakeCase(str: string): boolean {
  return /^[a-z]+(_[a-z]+)*$/.test(str);
}

function toSnakeCase(str: string): string {
  return str
    .replace(/([A-Z])/g, '_$1')
    .toLowerCase()
    .replace(/^_/, '');
}