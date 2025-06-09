import { Command } from 'commander';
import { commandTrackingService } from '../../../../../packages/shared/services/tracking-service';

const command = new Command('create-backup')
  .description('Create backups of configured tables with today\'s date')
  .option('--dry-run', 'Show what would be backed up without executing')
  .action(async (options) => {
    try {
      await commandTrackingService.trackExecution('database', 'create-backup', async () => {
        // Import and run the original create-backup logic
        require('./create-backup');
      });
    } catch (error) {
      console.error('Error:', error);
      process.exit(1);
    }
  });

export default command;