# Understanding File Entry Mapping

## What Is fileIds.map?
The `fileIds.map` operation takes an array of file IDs and transforms each one into a detailed object that tracks its processing status. Think of it like creating a tracking slip for each package you're shipping.

## Basic Example

```typescript
// Starting with an array of file IDs
const fileIds = [
  'file-123',
  'file-456',
  'file-789'
];

// Creating tracking entries for each file
const fileEntries = fileIds.map(fileId => ({
  batch_id: 'batch-001',
  file_id: fileId,
  status: 'pending',
  attempts: 0
}));

// Result:
[
  {
    batch_id: 'batch-001',
    file_id: 'file-123',
    status: 'pending',
    attempts: 0
  },
  {
    batch_id: 'batch-001',
    file_id: 'file-456',
    status: 'pending',
    attempts: 0
  },
  {
    batch_id: 'batch-001',
    file_id: 'file-789',
    status: 'pending',
    attempts: 0
  }
]
```

## How It Works

1. **Input**: Array of file IDs
```typescript
const fileIds = ['file-123', 'file-456', 'file-789'];
```

2. **Transformation**: For each ID, create a tracking object
```typescript
fileId => ({              // For each fileId...
  batch_id: batch.id,     // Use the same batch ID for all files
  file_id: fileId,        // Use the current file's ID
  status: 'pending',      // Start with 'pending' status
  attempts: 0             // Start with 0 attempts
})
```

3. **Output**: Array of tracking objects ready for database insert
```typescript
[
  { batch_id: 'abc', file_id: 'file-123', status: 'pending', attempts: 0 },
  { batch_id: 'abc', file_id: 'file-456', status: 'pending', attempts: 0 },
  { batch_id: 'abc', file_id: 'file-789', status: 'pending', attempts: 0 }
]
```

## Real-World Usage

### Creating a New Batch
```typescript
async function startNewBatch(fileIds: string[]) {
  // 1. Create the batch record
  const { data: batch } = await supabase
    .from('processing_batches')
    .insert({
      status: 'pending',
      total_files: fileIds.length
    })
    .select()
    .single();

  // 2. Create tracking entries for each file
  const fileEntries = fileIds.map(fileId => ({
    batch_id: batch.id,
    file_id: fileId,
    status: 'pending',
    attempts: 0,
    created_at: new Date().toISOString()
  }));

  // 3. Insert all file entries at once
  await supabase
    .from('file_processing_status')
    .insert(fileEntries);

  return batch;
}
```

### With Additional Metadata
```typescript
// If you have more info about each file
const fileEntries = fileIds.map(fileId => ({
  batch_id: batch.id,
  file_id: fileId,
  status: 'pending',
  attempts: 0,
  priority: getPriority(fileId),      // Add custom priority
  size: getFileSize(fileId),          // Add file size
  created_by: currentUser.id          // Add user info
}));
```

### With Error Checking
```typescript
const fileEntries = fileIds.map(fileId => {
  // Validate each file ID
  if (!fileId.match(/^file-[0-9]+$/)) {
    throw new Error(`Invalid file ID format: ${fileId}`);
  }

  return {
    batch_id: batch.id,
    file_id: fileId,
    status: 'pending',
    attempts: 0,
    validated: true
  };
});
```

## Common Patterns

### With Progress Tracking
```typescript
let processed = 0;
const total = fileIds.length;

const fileEntries = fileIds.map(fileId => {
  processed++;
  updateProgress(processed / total);

  return {
    batch_id: batch.id,
    file_id: fileId,
    status: 'pending',
    attempts: 0,
    queue_position: processed
  };
});
```

### With Validation
```typescript
const fileEntries = fileIds
  .filter(fileId => isValidFileId(fileId))  // Only valid files
  .map(fileId => ({
    batch_id: batch.id,
    file_id: fileId,
    status: 'pending',
    attempts: 0
  }));
```

### With Priority Assignment
```typescript
const fileEntries = fileIds.map((fileId, index) => ({
  batch_id: batch.id,
  file_id: fileId,
  status: 'pending',
  attempts: 0,
  priority: index < 10 ? 'high' : 'normal'  // First 10 files are high priority
}));
``` 