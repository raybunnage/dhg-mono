import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';
import { formatterService } from '../../../../packages/shared/services/formatter-service';
import chalk from 'chalk';
import * as fs from 'fs/promises';
import * as path from 'path';

interface FunctionUsage {
  function_name: string;
  function_schema: string;
  argument_types: string;
  return_type: string;
  is_used: boolean;
  used_in_views: number;
  used_in_functions: number;
  used_in_triggers: number;
  total_usage_count: number;
  can_be_safely_removed: boolean;
}

interface FunctionCategory {
  category: string;
  functions: FunctionUsage[];
  totalCount: number;
  unusedCount: number;
}

export async function functionAudit(options: { generateSql?: boolean; output?: string } = {}) {
  const supabase = SupabaseClientService.getInstance().getClient();
  
  try {
    console.log(chalk.blue('\nAnalyzing database functions...\n'));
    
    // Get function usage analysis
    const { data: functions, error } = await supabase.rpc('analyze_function_usage');
    
    if (error) throw error;
    
    if (!functions || functions.length === 0) {
      console.log(chalk.yellow('No functions found to analyze'));
      return;
    }
    
    // Categorize functions
    const categorized = categorizeFunctions(functions);
    
    // Display analysis results
    displayFunctionAnalysis(categorized);
    
    // Generate removal SQL if requested
    if (options.generateSql) {
      const sqlFile = await generateRemovalSQL(functions.filter(f => f.can_be_safely_removed));
      console.log(chalk.green(`\nRemoval SQL generated: ${sqlFile}`));
    }
    
    // Display summary and recommendations
    displaySummaryAndRecommendations(functions, categorized);
    
  } catch (error) {
    console.error(chalk.red('Error during function audit:'), error);
    throw error;
  }
}

function categorizeFunctions(functions: FunctionUsage[]): FunctionCategory[] {
  const categories: Map<string, FunctionUsage[]> = new Map();
  
  // Categorize by function name patterns
  functions.forEach(func => {
    let category = 'other';
    
    // Determine category based on function name
    if (func.function_name.startsWith('get_')) {
      category = 'getter_functions';
    } else if (func.function_name.startsWith('update_')) {
      category = 'update_functions';
    } else if (func.function_name.startsWith('create_')) {
      category = 'create_functions';
    } else if (func.function_name.startsWith('delete_')) {
      category = 'delete_functions';
    } else if (func.function_name.includes('_view')) {
      category = 'view_functions';
    } else if (func.function_name.includes('_trigger')) {
      category = 'trigger_functions';
    } else if (func.function_name.includes('backup')) {
      category = 'backup_functions';
    } else if (func.function_name.includes('migration')) {
      category = 'migration_functions';
    } else if (func.function_name.includes('_rpc')) {
      category = 'rpc_functions';
    } else if (func.function_name.includes('execute_sql')) {
      category = 'utility_functions';
    }
    
    if (!categories.has(category)) {
      categories.set(category, []);
    }
    categories.get(category)!.push(func);
  });
  
  // Convert to array and calculate stats
  const result: FunctionCategory[] = [];
  categories.forEach((funcs, category) => {
    result.push({
      category,
      functions: funcs.sort((a, b) => a.function_name.localeCompare(b.function_name)),
      totalCount: funcs.length,
      unusedCount: funcs.filter(f => !f.is_used).length
    });
  });
  
  return result.sort((a, b) => b.unusedCount - a.unusedCount);
}

function displayFunctionAnalysis(categorized: FunctionCategory[]) {
  console.log(chalk.bold('FUNCTION ANALYSIS BY CATEGORY'));
  console.log(chalk.gray('═'.repeat(80)));
  
  categorized.forEach(category => {
    const unusedPercent = (category.unusedCount / category.totalCount * 100).toFixed(0);
    const headerColor = category.unusedCount > 0 ? chalk.yellow : chalk.green;
    
    console.log(headerColor(`\n${formatCategoryName(category.category)} (${category.totalCount} functions, ${category.unusedCount} unused - ${unusedPercent}%)`));
    
    // Show unused functions first
    const unused = category.functions.filter(f => !f.is_used);
    if (unused.length > 0) {
      console.log(chalk.red('  Unused Functions:'));
      unused.forEach(func => {
        console.log(chalk.red(`    ✗ ${func.function_name}(${func.argument_types})`));
        console.log(chalk.gray(`      Returns: ${func.return_type}`));
      });
    }
    
    // Show used functions
    const used = category.functions.filter(f => f.is_used);
    if (used.length > 0 && used.length <= 5) { // Only show if not too many
      console.log(chalk.green('  Used Functions:'));
      used.forEach(func => {
        const usageDetails = [];
        if (func.used_in_views > 0) usageDetails.push(`${func.used_in_views} views`);
        if (func.used_in_functions > 0) usageDetails.push(`${func.used_in_functions} functions`);
        if (func.used_in_triggers > 0) usageDetails.push(`${func.used_in_triggers} triggers`);
        
        console.log(chalk.green(`    ✓ ${func.function_name}(${func.argument_types})`));
        console.log(chalk.gray(`      Used in: ${usageDetails.join(', ')}`));
      });
    } else if (used.length > 5) {
      console.log(chalk.green(`  ✓ ${used.length} functions are actively used`));
    }
  });
}

async function generateRemovalSQL(unusedFunctions: FunctionUsage[]): Promise<string> {
  if (unusedFunctions.length === 0) {
    return '';
  }
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
  const filename = `remove_unused_functions_${timestamp}.sql`;
  const filepath = path.join(process.cwd(), 'scripts/cli-pipeline/database/generated', filename);
  
  let sql = `-- Generated SQL to remove unused functions
-- Generated at: ${new Date().toISOString()}
-- Total functions to remove: ${unusedFunctions.length}

-- IMPORTANT: Review each function before executing this script
-- Some functions might be used outside the database (e.g., in application code)

BEGIN;

`;
  
  // Group by schema
  const bySchema = new Map<string, FunctionUsage[]>();
  unusedFunctions.forEach(func => {
    if (!bySchema.has(func.function_schema)) {
      bySchema.set(func.function_schema, []);
    }
    bySchema.get(func.function_schema)!.push(func);
  });
  
  bySchema.forEach((funcs, schema) => {
    sql += `\n-- Schema: ${schema} (${funcs.length} functions)\n`;
    
    funcs.forEach(func => {
      sql += `\n-- Function: ${func.function_name}`;
      sql += `\n-- Arguments: ${func.argument_types || 'none'}`;
      sql += `\n-- Returns: ${func.return_type}`;
      sql += `\nDROP FUNCTION IF EXISTS ${schema}.${func.function_name}(${func.argument_types}) CASCADE;\n`;
    });
  });
  
  sql += `\n-- Remove entries from sys_table_definitions if they exist\n`;
  unusedFunctions.forEach(func => {
    sql += `DELETE FROM sys_table_definitions WHERE table_schema = '${func.function_schema}' AND table_name = '${func.function_name}';\n`;
  });
  
  sql += `\nCOMMIT;\n\n-- Total functions removed: ${unusedFunctions.length}`;
  
  // Ensure directory exists
  await fs.mkdir(path.dirname(filepath), { recursive: true });
  
  // Write file
  await fs.writeFile(filepath, sql, 'utf-8');
  
  return filepath;
}

function displaySummaryAndRecommendations(functions: FunctionUsage[], categorized: FunctionCategory[]) {
  const totalFunctions = functions.length;
  const unusedFunctions = functions.filter(f => !f.is_used);
  const usedFunctions = functions.filter(f => f.is_used);
  
  console.log(chalk.bold('\n═══════════════════════════════════════'));
  console.log(chalk.bold('FUNCTION AUDIT SUMMARY'));
  console.log(chalk.bold('═══════════════════════════════════════'));
  
  console.log(`Total Functions: ${totalFunctions}`);
  console.log(`Used Functions: ${chalk.green(usedFunctions.length)} (${(usedFunctions.length / totalFunctions * 100).toFixed(0)}%)`);
  console.log(`Unused Functions: ${chalk.red(unusedFunctions.length)} (${(unusedFunctions.length / totalFunctions * 100).toFixed(0)}%)`);
  
  // Most used functions
  const mostUsed = functions
    .filter(f => f.total_usage_count > 0)
    .sort((a, b) => b.total_usage_count - a.total_usage_count)
    .slice(0, 5);
    
  if (mostUsed.length > 0) {
    console.log(chalk.cyan('\nMost Used Functions:'));
    mostUsed.forEach(func => {
      console.log(`  ${func.function_name}: ${func.total_usage_count} references`);
    });
  }
  
  console.log(chalk.cyan('\nRecommendations:'));
  
  if (unusedFunctions.length > 0) {
    console.log(chalk.yellow(`\n1. Function Cleanup:`));
    console.log(`   • ${unusedFunctions.length} functions can potentially be removed`);
    console.log(`   • Run with --generate-sql flag to create removal script`);
    console.log(`   • Review generated SQL before executing`);
    console.log(`   • Check application code for dynamic function calls`);
  }
  
  // Check for deprecated patterns
  const deprecatedPatterns = functions.filter(f => 
    f.function_name.includes('_old') || 
    f.function_name.includes('_backup') ||
    f.function_name.includes('_temp') ||
    f.function_name.includes('_test')
  );
  
  if (deprecatedPatterns.length > 0) {
    console.log(chalk.yellow(`\n2. Deprecated Pattern Functions:`));
    console.log(`   • Found ${deprecatedPatterns.length} functions with deprecated naming patterns`);
    console.log(`   • Consider removing: ${deprecatedPatterns.map(f => f.function_name).join(', ')}`);
  }
  
  // Check for duplicate functionality
  const getterFunctions = categorized.find(c => c.category === 'getter_functions');
  if (getterFunctions && getterFunctions.functions.length > 20) {
    console.log(chalk.yellow(`\n3. Function Consolidation:`));
    console.log(`   • ${getterFunctions.functions.length} getter functions found`);
    console.log(`   • Consider consolidating similar functions`);
    console.log(`   • Use parameterized functions instead of multiple specific ones`);
  }
  
  console.log(chalk.blue(`\n4. Best Practices:`));
  console.log(`   • Document function purpose in comments`);
  console.log(`   • Use consistent naming conventions`);
  console.log(`   • Remove test/temporary functions promptly`);
  console.log(`   • Consider using views instead of getter functions where appropriate`);
}

function formatCategoryName(category: string): string {
  return category
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}