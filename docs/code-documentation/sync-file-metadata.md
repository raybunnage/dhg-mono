# File Metadata Sync Utility

## What Is It?
The `syncFileMetadata` function is like a librarian that updates the "card catalog" for your Google Drive files. Instead of copying entire files, it just updates information about them like:
- File sizes
- Last modified dates
- Other file details

## Why Do We Need It?
- Faster than full file sync
- Helps show file sizes in the UI
- Keeps track of when files change
- Uses less bandwidth than full sync

## How To Use It

### Basic Usage
```typescript
const accessToken = 'your-google-access-token';
const result = await syncFileMetadata(accessToken);

if (result.success) {
  console.log(`Updated metadata for ${result.updated} files!`);
}
```

### In a React Component
```typescript
function MetadataButton() {
  const [loading, setLoading] = useState(false);
  
  const handleSync = async () => {
    setLoading(true);
    try {
      const accessToken = import.meta.env.VITE_GOOGLE_ACCESS_TOKEN;
      const result = await syncFileMetadata(accessToken);
      
      if (result.success) {
        toast.success(`Updated ${result.updated} files!`);
      }
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <button 
      onClick={handleSync}
      disabled={loading}
    >
      {loading ? 'Updating...' : 'Update File Info'}
    </button>
  );
}
```

## How It Works

1. **Gets List of Files**
   ```typescript
   // First, get all files from your database
   const { data: files } = await supabase
     .from('sources_google')
     .select('drive_id, name, metadata')
     .eq('deleted', false);
   ```

2. **Updates Each File**
   ```typescript
   // For each file:
   const metadata = await fetch(
     `https://www.googleapis.com/drive/v3/files/${fileId}?fields=size,modifiedTime`
   );
   ```

3. **Saves New Information**
   ```typescript
   // Updates the database with new info
   await supabase
     .from('sources_google')
     .update({
       metadata: {
         size: metadata.size,
         modifiedTime: metadata.modifiedTime
       }
     })
     .eq('drive_id', fileId);
   ```

## Progress Updates
The function shows progress as it works:
```typescript
// You'll see toast notifications like:
"Starting metadata sync..."
"Processing: 45% (45/100)"
"Updated metadata for 50 files!"
```

## What You Get Back
```typescript
// The function returns:
{
  success: true,
  updated: 50,    // How many files were updated
  errors: 2       // How many files had problems
}
```

## Common Use Cases

### 1. After File Upload
```typescript
// Update metadata after new files are added
async function afterUpload() {
  await syncFileMetadata(accessToken);
}
```

### 2. Refresh File Sizes
```typescript
// When you need to show current file sizes
<button onClick={() => syncFileMetadata(accessToken)}>
  Refresh File Sizes
</button>
```

### 3. Check for Changes
```typescript
// See if files have been modified
async function checkUpdates() {
  const result = await syncFileMetadata(accessToken);
  if (result.updated > 0) {
    console.log('Files have changed!');
  }
}
```

## Tips for Success

1. **Rate Limiting**
   ```typescript
   // The function already includes delays to avoid hitting Google's limits
   await new Promise(resolve => setTimeout(resolve, 100));
   ```

2. **Error Handling**
   ```typescript
   try {
     await syncFileMetadata(accessToken);
   } catch (error) {
     toast.error('Failed to update file info');
   }
   ```

3. **Progress Display**
   ```typescript
   // The function shows progress automatically
   toast.loading(`Processing: ${progress}%`);
   ```

## Common Issues and Solutions

### "Token Expired"
```typescript
// Make sure to use a fresh token
const newToken = await refreshGoogleToken();
await syncFileMetadata(newToken);
```

### "Network Problems"
```typescript
// Add retry logic
const sync = async (retries = 3) => {
  try {
    await syncFileMetadata(accessToken);
  } catch (error) {
    if (retries > 0) {
      await sync(retries - 1);
    }
  }
};
```

## Related Functions
- `syncGoogleDriveFiles`: Full file sync
- `getFileMetadata`: Get metadata for a single file
- `updateFileMetadata`: Update metadata for a single file

## Best Practices
1. Run after major file changes
2. Show progress to users
3. Handle errors gracefully
4. Don't run too frequently (once per hour is plenty)
5. Use with loading states in your UI 