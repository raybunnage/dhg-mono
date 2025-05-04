# Component: SourceButtons

## Overview
A complex UI component that manages Google Drive file synchronization, document processing, and AI extraction. Provides multiple action buttons for different operations on source files.

## Component Structure

### State Management
```typescript
const [loading, setLoading] = useState(false);
const [files, setFiles] = useState<any[]>([]);
const [progress, setProgress] = useState({ current: 0, total: 0 });
const [searchTerm, setSearchTerm] = useState('');
```

### Helper Functions

1. `sanitizeFileName(name: string)`
```typescript
function sanitizeFileName(name: string): string {
  return name
    .replace(/"/g, '')         // Remove double quotes
    .replace(/\\/g, '/')       // Replace backslashes with forward slashes
    .trim();                   // Remove leading/trailing whitespace
}

// Example usage:
const cleanName = sanitizeFileName('  "My File\\Path".pdf  ');
// Result: 'My File/Path.pdf'
```

2. `sanitizePath(path: string | null)`
```typescript
function sanitizePath(path: string | null): string | null {
  if (!path) return null;
  return path
    .replace(/^\/+|\/+$/g, '') // Remove leading/trailing slashes
    .replace(/\/+/g, '/');     // Normalize internal slashes
}

// Example usage:
const cleanPath = sanitizePath('//folder///subfolder//file.pdf//');
// Result: 'folder/subfolder/file.pdf'
```

## Main Operations

### 1. Google Drive Sync
```typescript
const handleGoogleDriveSync = async () => {
  setLoading(true);
  try {
    const accessToken = import.meta.env.VITE_GOOGLE_ACCESS_TOKEN;
    const folderId = import.meta.env.VITE_GOOGLE_DRIVE_FOLDER_ID;
    
    // Start sync with progress notification
    toast.loading('Syncing with Google Drive...');
    
    const result = await syncGoogleDriveFiles(accessToken, folderId);
    
    if (result.success) {
      // Refresh file list
      const { data: updatedFiles } = await supabase
        .from('sources_google')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (updatedFiles) {
        setFiles(updatedFiles);
      }
      toast.success(result.message);
    }
  } catch (error) {
    toast.error('Sync failed: ' + error.message);
  } finally {
    setLoading(false);
  }
};
```

### 2. Metadata Sync
```typescript
const handleMetadataSync = async () => {
  setLoading(true);
  try {
    const accessToken = import.meta.env.VITE_GOOGLE_ACCESS_TOKEN;
    
    const result = await syncFileMetadata(accessToken);
    if (result.success) {
      // Example of fetching updated files
      const { data: updatedFiles } = await supabase
        .from('sources_google')
        .select(`
          id,
          name,
          metadata,
          drive_id,
          mime_type
        `)
        .order('created_at', { ascending: false });
      
      if (updatedFiles) {
        setFiles(updatedFiles);
      }
    }
  } catch (error) {
    toast.error('Metadata sync failed: ' + error.message);
  } finally {
    setLoading(false);
  }
};
```

### 3. AI Document Processing
```typescript
const handleTestAI = async () => {
  setLoading(true);
  try {
    // Get first unprocessed document
    const { data: doc } = await supabase
      .from('expert_documents')
      .select(`
        id,
        raw_content,
        processing_status,
        source:source_id (
          id,
          drive_id,
          mime_type,
          name
        )
      `)
      .eq('processing_status', 'pending')
      .is('raw_content', null)
      .order('created_at')
      .limit(1)
      .single();

    if (!doc) {
      toast.error('No documents found needing processing');
      return;
    }

    // Extract content based on mime type
    let content: string;
    if (doc.source?.mime_type === 'application/pdf') {
      content = await getPdfContent(doc.source.drive_id);
    } else if (doc.source?.mime_type === 'application/vnd.google-apps.document') {
      content = await getGoogleDocContent(doc.source.drive_id);
    }

    // Update document with content
    await supabase
      .from('expert_documents')
      .update({
        raw_content: content,
        updated_at: new Date().toISOString()
      })
      .eq('id', doc.id);

    // Process with AI
    const profile = await processDocumentWithAI(doc.id);
    toast.success(`Processed profile for ${profile.name}`);
  } catch (error) {
    toast.error('AI processing failed: ' + error.message);
  } finally {
    setLoading(false);
  }
};
```

### Progress Display Implementation
```typescript
// Progress bar component
{loading && progress.total > 0 && (
  <div className="w-full bg-gray-200 rounded-full h-2.5">
    <div 
      className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
      style={{ width: `${(progress.current / progress.total) * 100}%` }}
    />
    <div className="text-sm text-gray-600 mt-1">
      Processing {progress.current} of {progress.total} files
    </div>
  </div>
)}
```

### Search Implementation
```typescript
const handleSearch = async () => {
  if (!searchTerm) return;
  
  const { data: searchResults } = await supabase
    .from('sources_google')
    .select('*')
    .ilike('name', `%${searchTerm}%`)
    .order('created_at', { ascending: false });
    
  if (searchResults) {
    setFiles(searchResults);
  }
};

// Search UI
<div className="flex gap-2">
  <input
    type="text"
    value={searchTerm}
    onChange={(e) => setSearchTerm(e.target.value)}
    placeholder="Search files..."
    className="px-4 py-2 border rounded"
  />
  <button
    onClick={handleSearch}
    disabled={loading || !searchTerm}
    className="px-4 py-2 bg-indigo-500 text-white rounded"
  >
    Search
  </button>
</div>
```

## Integration Points Example

### Complete Component Integration
```typescript
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'react-hot-toast';
import { syncGoogleDriveFiles } from '@/utils/google-drive-sync';
import { syncFileMetadata } from '@/utils/metadata-sync';

export function SourceButtons() {
  // ... state management ...

  useEffect(() => {
    // Initial file load
    loadFiles();
  }, []);

  const loadFiles = async () => {
    const { data } = await supabase
      .from('sources_google')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (data) {
      setFiles(data);
    }
  };

  // ... handler functions ...

  return (
    <div className="space-y-4">
      {/* Button Group */}
      <div className="flex gap-2">
        <button onClick={handleGoogleDriveSync}>
          {loading ? 'Syncing...' : 'Sync Google Drive'}
        </button>
        <button onClick={handleMetadataSync}>
          {loading ? 'Updating Metadata...' : 'Update Metadata'}
        </button>
        <button onClick={handleTestAI}>
          {loading ? 'Processing...' : 'Process Documents'}
        </button>
      </div>

      {/* Progress Bar */}
      {/* Search Interface */}
      {/* File List */}
    </div>
  );
}
```

## Best Practices Implementation Examples

### 1. Loading State Management
```typescript
const handleOperation = async () => {
  setLoading(true);
  try {
    // Operation code
  } catch (error) {
    // Error handling
  } finally {
    setLoading(false);
  }
};
```

### 2. Error Handling
```typescript
const handleError = (error: unknown) => {
  console.error('Operation failed:', error);
  toast.error(
    error instanceof Error 
      ? error.message 
      : 'Operation failed'
  );
};
```

### 3. Progress Tracking
```typescript
const updateProgress = (current: number, total: number) => {
  setProgress({ current, total });
  toast.loading(
    `Processing: ${Math.round((current / total) * 100)}%`
  );
};
``` 