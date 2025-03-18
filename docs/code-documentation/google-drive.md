# Google Drive Utilities

## Overview
These utilities help you work with files stored in Google Drive. They can:
- List files and folders
- Get content from different file types (PDFs, Google Docs, Word docs)
- Navigate through folder structures
- Handle different file formats

## Core Functions

### 1. listDriveFiles
Gets a list of files from a Google Drive folder.

```typescript
async function listDriveFiles(folderId: string, accessToken: string) {
  // Usage
  const files = await listDriveFiles('folder-123', 'your-access-token');
  
  // Returns
  {
    files: [
      {
        id: 'file-123',
        name: 'Report.pdf',
        mimeType: 'application/pdf',
        webViewLink: 'https://drive.google.com/...'
      },
      // ... more files
    ]
  }
}
```

**When to use:**
- Getting initial file list
- Checking what's in a folder
- Before syncing files

### 2. getGoogleDocContent
Extracts text content from Google Docs.

```typescript
async function getGoogleDocContent(fileId: string) {
  // Usage
  const content = await getGoogleDocContent('doc-123');
  
  // Returns plain text content of the document
  "This is the content of the Google Doc..."
}
```

**Features:**
- Preserves basic formatting
- Handles document sections
- Extracts tables and lists

### 3. getPdfContent
Extracts text from PDF files.

```typescript
async function getPdfContent(fileId: string) {
  // Usage
  const content = await getPdfContent('pdf-123');
  
  // Returns
  {
    text: "PDF content...",
    pages: 5,
    metadata: {
      author: "John Doe",
      created: "2024-03-15"
    }
  }
}
```

**Capabilities:**
- Extracts text by page
- Handles scanned PDFs
- Preserves document structure

### 4. listAllDriveFiles
Recursively gets all files from a folder and its subfolders.

```typescript
async function listAllDriveFiles(folderId: string) {
  // Usage
  const allFiles = await listAllDriveFiles('root-folder-123');
  
  // Returns
  {
    files: [
      {
        id: 'file-123',
        name: 'Document.pdf',
        path: 'Reports/2024/Q1/',
        mimeType: 'application/pdf'
      }
      // ... more files with paths
    ],
    folderStructure: {
      'Reports': {
        '2024': {
          'Q1': ['Document.pdf']
        }
      }
    }
  }
}
```

**When to use:**
- Full folder sync
- Building file trees
- Backup operations

### 5. getFilesInFolder
Gets files from a specific folder (non-recursive).

```typescript
async function getFilesInFolder(folderId: string) {
  // Usage
  const folderContents = await getFilesInFolder('folder-123');
  
  // Returns
  {
    files: [...],
    folders: [...],
    count: {
      files: 10,
      folders: 2
    }
  }
}
```

**Features:**
- Separates files and folders
- Includes file counts
- Basic metadata

### 6. getDocxContent
Extracts content from Microsoft Word documents.

```typescript
async function getDocxContent(fileId: string) {
  // Usage
  const content = await getDocxContent('docx-123');
  
  // Returns
  {
    text: "Word document content...",
    sections: [
      { title: "Introduction", content: "..." },
      { title: "Methods", content: "..." }
    ]
  }
}
```

## Common Patterns

### 1. Processing Multiple Files
```typescript
async function processFolder(folderId: string) {
  // Get all files
  const files = await listDriveFiles(folderId);
  
  // Process each file based on type
  for (const file of files) {
    let content;
    switch (file.mimeType) {
      case 'application/pdf':
        content = await getPdfContent(file.id);
        break;
      case 'application/vnd.google-apps.document':
        content = await getGoogleDocContent(file.id);
        break;
      // ... handle other types
    }
    
    // Do something with the content
    await processContent(content);
  }
}
```

### 2. Building File Trees
```typescript
async function buildFileTree(rootFolderId: string) {
  const allFiles = await listAllDriveFiles(rootFolderId);
  
  return {
    name: 'Root',
    children: organizeIntoTree(allFiles)
  };
}
```

## Error Handling

### Common Issues
1. **Access Token Expired**
```typescript
try {
  await listDriveFiles(folderId, accessToken);
} catch (error) {
  if (error.code === 401) {
    // Refresh token and retry
    const newToken = await refreshAccessToken();
    return listDriveFiles(folderId, newToken);
  }
}
```

2. **File Not Found**
```typescript
try {
  await getGoogleDocContent(fileId);
} catch (error) {
  if (error.code === 404) {
    console.error(`File ${fileId} not found`);
    // Handle missing file
  }
}
```

## Best Practices

1. **Batch Processing**
```typescript
// Process files in smaller batches
const batchSize = 10;
const files = await listDriveFiles(folderId);
for (let i = 0; i < files.length; i += batchSize) {
  const batch = files.slice(i, i + batchSize);
  await Promise.all(batch.map(processFile));
}
```

2. **Content Caching**
```typescript
const contentCache = new Map();

async function getCachedContent(fileId: string) {
  if (contentCache.has(fileId)) {
    return contentCache.get(fileId);
  }
  const content = await getGoogleDocContent(fileId);
  contentCache.set(fileId, content);
  return content;
}
```

3. **Progress Tracking**
```typescript
async function processWithProgress(files: any[]) {
  let processed = 0;
  const total = files.length;
  
  for (const file of files) {
    await processFile(file);
    processed++;
    updateProgress(processed / total);
  }
}
```

## Integration Examples

### With UI Components
```typescript
function FileViewer({ folderId }) {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    async function loadFiles() {
      const result = await listDriveFiles(folderId);
      setFiles(result.files);
      setLoading(false);
    }
    loadFiles();
  }, [folderId]);
  
  return (
    <div>
      {loading ? <Spinner /> : <FileList files={files} />}
    </div>
  );
}
``` 