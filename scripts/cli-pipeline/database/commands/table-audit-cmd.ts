import { Command } from 'commander';
import { tableAudit } from './table-audit';
import { commandTrackingService } from '../../../../packages/shared/services/tracking-service';

const command = new Command('table-audit')
  .description('Comprehensive table evaluation against best practices')
  .argument('[table]', 'Specific table to audit (audits all if not specified)')
  .action(async (tableName?: string) => {
    try {
      await commandTrackingService.trackExecution('database', 'table-audit', async () => {
        await tableAudit(tableName);
      });
    } catch (error) {
      console.error('Error:', error);
      process.exit(1);
    }
  });

export default command;