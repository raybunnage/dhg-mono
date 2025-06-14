#!/usr/bin/env ts-node

import { Command } from 'commander';
import chalk from 'chalk';
import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';

const program = new Command();

program
  .name('list-monitored')
  .description('List all monitored documentation')
  .option('--status <status>', 'Filter by status (active, paused, error)')
  .option('--type <type>', 'Filter by document type')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    const supabase = SupabaseClientService.getInstance().getClient();
    
    try {
      console.log(chalk.blue('📋 Listing monitored documentation...\n'));

      // Build query
      let query = supabase
        .from('doc_continuous_monitoring')
        .select('*')
        .order('area', { ascending: true })
        .order('file_path', { ascending: true });

      // Apply filters
      if (options.status) {
        query = query.eq('status', options.status);
      }
      if (options.type) {
        query = query.eq('area', options.type);
      }

      const { data, error } = await query;

      if (error) {
        console.error(chalk.red('Error fetching documents:'), error);
        process.exit(1);
      }

      if (!data || data.length === 0) {
        console.log(chalk.yellow('No monitored documents found.'));
        return;
      }

      if (options.json) {
        console.log(JSON.stringify(data, null, 2));
        return;
      }

      // Group by area
      const grouped = data.reduce((acc, doc) => {
        if (!acc[doc.area]) acc[doc.area] = [];
        acc[doc.area].push(doc);
        return acc;
      }, {} as Record<string, any[]>);

      // Display grouped results
      Object.entries(grouped).forEach(([type, docs]) => {
        console.log(chalk.cyan(`\n${type.toUpperCase()} (${docs.length})`));
        console.log(chalk.gray('─'.repeat(50)));

        docs.forEach(doc => {
          const statusColor = doc.status === 'active' ? chalk.green : 
                            doc.status === 'paused' ? chalk.yellow : 
                            chalk.red;
          
          console.log(`\n${chalk.bold(doc.file_path.split('/').pop())}`);
          console.log(chalk.gray(`Path: ${doc.file_path}`));
          console.log(chalk.gray(`Status: ${statusColor(doc.status)}`));
          console.log(chalk.gray(`Review frequency: Every ${doc.review_frequency_days || 7} days`));
          console.log(chalk.gray(`Priority: ${doc.priority || 'medium'}`));
          
          if (doc.last_checked) {
            const lastChecked = new Date(doc.last_checked);
            const hoursAgo = Math.floor((Date.now() - lastChecked.getTime()) / (1000 * 60 * 60));
            console.log(chalk.gray(`Last checked: ${hoursAgo} hours ago`));
          } else {
            console.log(chalk.gray(`Last checked: Never`));
          }

          const dependencies = (doc.metadata as any)?.dependencies;
          if (dependencies && dependencies.length > 0) {
            console.log(chalk.gray(`Dependencies: ${dependencies.length} files`));
          }
        });
      });

      // Summary
      console.log(chalk.blue('\n\nSummary:'));
      console.log(chalk.gray(`- Total documents: ${data.length}`));
      console.log(chalk.gray(`- Active: ${data.filter(d => d.status === 'active').length}`));
      console.log(chalk.gray(`- Paused: ${data.filter(d => d.status === 'paused').length}`));
      console.log(chalk.gray(`- Error: ${data.filter(d => d.status === 'error').length}`));

    } catch (error) {
      console.error(chalk.red('Error listing documents:'), error);
      process.exit(1);
    }
  });

program.parse(process.argv);