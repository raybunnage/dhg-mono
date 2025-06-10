import { Command } from 'commander';
import { commandTrackingService } from '../../../../../packages/shared/services/tracking-service';

const command = new Command('list-backup-config')
  .description('Show the current backup configuration')
  .action(async () => {
    try {
      await commandTrackingService.trackExecution('database', 'list-backup-config', async () => {
        // Import and run the original list-backup-config logic
        require('./list-backup-config');
      });
    } catch (error) {
      console.error('Error:', error);
      process.exit(1);
    }
  });

export default command;