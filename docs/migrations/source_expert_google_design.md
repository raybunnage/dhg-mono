# Google Source Expert Hybrid Design

## Purpose and Overview

### Current System
Currently, we store all Google Drive files in `sources_google` with basic metadata. When we want to analyze files for expert content, we have no structured way to store the results.

### New Hybrid Approach
We'll create a two-tier system:
1. Basic file tracking (in `sources_google`)
   - All files get basic metadata
   - Quick to index and browse
   - Minimal storage overhead

2. Expert document analysis (in `expert_documents`)
   - Only for files identified as expert content
   - Detailed analysis and AI processing results
   - Links to both the file and relevant expert

## Current Structure
### document_types Table (formerly uni_document_types)
- Primary key: id (uuid)
- Key fields:
  - document_type (text, unique)
  - description (text)
  - mime_type (text)
  - file_extension (text)
  - category (text)
  - is_ai_generated (boolean)
- JSONB fields:
  - content_schema (structure validation)
  - ai_processing_rules (AI processing config)
  - validation_rules (business rules)
- Tracking fields:
  - created_at/updated_at (timestamptz)
  - created_by/updated_by (uuid)

### sources_google Table
- Primary key: id (uuid)
- Unique constraint: drive_id (text)
- Key fields:
  - name (text)
  - mime_type (text)
  - web_view_link (text)
  - parent_folder_id (text)
  - path (text[])
  - metadata (jsonb)
  - last_indexed (timestamptz)
- Document type fields:
  - document_type_id (uuid, references document_types)
  - document_status (text)
  - document_confidence (float)
- Tracking fields:
  - created_at/updated_at (timestamptz)
  - created_by/updated_by (uuid)

### experts Table
- Primary key: id (uuid)
- Unique constraint: expert_name (text)
- Key fields:
  - full_name (text)
  - expertise_area (text)
  - bio (text)
  - experience_years (integer)
  - email_address (text)

## Proposed Changes

### 1. Modify sources_google Table
```sql
-- Add document type relationship and processing fields
ALTER TABLE sources_google
ADD COLUMN document_type_id UUID REFERENCES document_types(id),
ADD COLUMN document_status TEXT DEFAULT 'pending',
ADD COLUMN document_confidence FLOAT,
ADD COLUMN file_size bigint,
ADD COLUMN created_time timestamptz,
ADD COLUMN modified_time timestamptz,
ADD COLUMN is_processed boolean DEFAULT false,
ADD COLUMN processing_status text DEFAULT 'pending';

-- Add index for document type queries
CREATE INDEX idx_sources_google_doc_type 
ON sources_google(document_type_id);

-- Add partial index for unprocessed documents
CREATE INDEX idx_sources_google_unprocessed 
ON sources_google(document_type_id) 
WHERE document_status = 'pending';
```

### 2. Create expert_documents Table
```sql
CREATE TABLE expert_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID REFERENCES sources_google(id),
  expert_id UUID REFERENCES experts(id),
  document_type_id UUID REFERENCES document_types(id),
  content_summary TEXT,
  expertise_areas TEXT[],
  confidence_score FLOAT,
  processed_at TIMESTAMPTZ DEFAULT now(),
  status TEXT DEFAULT 'pending',
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);
```

### 3. Migration Sequence
1. Modify sources_google (20250211HHMMSS_modify_sources_google_for_hybrid)
2. Create expert_documents (20250211HHMMSS_create_expert_documents)
3. Add indexes (20250211HHMMSS_add_expert_document_indexes)

## Implementation Details
### Migration 1: Modify sources_google
- Add missing file metadata fields
- Add processing status tracking
- Preserve existing data and constraints

### Migration 2: Create expert_documents
- Store detailed document analysis
- Link to both sources_google and experts
- Include processing metadata

### Migration 3: Add Indexes
- Add indexes for common queries
- Optimize for performance

### Security Policies
- Inherit RLS policies from sources_google
- Add similar policies to expert_documents

## Development Tools

### Environment Setup
#### Understanding set -a and source
```bash
set -a        # 'allexport' - automatically export all variables
source .env   # Load variables from .env file into shell
set +a        # Turn off automatic export

# This means any program we run (like psql) will see these variables
# It's cleaner than typing them each time
```

### PostgreSQL Connection
#### Connection Options
```bash
# Basic connection
PGPASSWORD="$SUPABASE_DB_PASSWORD" psql -h "db.$SUPABASE_PROJECT_ID.supabase.co" \
  -U postgres -d postgres

# To quit psql:
\q           # Standard quit command
# or Ctrl+D  # Keyboard shortcut

# With SSL mode specified
PGPASSWORD="$SUPABASE_DB_PASSWORD" psql "postgres://postgres:${SUPABASE_DB_PASSWORD}@db.${SUPABASE_PROJECT_ID}.supabase.co:5432/postgres?sslmode=require"
```

### Useful PostgreSQL Commands
#### Table Information
```sql
-- List all tables
\dt

-- Describe table structure
\d table_name

-- List tables with sizes
\dt+

-- Show table schema
\d+ table_name
```

#### Data Inspection
```sql
-- Count rows
SELECT count(*) FROM table_name;

-- Sample data from each table
SELECT * FROM table_name ORDER BY random() LIMIT 5;

-- Find duplicate records
SELECT column_name, count(*)
FROM table_name
GROUP BY column_name
HAVING count(*) > 1;

-- Show recent changes
SELECT * FROM table_name
ORDER BY updated_at DESC
LIMIT 5;
```

#### Schema Analysis
```sql
-- List all indexes
\di

-- Show table dependencies
SELECT DISTINCT
  tc.table_name, tc.constraint_name, 
  tc.constraint_type, kcu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_name = 'table_name';

-- Show table permissions
\z table_name
```

## Migration Strategy

### Phase 1: Enhance sources_google
```sql
-- First migration: Add new columns
ALTER TABLE sources_google
ADD COLUMN file_size bigint,
ADD COLUMN created_time timestamptz,
ADD COLUMN modified_time timestamptz,
ADD COLUMN is_processed boolean DEFAULT false,
ADD COLUMN processing_status text DEFAULT 'pending';
```

### Phase 2: Create Expert Documents
```sql
-- Second migration: New table for expert analysis
CREATE TABLE expert_documents (
  -- Basic identification
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID REFERENCES sources_google(id),
  expert_id UUID REFERENCES experts(id),
  
  -- Document analysis
  document_type_id UUID REFERENCES document_types(id),
  content_summary TEXT,
  expertise_areas TEXT[],
  confidence_score FLOAT,
  
  -- Processing metadata
  processed_at TIMESTAMPTZ DEFAULT now(),
  status TEXT DEFAULT 'pending',
  metadata JSONB,
  
  -- Standard tracking
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);
```

### Phase 3: Add Performance Optimizations
```sql
-- Third migration: Add indexes for common queries
CREATE INDEX idx_expert_docs_source ON expert_documents(source_id);
CREATE INDEX idx_expert_docs_expert ON expert_documents(expert_id);
CREATE INDEX idx_expert_docs_status ON expert_documents(status);
CREATE INDEX idx_expert_docs_type_id ON expert_documents(document_type_id);
```

## Frontend Integration

### File Processing Flow
1. Files are indexed into `sources_google` as before
2. UI shows unprocessed files (where is_processed = false)
3. User can mark files for expert analysis
4. System creates `expert_documents` entries
5. AI processing updates document analysis

### API Endpoints Needed
- GET /api/unprocessed-files
- POST /api/mark-for-processing
- GET /api/expert-documents
- PUT /api/update-analysis

### Security Considerations
- RLS policies ensure users only see their documents
- Processing status helps track progress
- Metadata field allows for flexible additional data

## Synchronization Strategy

### Google Drive Sync Process
1. Periodic Sync
   ```typescript
   // Function runs on schedule or manual trigger
   async function syncGoogleDrive() {
     const lastSyncTime = await getLastSuccessfulSync();
     
     // Get changes from Google Drive
     const changes = await drive.files.list({
       q: `modifiedTime > '${lastSyncTime.toISOString()}'`,
       fields: 'files(id, name, mimeType, size, createdTime, modifiedTime, webViewLink, parents)',
       pageSize: 1000
     });
     
     // Update sources_google table
     for (const file of changes.files) {
       await db.from('sources_google')
         .upsert({
           drive_id: file.id,
           name: file.name,
           mime_type: file.mimeType,
           file_size: file.size,
           created_time: file.createdTime,
           modified_time: file.modifiedTime,
           web_view_link: file.webViewLink,
           parent_folder_id: file.parents?.[0],
           last_indexed: new Date(),
           is_processed: false,  // New files need processing
           processing_status: 'pending'
         }, {
           onConflict: 'drive_id',  // Update if exists
           returning: 'minimal'
         });
     }
   }
   ```

### Tracking Changes
```sql
-- Add last_synced column to track sync status
ALTER TABLE sources_google
ADD COLUMN last_synced_at TIMESTAMPTZ,
ADD COLUMN sync_status TEXT DEFAULT 'pending';

-- Index for efficient sync queries
CREATE INDEX idx_sources_google_sync 
ON sources_google(last_synced_at)
WHERE sync_status = 'pending';
```

### Sync States
- `pending`: New or modified file needs sync
- `syncing`: Currently being processed
- `synced`: Up to date with Google Drive
- `error`: Sync failed, needs attention

### Error Handling
```typescript
async function handleSyncError(fileId: string, error: Error) {
  await db.from('sources_google')
    .update({
      sync_status: 'error',
      metadata: {
        last_error: error.message,
        error_time: new Date().toISOString()
      }
    })
    .match({ drive_id: fileId });

  // Log error for monitoring
  console.error(`Sync failed for file ${fileId}:`, error);
}
```

### Monitoring
```sql
-- Check sync status
SELECT sync_status, count(*)
FROM sources_google
GROUP BY sync_status;

-- Find stuck syncs
SELECT drive_id, name, last_synced_at
FROM sources_google
WHERE sync_status = 'syncing'
AND last_synced_at < now() - interval '1 hour';
```

### Frontend Integration
```typescript
// Button to trigger manual sync
async function triggerSync() {
  const response = await fetch('/api/drive/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  });
  
  if (!response.ok) {
    throw new Error('Sync failed');
  }
  
  return response.json();
}

// Monitor sync progress
function SyncStatus() {
  const { data, error } = useQuery('syncStatus', async () => {
    const { data } = await supabase
      .from('sources_google')
      .select('sync_status')
      .order('last_synced_at', { ascending: false })
      .limit(1);
    return data?.[0];
  });

  return (
    <div>
      <StatusIcon status={data?.sync_status} />
      <LastSyncTime time={data?.last_synced_at} />
    </div>
  );
}
```

## Metadata Field Usage

### sources_google.metadata (JSONB)
The metadata field stores flexible, unstructured data about Google Drive files:

```typescript
interface GoogleFileMetadata {
  // Google Drive specific
  owners?: {
    displayName: string;
    emailAddress: string;
    kind: string;
    me: boolean;
  }[];
  shared?: boolean;
  sharingUser?: {
    displayName: string;
    emailAddress: string;
  };
  capabilities?: {
    canEdit: boolean;
    canShare: boolean;
    canTrash: boolean;
  };
  
  // File properties
  fileExtension?: string;
  fullFileExtension?: string;
  md5Checksum?: string;
  thumbnailLink?: string;
  iconLink?: string;
  
  // Document specific
  documentLanguage?: string;
  pageCount?: number;
  wordCount?: number;
  
  // Sync information
  lastSyncError?: {
    message: string;
    timestamp: string;
    attemptCount: number;
  };
}
```

### Example Metadata
```json
{
  "owners": [{
    "displayName": "John Doe",
    "emailAddress": "john@example.com",
    "kind": "drive#user",
    "me": true
  }],
  "shared": true,
  "capabilities": {
    "canEdit": true,
    "canShare": true
  },
  "fileExtension": "pdf",
  "pageCount": 42,
  "documentLanguage": "en"
}
```

### Populating Metadata
```typescript
async function updateFileMetadata(fileId: string) {
  // Get detailed file metadata from Google Drive
  const response = await drive.files.get({
    fileId,
    fields: '*'  // Request all metadata fields
  });

  // Extract relevant metadata
  const metadata = {
    owners: response.owners,
    shared: response.shared,
    capabilities: response.capabilities,
    fileExtension: response.fileExtension,
    pageCount: response.pageCount,
    // ... other fields
  };

  // Update sources_google
  await db.from('sources_google')
    .update({ 
      metadata,
      last_indexed: new Date()
    })
    .match({ drive_id: fileId });
}
```

### Querying Metadata
```sql
-- Find shared documents
SELECT name, metadata->>'fileExtension' as type
FROM sources_google
WHERE metadata->>'shared' = 'true';

-- Get document statistics
SELECT 
  COUNT(*) as total_docs,
  AVG((metadata->>'pageCount')::int) as avg_pages
FROM sources_google
WHERE metadata->>'pageCount' IS NOT NULL;

-- Find documents with sync errors
SELECT name, metadata->'lastSyncError'->>'message' as error
FROM sources_google
WHERE metadata->'lastSyncError' IS NOT NULL;
```

## JSONB Deep Dive

### JSONB vs JSON
```sql
-- JSONB advantages:
-- 1. Binary format = faster processing
-- 2. Indexable
-- 3. Removes whitespace
-- 4. Removes duplicate keys
```

### JSONB Operators
```sql
-- Access operators
metadata->>'key'          -- Get as text
metadata->'key'          -- Get as json
metadata->'arr'->>0      -- Array access
metadata->'obj'->'key'   -- Nested object

-- Containment
metadata @> '{"shared": true}'  -- Contains
metadata <@ '{"a":1, "b":2}'    -- Contained by
metadata ? 'key'                -- Has key
metadata ?| array['a', 'b']     -- Has any key
metadata ?& array['a', 'b']     -- Has all keys
```

### Best Practices

#### 1. Structure
```typescript
// DO: Flat when possible
const goodMetadata = {
  pageCount: 42,
  language: "en",
  status: "active"
};

// AVOID: Deep nesting
const problematicMetadata = {
  document: {
    properties: {
      page: {
        count: 42
      }
    }
  }
};
```

#### 2. Indexing
```sql
-- Create GIN index for full containment queries
CREATE INDEX idx_metadata ON sources_google 
USING GIN (metadata);

-- Create specific indexes for common queries
CREATE INDEX idx_metadata_shared ON sources_google 
USING btree ((metadata->>'shared'));

-- Partial index for specific conditions
CREATE INDEX idx_metadata_error ON sources_google 
USING btree ((metadata->'lastSyncError'->>'timestamp'))
WHERE metadata->'lastSyncError' IS NOT NULL;
```

#### 3. Performance Considerations
```sql
-- GOOD: Use containment with indexes
SELECT * FROM sources_google
WHERE metadata @> '{"shared": true}';

-- GOOD: Use specific path for frequent queries
SELECT * FROM sources_google
WHERE metadata->>'pageCount' > '100';

-- AVOID: Function calls on JSONB columns
-- BAD: jsonb_pretty(metadata)
-- BAD: jsonb_array_length(metadata->'array')
```

### Common Query Patterns
```sql
-- Search in arrays
SELECT * FROM sources_google
WHERE metadata->'owners'->>'emailAddress' LIKE '%@example.com';

-- Aggregate JSON values
SELECT 
  jsonb_object_agg(name, metadata->'pageCount') as doc_sizes
FROM sources_google
WHERE metadata->>'documentType' = 'pdf';

-- Transform arrays
SELECT 
  name,
  jsonb_array_elements(metadata->'owners') as owner
FROM sources_google;
```

### Maintenance
```sql
-- Find oversized metadata
SELECT id, pg_column_size(metadata) as metadata_size
FROM sources_google
ORDER BY metadata_size DESC
LIMIT 10;

-- Clean null values
UPDATE sources_google
SET metadata = jsonb_strip_nulls(metadata);

-- Remove unused keys
UPDATE sources_google
SET metadata = metadata - 'unused_key';
```

### Monitoring
```sql
-- Check index usage
SELECT 
  schemaname, tablename, indexname, 
  idx_scan, idx_tup_read, idx_tup_fetch
FROM pg_stat_user_indexes
WHERE tablename = 'sources_google'
AND indexname LIKE 'idx_metadata%';

-- Find slow JSONB queries
SELECT query, calls, total_time, rows
FROM pg_stat_statements
WHERE query ILIKE '%metadata%'
ORDER BY total_time DESC;
```

## Document Type Integration

### Relationship with document_types
```sql
-- Create index for document type lookups
CREATE INDEX idx_expert_docs_type_id 
ON expert_documents(document_type_id);

-- Example query to get document details
SELECT 
  ed.*,
  dt.document_type,
  dt.category,
  dt.required_fields
FROM expert_documents ed
JOIN document_types dt ON ed.document_type_id = dt.id;
```

### Document Type Validation
```typescript
async function validateDocumentType(fileId: string, documentTypeId: string) {
  // Get document type requirements
  const { data: docType } = await supabase
    .from('document_types')
    .select('required_fields, mime_type, file_extension')
    .eq('id', documentTypeId)
    .single();

  // Get file metadata
  const { data: file } = await supabase
    .from('sources_google')
    .select('mime_type, metadata')
    .eq('id', fileId)
    .single();

  // Validate mime type matches
  if (docType.mime_type && docType.mime_type !== file.mime_type) {
    throw new Error('File type mismatch');
  }

  // Validate required fields
  if (docType.required_fields) {
    for (const field of docType.required_fields) {
      if (!file.metadata[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }
  }
}
```

## Document Type Fields

### New Fields Overview

#### content_schema (JSONB)
```json
{
  "sections": {
    "header": {
      "required": ["title", "author"],
      "optional": ["date", "version"]
    },
    "body": {
      "required": ["content"],
      "optional": ["abstract", "keywords"]
    },
    "metadata": {
      "required": ["expertiseArea"],
      "optional": ["confidenceScore", "tags"]
    }
  },
  "validations": {
    "title": { "type": "string", "minLength": 5 },
    "expertiseArea": { "type": "array", "minItems": 1 }
  }
}
```

#### ai_processing_rules (JSONB)
```json
{
  "extraction": {
    "priority": ["title", "abstract", "expertise"],
    "confidence_threshold": 0.85,
    "language_models": ["gpt-4", "claude-3"],
    "required_fields": ["expertise_area", "content_summary"]
  },
  "classification": {
    "categories": ["research", "presentation", "report"],
    "multi_label": true,
    "min_confidence": 0.75
  },
  "summarization": {
    "max_length": 500,
    "focus_areas": ["methodology", "findings", "expertise"]
  }
}
```

#### validation_rules (JSONB)
```json
{
  "file": {
    "allowed_types": ["pdf", "docx", "pptx"],
    "max_size_mb": 25,
    "require_text_content": true
  },
  "content": {
    "min_words": 100,
    "required_sections": ["abstract", "body"],
    "forbidden_content": ["confidential", "draft"]
  },
  "metadata": {
    "require_author": true,
    "require_date": true,
    "valid_date_range": {
      "start": "2000-01-01",
      "end": "now"
    }
  }
}
```

### Usage Examples
```typescript
async function validateDocument(file: File, documentTypeId: string) {
  // Get document type rules
  const { data: docType } = await supabase
    .from('document_types')
    .select('content_schema, validation_rules')
    .eq('id', documentTypeId)
    .single();

  // Validate file against rules
  const validation = await validateAgainstSchema(file, docType.content_schema);
  if (!validation.valid) {
    throw new Error(`Document validation failed: ${validation.errors.join(', ')}`);
  }
}

async function processDocumentWithAI(content: string, documentTypeId: string) {
  const { data: docType } = await supabase
    .from('document_types')
    .select('ai_processing_rules')
    .eq('id', documentTypeId)
    .single();

  const rules = docType.ai_processing_rules;
  
  // Apply AI processing based on rules
  const result = await processContent(content, {
    models: rules.extraction.language_models,
    confidenceThreshold: rules.extraction.confidence_threshold,
    requiredFields: rules.extraction.required_fields
  });

  return result;
}
```

### Document Type Processing Flow
```typescript
async function processGoogleFile(fileId: string) {
  // 1. Detect document type
  const { documentTypeId, confidence } = await detectDocumentType(fileId);

  // 2. Update sources_google with type
  await supabase.from('sources_google').update({
    document_type_id: documentTypeId,
    document_confidence: confidence,
    document_status: confidence > 0.85 ? 'identified' : 'review_needed'
  }).match({ id: fileId });

  // 3. If expert content, create expert_document
  const { data: docType } = await supabase
    .from('document_types')
    .select('category, ai_processing_rules')
    .eq('id', documentTypeId)
    .single();

  if (docType.category === 'expert_content') {
    await supabase.from('expert_documents').insert({
      source_id: fileId,
      document_type_id: documentTypeId,
      status: 'pending_processing'
    });
  }
}
```

## Migration Best Practices

### Before Creating New Migrations
```bash
# 1. Check current state
pnpm db:check

# 2. Note the latest migration timestamp from REMOTE
# Example output:
#   REMOTE
#   20250210215603    2025-02-10 21:56:03

# 3. Create new migration with timestamp after latest remote
pnpm supabase migration new your_migration_name

# 4. Verify the new migration files:
ls -la supabase/migrations/
# Should see:
# YYYYMMDDHHMMSS_your_migration_name.sql
# YYYYMMDDHHMMSS_your_migration_name_down.sql

# 5. Check again to ensure clean state
pnpm db:check
```

### Migration File Requirements
1. Timestamp must be:
   - After latest remote migration
   - Current or future date/time
   - Unique across all migrations

2. Each migration needs:
   - Up migration (.sql)
   - Down migration (_down.sql)
   - Same timestamp for both files

### Common Commands
```bash
# Check migration status
pnpm db:check

# Pull/sync with remote database
# Method 1: Using Supabase CLI
pnpm supabase db pull

# Method 2: Using psql directly (more reliable)
set -a
source .env
set +a
PGPASSWORD="$SUPABASE_DB_PASSWORD" psql -h "db.$SUPABASE_PROJECT_ID.supabase.co" \
  -U postgres -d postgres \
  -f supabase/migrations/20250210215603_add_last_synced_column.sql

# Create new migration
pnpm supabase migration new your_migration_name

### Troubleshooting Connection Issues
```bash
# 1. Verify environment variables
set -a
source .env
set +a
echo "Project ID: $SUPABASE_PROJECT_ID"
echo "DB Password: $SUPABASE_DB_PASSWORD"

# 2. Test connection with psql
PGPASSWORD="$SUPABASE_DB_PASSWORD" psql -h "db.$SUPABASE_PROJECT_ID.supabase.co" \
  -U postgres -d postgres

# 3. If needed, use full connection string
PGPASSWORD="$SUPABASE_DB_PASSWORD" psql \
  "postgres://postgres:${SUPABASE_DB_PASSWORD}@db.${SUPABASE_PROJECT_ID}.supabase.co:5432/postgres"
```

### Common Issues Prevention
- Always run `db:check`
- Ensure all remote migrations exist locally
- Fix missing migrations before adding new ones:
  ```bash
  # 1. Pull missing remote migrations
  pnpm supabase db pull

  # 2. Verify complete sequence
  pnpm db:check

  # 3. Then apply new migrations
  pnpm db:migrate
  ```

## Migration Template Usage

### 1. Check Current State First
```bash
# Always check before creating new migrations
pnpm db:check

# Note the latest timestamp (for our example):
# 20250210215603 is latest remote
```

### 2. Use Template with Proper Timestamp
```bash
# Create new migration using timestamp AFTER latest remote
pnpm supabase migration new rename_document_types

# This will create:
# YYYYMMDDHHMMSS_rename_document_types.sql
# YYYYMMDDHHMMSS_rename_document_types_down.sql
```

### 3. Template Features
```sql
-- Migration: {description}
-- Created at: {timestamp}
-- Status: planned
-- Dependencies: List any migrations this depends on

BEGIN;

-- Verify dependencies exist
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM supabase_migrations.schema_migrations 
    WHERE version = '${timestamp}'
  ) THEN
    RAISE EXCEPTION 'Migration already exists';
  END IF;
END $$;

-- Verify preconditions
DO $$ 
BEGIN
  -- Add your checks here
END $$;

-- Backup affected data
CREATE TABLE IF NOT EXISTS backup_${table}_${timestamp} AS 
  SELECT * FROM ${table};

-- Your migration code here

-- Verify changes
DO $$ 
BEGIN
  -- Add verification here
END $$;

COMMIT;
```

### 4. Key Template Features
- Dependency checking
- Precondition verification
- Automatic backups
- Change verification
- Clear documentation
```

### Fixing Migration History
```bash
# When you see "migration history does not match local files":

# 1. First repair any missing migrations
pnpm supabase migration repair --status reverted [missing_version]

# 2. Remove any duplicate local migrations
rm supabase/migrations/[duplicate_timestamp]*

# 3. Repair the history for removed migrations
pnpm supabase migration repair --status applied [duplicate_version]

# 4. Verify the fix worked
pnpm db:check
```

### When missing a remote migration:

1. Get the missing migration content
PGPASSWORD="$SUPABASE_DB_PASSWORD" psql -h "db.$SUPABASE_PROJECT_ID.supabase.co" \
  -U postgres -d postgres \
  -c "SELECT statements, name FROM supabase_migrations.schema_migrations WHERE version = '[version]';"

2. Create the missing file
touch supabase/migrations/[version]_[name].sql

3. Copy the content from statements into the file

4. Verify with db:check
pnpm db:check