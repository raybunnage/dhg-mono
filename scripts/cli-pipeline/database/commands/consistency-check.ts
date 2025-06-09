import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';
import { formatterService } from '../../../../packages/shared/services/formatter-service';
import chalk from 'chalk';
import * as fs from 'fs/promises';
import * as path from 'path';

interface ConsistencyIssue {
  category: 'naming' | 'data_type' | 'constraint' | 'relationship' | 'standard_field';
  severity: 'critical' | 'warning' | 'info';
  tables: string[];
  field?: string;
  issue: string;
  recommendation: string;
  sql_fix?: string;
}

interface FieldPattern {
  pattern: string;
  expected_type: string;
  variations: { table: string; column: string; actual_type: string }[];
}

export async function consistencyCheck(options: { generateFixes?: boolean } = {}) {
  const supabase = SupabaseClientService.getInstance().getClient();
  
  try {
    console.log(chalk.blue('\nAnalyzing database consistency...\n'));
    
    // Get all tables and their columns
    const tables = await getAllTablesAndColumns(supabase);
    
    if (tables.length === 0) {
      console.log(chalk.yellow('No tables found to analyze'));
      return;
    }
    
    const issues: ConsistencyIssue[] = [];
    
    // Run various consistency checks
    console.log(chalk.gray('Checking field naming patterns...'));
    await checkFieldNamingPatterns(tables, issues);
    
    console.log(chalk.gray('Checking data type consistency...'));
    await checkDataTypeConsistency(tables, issues);
    
    console.log(chalk.gray('Checking standard fields...'));
    await checkStandardFields(tables, issues);
    
    console.log(chalk.gray('Checking foreign key consistency...'));
    await checkForeignKeyConsistency(supabase, tables, issues);
    
    console.log(chalk.gray('Checking enum consistency...'));
    await checkEnumConsistency(tables, issues);
    
    console.log(chalk.gray('Checking timestamp fields...'));
    await checkTimestampFields(tables, issues);
    
    // Display results
    displayConsistencyReport(issues);
    
    // Generate fix SQL if requested
    if (options.generateFixes && issues.some(i => i.sql_fix)) {
      const sqlFile = await generateFixSQL(issues.filter(i => i.sql_fix));
      console.log(chalk.green(`\nFix SQL generated: ${sqlFile}`));
    }
    
    // Display summary
    displayConsistencySummary(issues);
    
  } catch (error) {
    console.error(chalk.red('Error during consistency check:'), error);
    throw error;
  }
}

async function getAllTablesAndColumns(supabase: any) {
  const { data, error } = await supabase.rpc('execute_sql', {
    sql: `
      SELECT 
        t.table_name,
        array_agg(
          json_build_object(
            'column_name', c.column_name,
            'data_type', c.data_type,
            'is_nullable', c.is_nullable,
            'column_default', c.column_default
          ) ORDER BY c.ordinal_position
        ) as columns
      FROM information_schema.tables t
      JOIN information_schema.columns c 
        ON t.table_schema = c.table_schema 
        AND t.table_name = c.table_name
      WHERE t.table_schema = 'public'
        AND t.table_type = 'BASE TABLE'
        AND t.table_name NOT LIKE 'pg_%'
        AND t.table_name NOT LIKE '__%'
      GROUP BY t.table_name
      ORDER BY t.table_name
    `
  });
  
  if (error) throw error;
  return data || [];
}

async function checkFieldNamingPatterns(tables: any[], issues: ConsistencyIssue[]) {
  const fieldPatterns = new Map<string, FieldPattern>();
  
  // Analyze common field patterns
  tables.forEach(table => {
    table.columns.forEach((column: any) => {
      // Extract common patterns
      const patterns = extractFieldPatterns(column.column_name);
      
      patterns.forEach(pattern => {
        if (!fieldPatterns.has(pattern)) {
          fieldPatterns.set(pattern, {
            pattern,
            expected_type: column.data_type,
            variations: []
          });
        }
        
        const patternData = fieldPatterns.get(pattern)!;
        
        // Check if this variation already exists
        const exists = patternData.variations.some(v => 
          v.table === table.table_name && v.column === column.column_name
        );
        
        if (!exists) {
          patternData.variations.push({
            table: table.table_name,
            column: column.column_name,
            actual_type: column.data_type
          });
        }
      });
    });
  });
  
  // Find inconsistencies
  fieldPatterns.forEach((pattern, patternName) => {
    const variations = new Map<string, string[]>();
    
    pattern.variations.forEach(v => {
      const key = `${v.column}|${v.actual_type}`;
      if (!variations.has(key)) {
        variations.set(key, []);
      }
      variations.get(key)!.push(v.table);
    });
    
    // If there are multiple variations of the same pattern
    if (variations.size > 1) {
      const variationList = Array.from(variations.entries());
      const mostCommon = variationList.reduce((a, b) => a[1].length > b[1].length ? a : b);
      
      variationList.forEach(([key, tables]) => {
        if (key !== mostCommon[0]) {
          const [columnName, dataType] = key.split('|');
          issues.push({
            category: 'naming',
            severity: 'warning',
            tables: tables,
            field: columnName,
            issue: `Field pattern '${patternName}' has inconsistent naming: '${columnName}' (${dataType}) vs '${mostCommon[0].split('|')[0]}' (${mostCommon[0].split('|')[1]})`,
            recommendation: `Standardize to '${mostCommon[0].split('|')[0]}' across all tables`
          });
        }
      });
    }
  });
}

async function checkDataTypeConsistency(tables: any[], issues: ConsistencyIssue[]) {
  const fieldTypes = new Map<string, Map<string, string[]>>();
  
  // Collect all field names and their types across tables
  tables.forEach(table => {
    table.columns.forEach((column: any) => {
      if (!fieldTypes.has(column.column_name)) {
        fieldTypes.set(column.column_name, new Map());
      }
      
      const typeMap = fieldTypes.get(column.column_name)!;
      if (!typeMap.has(column.data_type)) {
        typeMap.set(column.data_type, []);
      }
      typeMap.get(column.data_type)!.push(table.table_name);
    });
  });
  
  // Find fields with inconsistent types
  fieldTypes.forEach((typeMap, fieldName) => {
    if (typeMap.size > 1) {
      const types = Array.from(typeMap.entries());
      const mostCommonType = types.reduce((a, b) => a[1].length > b[1].length ? a : b);
      
      types.forEach(([dataType, tables]) => {
        if (dataType !== mostCommonType[0]) {
          issues.push({
            category: 'data_type',
            severity: 'warning',
            tables: tables,
            field: fieldName,
            issue: `Field '${fieldName}' has inconsistent types: ${dataType} vs ${mostCommonType[0]} (used in ${mostCommonType[1].length} tables)`,
            recommendation: `Standardize to ${mostCommonType[0]} data type`,
            sql_fix: tables.map(table => 
              `ALTER TABLE ${table} ALTER COLUMN ${fieldName} TYPE ${mostCommonType[0]} USING ${fieldName}::${mostCommonType[0]};`
            ).join('\n')
          });
        }
      });
    }
  });
}

async function checkStandardFields(tables: any[], issues: ConsistencyIssue[]) {
  const standardFields = [
    { name: 'id', type: 'uuid', required: true },
    { name: 'created_at', type: 'timestamp with time zone', required: false },
    { name: 'updated_at', type: 'timestamp with time zone', required: false }
  ];
  
  tables.forEach(table => {
    const columnMap = new Map(table.columns.map((c: any) => [c.column_name, c]));
    
    standardFields.forEach(stdField => {
      const column = columnMap.get(stdField.name);
      
      if (stdField.required && !column) {
        issues.push({
          category: 'standard_field',
          severity: 'critical',
          tables: [table.table_name],
          field: stdField.name,
          issue: `Missing required field '${stdField.name}'`,
          recommendation: `Add ${stdField.name} field with type ${stdField.type}`,
          sql_fix: `ALTER TABLE ${table.table_name} ADD COLUMN ${stdField.name} ${stdField.type}${stdField.name === 'id' ? ' DEFAULT gen_random_uuid() PRIMARY KEY' : ' DEFAULT NOW()'};`
        });
      } else if (column && column.data_type !== stdField.type) {
        issues.push({
          category: 'standard_field',
          severity: 'warning',
          tables: [table.table_name],
          field: stdField.name,
          issue: `Standard field '${stdField.name}' has incorrect type: ${column.data_type} instead of ${stdField.type}`,
          recommendation: `Change to ${stdField.type}`,
          sql_fix: `ALTER TABLE ${table.table_name} ALTER COLUMN ${stdField.name} TYPE ${stdField.type};`
        });
      }
    });
  });
}

async function checkForeignKeyConsistency(supabase: any, tables: any[], issues: ConsistencyIssue[]) {
  // Get all foreign keys
  const { data: foreignKeys, error } = await supabase.rpc('execute_sql', {
    sql: `
      SELECT 
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name,
        c1.data_type as source_type,
        c2.data_type as target_type
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      JOIN information_schema.columns c1
        ON c1.table_schema = tc.table_schema
        AND c1.table_name = tc.table_name
        AND c1.column_name = kcu.column_name
      JOIN information_schema.columns c2
        ON c2.table_schema = ccu.table_schema
        AND c2.table_name = ccu.table_name
        AND c2.column_name = ccu.column_name
      WHERE tc.table_schema = 'public'
        AND tc.constraint_type = 'FOREIGN KEY'
    `
  });
  
  if (error) throw error;
  
  // Check for type mismatches
  foreignKeys.forEach((fk: any) => {
    if (fk.source_type !== fk.target_type) {
      issues.push({
        category: 'relationship',
        severity: 'critical',
        tables: [fk.table_name],
        field: fk.column_name,
        issue: `Foreign key type mismatch: ${fk.column_name} (${fk.source_type}) references ${fk.foreign_table_name}.${fk.foreign_column_name} (${fk.target_type})`,
        recommendation: `Ensure both columns have the same data type`,
        sql_fix: `ALTER TABLE ${fk.table_name} ALTER COLUMN ${fk.column_name} TYPE ${fk.target_type};`
      });
    }
  });
  
  // Check for potential missing foreign keys
  tables.forEach(table => {
    table.columns.forEach((column: any) => {
      // Common FK patterns
      const fkPatterns = ['_id', '_uuid', '_ref'];
      const isFkPattern = fkPatterns.some(pattern => column.column_name.endsWith(pattern));
      
      if (isFkPattern && column.column_name !== 'id') {
        // Check if FK exists
        const hasFk = foreignKeys.some((fk: any) => 
          fk.table_name === table.table_name && fk.column_name === column.column_name
        );
        
        if (!hasFk) {
          // Try to guess the referenced table
          const potentialTable = column.column_name.replace(/_id$|_uuid$|_ref$/, '') + 's';
          
          issues.push({
            category: 'relationship',
            severity: 'info',
            tables: [table.table_name],
            field: column.column_name,
            issue: `Column '${column.column_name}' looks like a foreign key but has no constraint`,
            recommendation: `Consider adding foreign key constraint if this references another table`
          });
        }
      }
    });
  });
}

async function checkEnumConsistency(tables: any[], issues: ConsistencyIssue[]) {
  const enumFields = new Map<string, Map<string, string[]>>();
  
  // Common enum field patterns
  const enumPatterns = ['status', 'type', 'state', 'role', 'level', 'priority'];
  
  tables.forEach(table => {
    table.columns.forEach((column: any) => {
      if (enumPatterns.some(pattern => column.column_name.includes(pattern))) {
        if (!enumFields.has(column.column_name)) {
          enumFields.set(column.column_name, new Map());
        }
        
        const typeMap = enumFields.get(column.column_name)!;
        const key = `${column.data_type}|${column.column_default || 'null'}`;
        
        if (!typeMap.has(key)) {
          typeMap.set(key, []);
        }
        typeMap.get(key)!.push(table.table_name);
      }
    });
  });
  
  // Check for inconsistencies
  enumFields.forEach((typeMap, fieldName) => {
    if (typeMap.size > 1) {
      const variations = Array.from(typeMap.entries());
      
      issues.push({
        category: 'data_type',
        severity: 'info',
        tables: variations.flatMap(v => v[1]),
        field: fieldName,
        issue: `Enum-like field '${fieldName}' has ${typeMap.size} different implementations`,
        recommendation: `Consider using a consistent approach (check constraint, enum type, or reference table)`
      });
    }
  });
}

async function checkTimestampFields(tables: any[], issues: ConsistencyIssue[]) {
  tables.forEach(table => {
    const timestampFields = table.columns.filter((c: any) => 
      c.column_name.endsWith('_at') || c.column_name.endsWith('_date') || c.column_name.endsWith('_time')
    );
    
    timestampFields.forEach((field: any) => {
      // Check if timestamp fields use timezone
      if (field.column_name.endsWith('_at') && field.data_type === 'timestamp without time zone') {
        issues.push({
          category: 'data_type',
          severity: 'warning',
          tables: [table.table_name],
          field: field.column_name,
          issue: `Timestamp field '${field.column_name}' doesn't include timezone`,
          recommendation: `Use 'timestamp with time zone' for better timezone handling`,
          sql_fix: `ALTER TABLE ${table.table_name} ALTER COLUMN ${field.column_name} TYPE TIMESTAMPTZ;`
        });
      }
      
      // Check for inconsistent naming
      if (field.column_name.endsWith('_date') && field.data_type.includes('timestamp')) {
        issues.push({
          category: 'naming',
          severity: 'info',
          tables: [table.table_name],
          field: field.column_name,
          issue: `Field '${field.column_name}' ends with '_date' but stores timestamp`,
          recommendation: `Consider renaming to '${field.column_name.replace('_date', '_at')}' for clarity`
        });
      }
    });
  });
}

async function generateFixSQL(issues: ConsistencyIssue[]): Promise<string> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
  const filename = `consistency_fixes_${timestamp}.sql`;
  const filepath = path.join(process.cwd(), 'scripts/cli-pipeline/database/generated', filename);
  
  let sql = `-- Generated SQL to fix consistency issues
-- Generated at: ${new Date().toISOString()}
-- Total fixes: ${issues.length}

-- IMPORTANT: Review each fix before executing
-- Some changes might require data migration

BEGIN;

`;
  
  // Group by category
  const byCategory = new Map<string, ConsistencyIssue[]>();
  issues.forEach(issue => {
    if (!byCategory.has(issue.category)) {
      byCategory.set(issue.category, []);
    }
    byCategory.get(issue.category)!.push(issue);
  });
  
  byCategory.forEach((categoryIssues, category) => {
    sql += `\n-- Category: ${category} (${categoryIssues.length} fixes)\n`;
    
    categoryIssues.forEach(issue => {
      sql += `\n-- Issue: ${issue.issue}\n`;
      sql += `-- Tables: ${issue.tables.join(', ')}\n`;
      sql += `-- Recommendation: ${issue.recommendation}\n`;
      if (issue.sql_fix) {
        sql += `${issue.sql_fix}\n`;
      }
    });
  });
  
  sql += `\nCOMMIT;\n`;
  
  // Ensure directory exists
  await fs.mkdir(path.dirname(filepath), { recursive: true });
  
  // Write file
  await fs.writeFile(filepath, sql, 'utf-8');
  
  return filepath;
}

function displayConsistencyReport(issues: ConsistencyIssue[]) {
  if (issues.length === 0) {
    console.log(chalk.green('\n✓ No consistency issues found!'));
    return;
  }
  
  console.log(chalk.bold('\nCONSISTENCY ISSUES FOUND'));
  console.log(chalk.gray('═'.repeat(80)));
  
  // Group by category
  const byCategory = new Map<string, ConsistencyIssue[]>();
  issues.forEach(issue => {
    if (!byCategory.has(issue.category)) {
      byCategory.set(issue.category, []);
    }
    byCategory.get(issue.category)!.push(issue);
  });
  
  byCategory.forEach((categoryIssues, category) => {
    console.log(chalk.bold(`\n${formatCategoryName(category)} Issues (${categoryIssues.length})`));
    
    // Further group by severity
    const bySeverity = new Map<string, ConsistencyIssue[]>();
    categoryIssues.forEach(issue => {
      if (!bySeverity.has(issue.severity)) {
        bySeverity.set(issue.severity, []);
      }
      bySeverity.get(issue.severity)!.push(issue);
    });
    
    ['critical', 'warning', 'info'].forEach(severity => {
      const severityIssues = bySeverity.get(severity);
      if (severityIssues && severityIssues.length > 0) {
        const color = severity === 'critical' ? chalk.red : 
                     severity === 'warning' ? chalk.yellow : chalk.blue;
        
        severityIssues.forEach(issue => {
          console.log(color(`\n  ${getSeverityIcon(severity)} ${issue.issue}`));
          console.log(chalk.gray(`     Tables: ${issue.tables.join(', ')}`));
          if (issue.field) {
            console.log(chalk.gray(`     Field: ${issue.field}`));
          }
          console.log(chalk.cyan(`     → ${issue.recommendation}`));
        });
      }
    });
  });
}

function displayConsistencySummary(issues: ConsistencyIssue[]) {
  console.log(chalk.bold('\n═══════════════════════════════════════'));
  console.log(chalk.bold('CONSISTENCY CHECK SUMMARY'));
  console.log(chalk.bold('═══════════════════════════════════════'));
  
  const critical = issues.filter(i => i.severity === 'critical').length;
  const warnings = issues.filter(i => i.severity === 'warning').length;
  const info = issues.filter(i => i.severity === 'info').length;
  
  console.log(`Total Issues: ${issues.length}`);
  console.log(`Critical: ${chalk.red(critical)}`);
  console.log(`Warnings: ${chalk.yellow(warnings)}`);
  console.log(`Info: ${chalk.blue(info)}`);
  
  // Category breakdown
  const categories = new Map<string, number>();
  issues.forEach(issue => {
    categories.set(issue.category, (categories.get(issue.category) || 0) + 1);
  });
  
  console.log(chalk.cyan('\nIssues by Category:'));
  categories.forEach((count, category) => {
    console.log(`  ${formatCategoryName(category)}: ${count}`);
  });
  
  // Recommendations
  console.log(chalk.cyan('\nNext Steps:'));
  if (critical > 0) {
    console.log(chalk.red('  1. Address critical issues immediately'));
  }
  if (warnings > 5) {
    console.log(chalk.yellow('  2. Create a migration plan for warning-level issues'));
  }
  console.log(chalk.blue('  3. Review info-level suggestions for long-term improvements'));
  console.log(chalk.green('  4. Run with --generate-fixes to create SQL fix scripts'));
}

function extractFieldPatterns(fieldName: string): string[] {
  const patterns: string[] = [];
  
  // Common suffixes
  const suffixes = ['_id', '_at', '_by', '_date', '_time', '_url', '_name', '_type', '_status'];
  suffixes.forEach(suffix => {
    if (fieldName.endsWith(suffix)) {
      patterns.push(suffix);
    }
  });
  
  // Common prefixes
  const prefixes = ['is_', 'has_', 'can_', 'should_'];
  prefixes.forEach(prefix => {
    if (fieldName.startsWith(prefix)) {
      patterns.push(prefix);
    }
  });
  
  return patterns;
}

function formatCategoryName(category: string): string {
  const names: Record<string, string> = {
    'naming': 'Naming Convention',
    'data_type': 'Data Type',
    'constraint': 'Constraint',
    'relationship': 'Foreign Key Relationship',
    'standard_field': 'Standard Field'
  };
  return names[category] || category;
}

function getSeverityIcon(severity: string): string {
  switch (severity) {
    case 'critical': return '✗';
    case 'warning': return '⚠';
    case 'info': return 'ℹ';
    default: return '•';
  }
}