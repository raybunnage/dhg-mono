import { Command } from 'commander';
import { functionAudit } from './function-audit';
import { commandTrackingService } from '../../../../packages/shared/services/tracking-service';

const command = new Command('function-audit')
  .description('Analyze database functions and identify unused ones')
  .option('--generate-sql', 'Generate SQL script to remove unused functions')
  .option('--output <file>', 'Output file for generated SQL')
  .action(async (options) => {
    try {
      await commandTrackingService.trackExecution('database', 'function-audit', async () => {
        await functionAudit(options);
      });
    } catch (error) {
      console.error('Error:', error);
      process.exit(1);
    }
  });

export default command;