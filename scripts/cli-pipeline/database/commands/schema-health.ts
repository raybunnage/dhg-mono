import { Command } from 'commander';
import { databaseService } from '../../../../packages/shared/services/database-service';
import { commandTrackingService } from '../../../../packages/shared/services/tracking-service/command-tracking-service';
import { formatterService } from '../../../../packages/shared/services/formatter-service';
import chalk from 'chalk';
import Table from 'cli-table3';

const program = new Command();

program
  .name('schema-health')
  .description('Analyze database schema health and identify issues')
  .option('-f, --format <format>', 'Output format (json or table)', 'table')
  .option('--no-color', 'Disable colored output')
  .action(async (options) => {
    const trackingId = await commandTrackingService.startTracking('database', 'schema-health');
    try {
      // Get the schema health analysis
      const healthAnalysis = await databaseService.analyzeSchemaHealth();
      
      if (options.format === 'json') {
        // Output as JSON
        console.log(JSON.stringify(healthAnalysis, null, 2));
      } else {
        // Output as formatted text
        console.log(chalk.bold('\nDATABASE SCHEMA HEALTH CHECK'));
        console.log('==============================\n');
        
        if (healthAnalysis.issues.length === 0) {
          console.log(chalk.green('✓ No issues detected in the database schema!\n'));
        } else {
          console.log(chalk.yellow(`Found ${healthAnalysis.issues.length} potential issues:\n`));
          
          // Process each issue type
          healthAnalysis.issues.forEach((issue: any, index: number) => {
            const severityColor = 
              issue.severity === 'high' ? 'error' :
              issue.severity === 'medium' ? 'warning' : 
              'info';
            
            console.log(formatterService.formatCli(
              `ISSUE #${index + 1}: ${formatterService.formatIssueType(issue.type)} (${issue.severity.toUpperCase()})`,
              severityColor
            ));
            
            if (issue.type === 'missing_primary_key' && issue.tables) {
              console.log('Tables without primary keys:');
              issue.tables.forEach((table: any) => {
                console.log(`  - ${table.table_name}`);
              });
            } else if (issue.type === 'nullable_foreign_keys' && issue.entries) {
              console.log('Nullable foreign keys:');
              const fkTable = new Table({
                head: [
                  chalk.cyan('Table'),
                  chalk.cyan('Column')
                ]
              });
              
              issue.entries.forEach((entry: any) => {
                fkTable.push([
                  entry.table_name,
                  entry.column_name
                ]);
              });
              
              console.log(fkTable.toString());
            } else if (issue.type === 'missing_indexes' && issue.tables) {
              console.log('Tables without indexes:');
              issue.tables.forEach((table: any) => {
                console.log(`  - ${table.table_name}`);
              });
            } else {
              // Generic handler for other issue types
              console.log(JSON.stringify(issue, null, 2));
            }
            
            console.log(''); // Add some spacing between issues
          });
          
          // Recommendations
          console.log(chalk.bold('\nRECOMMENDATIONS:'));
          healthAnalysis.issues.forEach((issue: any) => {
            if (issue.type === 'missing_primary_key') {
              console.log(chalk.yellow('✓ Add primary keys to tables that are missing them'));
              console.log('  This improves performance and ensures data integrity');
              console.log('  Example: ALTER TABLE table_name ADD PRIMARY KEY (id);');
            } else if (issue.type === 'nullable_foreign_keys') {
              console.log(chalk.yellow('✓ Consider making foreign keys NOT NULL'));
              console.log('  This prevents orphaned relationships and referential integrity issues');
              console.log('  Example: ALTER TABLE table_name ALTER COLUMN column_name SET NOT NULL;');
            } else if (issue.type === 'missing_indexes') {
              console.log(chalk.yellow('✓ Add indexes to tables for commonly queried columns'));
              console.log('  This improves query performance, especially for large tables');
              console.log('  Example: CREATE INDEX idx_table_column ON table_name(column_name);');
            }
          });
        }
      }
      
      await commandTrackingService.completeTracking(trackingId, {
        recordsAffected: healthAnalysis.issues.length,
        summary: `Completed schema health check with ${healthAnalysis.issues.length} issues found`
      });
    } catch (error) {
      console.error(chalk.red('Error analyzing schema health:'), error);
      
      await commandTrackingService.failTracking(
        trackingId,
        `Failed to analyze schema health: ${error instanceof Error ? error.message : String(error)}`
      );
      
      process.exit(1);
    }
  });

// Helper function has been moved to the FormatterService

export default program;