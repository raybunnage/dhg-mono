import { Command } from 'commander';
import { commandTrackingService } from '../../../../../packages/shared/services/tracking-service';

const command = new Command('add-backup-table')
  .description('Add a table to the backup configuration')
  .argument('<table>', 'Table name to add to backup configuration')
  .action(async (tableName) => {
    try {
      await commandTrackingService.trackExecution('database', 'add-backup-table', async () => {
        // Import and run the original add-backup-table logic
        process.argv = ['node', 'add-backup-table', tableName];
        require('./add-backup-table');
      });
    } catch (error) {
      console.error('Error:', error);
      process.exit(1);
    }
  });

export default command;