# Command Tracking Integration Guide

This guide shows how to integrate the command tracking service with your CLI pipelines.

## Setup Instructions

1. Initialize the command tracking table in the database:
   ```bash
   ./scripts/cli-pipeline/tracking/tracking-cli.sh init
   ```

2. Verify the setup by adding a test record:
   ```bash
   ./scripts/cli-pipeline/tracking/tracking-cli.sh test
   ```

3. View command history:
   ```bash
   ./scripts/cli-pipeline/tracking/tracking-cli.sh list
   ```

## Integration Methods

There are two main ways to add tracking to your CLI commands:

### Method 1: Using the Tracking Wrapper (Recommended)

The tracking wrapper provides an easy way to wrap your existing command functions
without modifying them significantly. This is the recommended approach for most commands.

```typescript
// Example in scripts/cli-pipeline/document/cli.ts
import { trackCommandExecution } from '../../../packages/shared/services/tracking-service/cli-tracking-wrapper';

program
  .command('process')
  .description('Process documents')
  .action(async (options) => {
    await trackCommandExecution('document', 'process', async () => {
      // Original command implementation
      const result = await processDocuments(options);
      
      // Return result info for tracking
      return {
        recordsAffected: result.processedCount,
        affectedEntity: 'documents',
        summary: `Processed ${result.processedCount} documents`
      };
    });
  });
```

### Method 2: Direct Service Integration

For more complex commands that need more control over tracking:

```typescript
import { commandTrackingService } from '../../../packages/shared/services/tracking-service/command-tracking-service';

async function syncFolders(options) {
  const startTime = new Date();
  let trackingId;
  
  try {
    // Start tracking
    trackingId = await commandTrackingService.startTracking('google_sync', 'sync-folders');
    
    // Command implementation
    const result = await performSync(options);
    
    // Complete tracking with results
    await commandTrackingService.completeTracking(trackingId, {
      recordsAffected: result.filesCount,
      affectedEntity: 'sources_google',
      summary: `Synced ${result.filesCount} files from ${result.foldersCount} folders`
    });
    
    return result;
  } catch (error) {
    // Track failure
    if (trackingId) {
      await commandTrackingService.failTracking(trackingId, error.message);
    }
    
    throw error;
  }
}
```

### Method 3: Simple One-Call Tracking

For simpler commands that don't need to show progress:

```typescript
import { trackSimpleCommand } from '../../../packages/shared/services/tracking-service/cli-tracking-wrapper';

program
  .command('list')
  .description('List documents')
  .action(async (options) => {
    await trackSimpleCommand('document', 'list', async () => {
      // Original command implementation
      const documents = await listDocuments(options);
      console.log(`Found ${documents.length} documents`);
      return { count: documents.length };
    }, {
      getResultSummary: (result) => ({
        recordsAffected: result.count,
        affectedEntity: 'documents',
        summary: `Listed ${result.count} documents`
      })
    });
  });
```

## Example Implementations

### Example 1: Prompt Service Update Command

```typescript
// In scripts/cli-pipeline/prompt_service/commands/update-prompt.ts
import { trackCommandExecution } from '../../../../packages/shared/services/tracking-service/cli-tracking-wrapper';

export async function updatePromptCommand(promptName: string, filePath: string, options: UpdatePromptOptions): Promise<void> {
  await trackCommandExecution('prompt_service', 'update', async () => {
    // Existing implementation...
    if (options.dryRun) {
      // Dry run implementation...
      return { dryRun: true };
    }
    
    // Use the existing CLI interface to handle the update
    await promptCliInterface.updatePromptFromFile(promptName, filePath);
    
    return { promptName, filePath };
  }, {
    getResultSummary: (result) => ({
      recordsAffected: 1,
      affectedEntity: 'prompts',
      summary: result.dryRun 
        ? `Dry run for updating prompt "${promptName}"`
        : `Updated prompt "${promptName}" from file ${path.basename(filePath)}`
    })
  });
}
```

### Example 2: Google Sync Pipeline

```typescript
// In scripts/cli-pipeline/google_sync/index.ts
import { trackCommandExecution } from '../../../packages/shared/services/tracking-service/cli-tracking-wrapper';

program
  .command('sync')
  .description('Synchronize Google Drive folders')
  .option('-f, --folder <folder_id>', 'Specific folder ID to sync')
  .option('--dry-run', 'Show what would be synced without making changes')
  .action(async (options) => {
    await trackCommandExecution('google_sync', 'sync', async () => {
      // Original implementation...
      const result = await syncGoogleDrive(options);
      
      return {
        recordsAffected: result.totalFiles,
        affectedEntity: 'sources_google',
        summary: `Synced ${result.newFiles} new, ${result.updatedFiles} updated files from ${result.foldersProcessed} folders`
      };
    });
  });
```

## Best Practices

1. **Use pipeline/command naming consistently** - Keep pipeline and command names consistent across your codebase
2. **Include meaningful summaries** - Add context-specific details in the summary
3. **Handle errors properly** - Make sure errors are properly caught and tracked
4. **Don't track sensitive data** - Be careful not to include sensitive information in tracking records
5. **Add tracking last** - Add tracking after your command is working correctly