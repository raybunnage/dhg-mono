# Understanding Batch Processing and File Trees

## Batch Processing

### What Is It?
Batch processing is like sorting mail in batches instead of one letter at a time. Instead of processing files one by one, we handle them in small groups (batches) to:
- Work faster
- Avoid overwhelming systems
- Keep track of progress
- Handle errors better

### The Database Structure

#### 1. Processing Batches Table
```sql
-- This table keeps track of batch jobs
create table processing_batches (
  id uuid primary key,
  status text,           -- 'pending', 'processing', 'completed', 'failed'
  created_at timestamp,
  started_at timestamp,
  completed_at timestamp,
  total_files integer,
  processed_files integer,
  failed_files integer,
  error_messages jsonb
);
```

#### 2. File Processing Status Table
```sql
-- This tracks individual file processing
create table file_processing_status (
  id uuid primary key,
  batch_id uuid references processing_batches(id),
  file_id text,          -- Google Drive file ID
  status text,           -- 'pending', 'processing', 'completed', 'failed'
  error_message text,
  attempts integer,
  created_at timestamp,
  updated_at timestamp
);
```

### How to Implement Batch Processing

1. **Create a Batch**
```typescript
async function createBatch(fileIds: string[]) {
  const { data: batch } = await supabase
    .from('processing_batches')
    .insert({
      status: 'pending',
      created_at: new Date().toISOString(),
      total_files: fileIds.length,
      processed_files: 0,
      failed_files: 0
    })
    .select()
    .single();

  // Create entries for each file
  const fileEntries = fileIds.map(fileId => ({
    batch_id: batch.id,
    file_id: fileId,
    status: 'pending',
    attempts: 0
  }));

  await supabase
    .from('file_processing_status')
    .insert(fileEntries);

  return batch;
}
```

2. **Process a Batch**
```typescript
async function processBatch(batchId: string, batchSize = 10) {
  // Get all pending files for this batch
  const { data: files } = await supabase
    .from('file_processing_status')
    .select('*')
    .eq('batch_id', batchId)
    .eq('status', 'pending');

  // Process in smaller groups
  for (let i = 0; i < files.length; i += batchSize) {
    const batch = files.slice(i, i + batchSize);
    await Promise.all(batch.map(processFile));
    
    // Update progress
    await updateBatchProgress(batchId);
  }
}
```

3. **Track Progress**
```typescript
async function updateBatchProgress(batchId: string) {
  // Get counts
  const { data: counts } = await supabase
    .from('file_processing_status')
    .select('status', { count: 'exact' })
    .eq('batch_id', batchId)
    .group_by('status');

  // Update batch record
  await supabase
    .from('processing_batches')
    .update({
      processed_files: counts.completed || 0,
      failed_files: counts.failed || 0,
      status: isComplete(counts) ? 'completed' : 'processing'
    })
    .eq('id', batchId);
}
```

## File Trees

### What Is a File Tree?
A file tree is like a family tree for your files, showing how folders and files are organized. For example:

```
Root Folder
├── Reports
│   ├── 2024
│   │   ├── Q1
│   │   │   ├── report.pdf
│   │   │   └── data.xlsx
│   │   └── Q2
│   └── 2023
└── Documents
    └── Drafts
```

### Database Structure

#### 1. File Tree Table
```sql
create table file_tree (
  id uuid primary key,
  drive_id text,         -- Google Drive ID
  parent_id uuid,        -- References another row in this table
  name text,
  type text,            -- 'folder' or 'file'
  path text,            -- Full path like 'Reports/2024/Q1'
  metadata jsonb,
  created_at timestamp
);
```

### Building File Trees

1. **Basic Tree Building**
```typescript
interface TreeNode {
  id: string;
  name: string;
  type: 'file' | 'folder';
  children: TreeNode[];
}

async function buildFileTree(folderId: string): Promise<TreeNode> {
  // Get folder contents
  const { files, folders } = await getFilesInFolder(folderId);
  
  // Create node for current folder
  const node: TreeNode = {
    id: folderId,
    name: folderName,
    type: 'folder',
    children: []
  };

  // Add folders first
  for (const folder of folders) {
    node.children.push(await buildFileTree(folder.id));
  }

  // Add files
  node.children.push(...files.map(file => ({
    id: file.id,
    name: file.name,
    type: 'file',
    children: []
  })));

  return node;
}
```

2. **Saving to Database**
```typescript
async function saveTreeToDatabase(node: TreeNode, parentId: string | null = null) {
  // Insert current node
  const { data: savedNode } = await supabase
    .from('file_tree')
    .insert({
      drive_id: node.id,
      parent_id: parentId,
      name: node.name,
      type: node.type,
      path: buildPath(node, parentId)
    })
    .select()
    .single();

  // Recursively save children
  for (const child of node.children) {
    await saveTreeToDatabase(child, savedNode.id);
  }
}
```

3. **Displaying Trees**
```typescript
function FileTreeView({ treeData }: { treeData: TreeNode }) {
  return (
    <div className="pl-4">
      <div className="flex items-center">
        {treeData.type === 'folder' ? '📁' : '📄'} {treeData.name}
      </div>
      {treeData.children.length > 0 && (
        <div className="pl-4 border-l">
          {treeData.children.map(child => (
            <FileTreeView key={child.id} treeData={child} />
          ))}
        </div>
      )}
    </div>
  );
}
```

### Best Practices

1. **Batch Updates**
```typescript
// Update multiple nodes at once
const updates = nodes.map(node => ({
  id: node.id,
  path: node.path,
  metadata: node.metadata
}));

await supabase
  .from('file_tree')
  .upsert(updates);
```

2. **Path Management**
```typescript
function buildPath(node: TreeNode, parentId: string | null): string {
  if (!parentId) return node.name;
  
  const { data: parent } = await supabase
    .from('file_tree')
    .select('path')
    .eq('id', parentId)
    .single();
    
  return `${parent.path}/${node.name}`;
}
```

3. **Error Recovery**
```typescript
async function rebuildTreeFromRoot() {
  // Clear existing tree
  await supabase.from('file_tree').delete().neq('id', 'root');
  
  // Rebuild from root
  const rootFolder = await getFilesInFolder(ROOT_FOLDER_ID);
  await buildFileTree(rootFolder);
}
``` 