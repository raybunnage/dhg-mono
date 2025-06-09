import { Command } from 'commander';
import { consistencyCheck } from './consistency-check';
import { commandTrackingService } from '../../../../packages/shared/services/tracking-service';

const command = new Command('consistency-check')
  .description('Check cross-table consistency for naming, types, and constraints')
  .option('--generate-fixes', 'Generate SQL script with recommended fixes')
  .action(async (options) => {
    try {
      await commandTrackingService.trackExecution('database', 'consistency-check', async () => {
        await consistencyCheck(options);
      });
    } catch (error) {
      console.error('Error:', error);
      process.exit(1);
    }
  });

export default command;