# Batch Database Service Migration Example

This example shows how to migrate the google_sync pipeline's sync-files.ts to use the new BatchDatabaseService.

## Before (Custom Batch Implementation)

```typescript
// In sync-files.ts - custom batch insert logic
async function insertNewFiles(files: GoogleDriveFile[], isDryRun: boolean) {
  const BATCH_SIZE = 100;
  let totalInserted = 0;
  
  for (let i = 0; i < files.length; i += BATCH_SIZE) {
    const batch = files.slice(i, i + BATCH_SIZE);
    
    try {
      const { error } = await supabase
        .from('google_sources')
        .insert(batch);
        
      if (error) {
        console.error('Insert error:', error);
        continue;
      }
      
      totalInserted += batch.length;
      console.log(`Inserted ${totalInserted}/${files.length} files...`);
    } catch (error) {
      console.error('Batch insert failed:', error);
    }
  }
  
  return totalInserted;
}
```

## After (Using BatchDatabaseService)

```typescript
// Import the new service
import { batchDatabaseService } from '@shared/services/batch-database-service';

async function insertNewFiles(files: GoogleDriveFile[], isDryRun: boolean) {
  if (isDryRun) {
    console.log(`[DRY RUN] Would insert ${files.length} new files`);
    return files.length;
  }

  console.log(`\n📥 Inserting ${files.length} new files...`);
  
  const result = await batchDatabaseService.batchInsert(
    'google_sources',
    files,
    {
      batchSize: 100,
      onProgress: batchDatabaseService.createConsoleProgress('Inserting files'),
      onError: (error, item, index) => {
        console.error(`\nFailed to insert file ${item.name}: ${error.message}`);
      },
      continueOnError: true,
      retryAttempts: 3
    }
  );

  console.log(`\n✅ Insert complete: ${result.successful} successful, ${result.failed} failed`);
  console.log(`⏱️  Duration: ${result.duration.toFixed(2)}s`);
  
  if (result.errors.length > 0) {
    console.log('\n❌ Failed files:');
    result.errors.slice(0, 5).forEach(({ item, error }) => {
      console.log(`  - ${item.name}: ${error.message}`);
    });
    if (result.errors.length > 5) {
      console.log(`  ... and ${result.errors.length - 5} more`);
    }
  }
  
  return result.successful;
}
```

## Batch Update Example

```typescript
// Before - custom update logic
async function updateExistingFiles(updates: any[]) {
  for (const update of updates) {
    try {
      await supabase
        .from('google_sources')
        .update(update.data)
        .eq('id', update.id);
    } catch (error) {
      console.error('Update failed:', error);
    }
  }
}

// After - using BatchDatabaseService
async function updateExistingFiles(updates: Array<{ id: string; data: any }>) {
  const result = await batchDatabaseService.batchUpdate(
    'google_sources',
    updates,
    {
      batchSize: 50, // Smaller batches for updates
      onProgress: batchDatabaseService.createConsoleProgress('Updating files'),
      continueOnError: true
    }
  );
  
  return result;
}
```

## Batch Delete Example

```typescript
// Before - custom delete logic
async function deleteRemovedFiles(idsToDelete: string[]) {
  const BATCH_SIZE = 100;
  
  for (let i = 0; i < idsToDelete.length; i += BATCH_SIZE) {
    const batch = idsToDelete.slice(i, i + BATCH_SIZE);
    await supabase
      .from('google_sources')
      .delete()
      .in('id', batch);
  }
}

// After - using BatchDatabaseService
async function deleteRemovedFiles(idsToDelete: string[]) {
  const result = await batchDatabaseService.batchDelete(
    'google_sources',
    idsToDelete,
    {
      onProgress: batchDatabaseService.createConsoleProgress('Deleting files')
    }
  );
  
  console.log(`Deleted ${result.successful} files`);
  return result;
}
```

## Benefits

1. **Automatic Retry Logic**: Failed operations are retried with exponential backoff
2. **Progress Tracking**: Real-time progress with rate calculation and ETA
3. **Error Collection**: All errors are collected and can be reviewed
4. **Consistent Interface**: Same patterns work across insert, update, delete, upsert
5. **Performance Optimized**: Configurable batch sizes for different operations

## Advanced Features

### Custom Progress Display

```typescript
// Create custom progress handler
const customProgress = (progress: BatchProgress) => {
  // Update UI, send to logger, etc.
  updateProgressBar(progress.processed / progress.total * 100);
  updateStatusText(`Processing ${progress.processed} of ${progress.total}`);
};

await batchDatabaseService.batchInsert(table, data, {
  onProgress: customProgress
});
```

### Transaction-like Behavior

```typescript
// Stop on first error (transaction-like)
const result = await batchDatabaseService.batchInsert(table, data, {
  continueOnError: false  // Will throw on first error
});
```

### Upsert for Sync Operations

```typescript
// Sync operation - insert or update based on drive_id
const result = await batchDatabaseService.batchUpsert(
  'google_sources',
  filesToSync,
  {
    onConflict: 'drive_id',  // Use drive_id as unique key
    onProgress: batchDatabaseService.createConsoleProgress('Syncing files')
  }
);
```