# Supabase SQL Query Guide for DHG Monorepo

## Overview

This guide provides templates and best practices for writing SQL queries in the DHG monorepo project using Supabase (PostgreSQL). Use this as a reference when creating new queries or modifying existing ones.

## Information to Include for AI-Generated SQL Queries

When requesting SQL queries from AI, include the following information for optimal results:

1. **Table Definitions**
   - Complete table schemas with all column names and data types
   - Primary keys and unique constraints
   - Foreign key relationships between tables
   - Check constraints and default values

2. **Database Objects**
   - **Views**: Any relevant views that simplify complex queries
   - **Functions**: Custom PostgreSQL functions in your project
   - **Triggers**: Trigger functions that maintain data integrity
   - **Indexes**: Existing indexes to consider for query optimization
   - **Enums**: Any custom enum types used in your tables

3. **Business Rules**
   - Soft deletion pattern using `is_deleted` boolean field
   - Any validation rules or data constraints not expressed in the schema
   - Access patterns and common query requirements

4. **Example Data**
   - Sample rows to illustrate the expected data format
   - Expected output format for the query

## DHG Database Structure

The DHG monorepo uses Supabase (PostgreSQL) with the following key tables:

### Core Tables

1. **documentation_files**
   - Tracks markdown files across the repository
   - Used by the markdown viewer component
   - Contains soft delete functionality via `is_deleted` field

2. **document_types**
   - Stores document classification types
   - Used for categorizing uploaded documents

3. **experts**
   - Stores expert profiles extracted from documents
   - Contains metadata about expertise areas

4. **sources_google**
   - Stores metadata about files synced from Google Drive
   - Contains file IDs, names, MIME types, and other Google Drive metadata
   - Used as the source of truth for external documents
   - Critical for the Google Drive synchronization process

5. **expert_documents**
   - Links experts to their source documents
   - Contains processing results and extracted information
   - Stores relationships between processed files and extracted experts
   - Used to track which documents have been processed and their results

### Data Flow Relationships

The system follows this general data flow:

1. Files are synced from Google Drive and recorded in `sources_google`
2. Documents are processed to extract information
3. Extracted experts are stored in the `experts` table
4. Relationships and processing results are recorded in `expert_documents`
5. Document types are assigned through the classification process

### Common Fields

Many tables in our system share these common fields:
- `id`: UUID or SERIAL PRIMARY KEY
- `created_at`: TIMESTAMP WITH TIME ZONE
- `updated_at`: TIMESTAMP WITH TIME ZONE
- `is_deleted`: BOOLEAN (for soft deletion pattern)

### Important Views

Include any relevant views in your query requests:

1. **active_documentation_files**
   - Filters out deleted files
   - Includes additional metadata

2. **document_type_statistics**
   - Provides counts and usage statistics for document types

3. **pending_google_documents**
   - Shows Google Drive files that haven't been processed yet
   - Combines data from `sources_google` and `expert_documents`

### Custom Functions

Include relevant functions in your query requests:

1. **update_timestamp()**
   - Trigger function that updates the `updated_at` field

2. **classify_document(text)**
   - Analyzes document content and returns suggested document types

3. **extract_experts(text)**
   - Extracts expert information from document content

4. **sync_google_drive()**
   - Synchronizes files from Google Drive to the `sources_google` table

## Query Templates for Common Operations

### Fetching Documentation Files

```sql
-- Get all active documentation files
SELECT 
  id, 
  path, 
  filename, 
  last_modified, 
  size
FROM 
  documentation_files
WHERE 
  is_deleted = false
ORDER BY 
  path ASC;

-- Get documentation files by path pattern
SELECT 
  id, 
  path, 
  filename, 
  last_modified, 
  size
FROM 
  documentation_files
WHERE 
  path LIKE 'docs/architecture/%'
  AND is_deleted = false
ORDER BY 
  last_modified DESC;
```

### Document Types Operations

```sql
-- Get all document types with counts
SELECT 
  dt.id,
  dt.name,
  dt.description,
  COUNT(d.id) AS document_count
FROM 
  document_types dt
LEFT JOIN 
  documents d ON dt.id = d.document_type_id AND d.is_deleted = false
WHERE 
  dt.is_deleted = false
GROUP BY 
  dt.id, dt.name, dt.description
ORDER BY 
  dt.name ASC;
```

### Experts Queries

```sql
-- Get experts with their areas of expertise
SELECT 
  e.id,
  e.name,
  e.title,
  e.organization,
  e.contact_info,
  e.source_document_id,
  ARRAY_AGG(ea.area) AS expertise_areas
FROM 
  experts e
LEFT JOIN 
  expert_areas ea ON e.id = ea.expert_id
WHERE 
  e.is_deleted = false
GROUP BY 
  e.id, e.name, e.title, e.organization, e.contact_info, e.source_document_id
ORDER BY 
  e.name ASC;
```

### Google Drive Sync Operations

```sql
-- Get unprocessed Google Drive files
SELECT 
  sg.id,
  sg.file_id,
  sg.name,
  sg.mime_type,
  sg.created_time,
  sg.modified_time
FROM 
  sources_google sg
LEFT JOIN 
  expert_documents ed ON sg.id = ed.source_id
WHERE 
  ed.id IS NULL
  AND sg.is_deleted = false
  AND sg.mime_type IN ('application/pdf', 'application/vnd.google-apps.document')
ORDER BY 
  sg.modified_time DESC;

-- Get processed documents with their experts
SELECT 
  sg.name AS document_name,
  sg.file_id AS google_file_id,
  ed.processing_status,
  ed.processed_at,
  COUNT(e.id) AS expert_count
FROM 
  sources_google sg
JOIN 
  expert_documents ed ON sg.id = ed.source_id
LEFT JOIN 
  experts e ON ed.id = e.source_document_id AND e.is_deleted = false
WHERE 
  sg.is_deleted = false
  AND ed.is_deleted = false
GROUP BY 
  sg.name, sg.file_id, ed.processing_status, ed.processed_at
ORDER BY 
  ed.processed_at DESC;
```

## Supabase-Specific Patterns

### RLS (Row Level Security) Considerations

When writing queries, remember that Row Level Security policies may affect results:

```sql
-- Example of a query that respects RLS
SELECT * FROM documents
WHERE user_id = auth.uid() AND is_deleted = false;
```

### Using Supabase Functions

```sql
-- Call a Supabase function
SELECT * FROM classify_document('document_content_here');
```

### Working with JSON Data

```sql
-- Query JSON data (common in Supabase projects)
SELECT 
  id,
  metadata->>'title' AS title,
  metadata->>'author' AS author
FROM 
  documents
WHERE 
  metadata->>'category' = 'technical';
```

### Realtime Subscriptions Considerations

When writing queries for tables with realtime enabled:

```sql
-- Consider adding timestamp filtering for realtime efficiency
SELECT * FROM documentation_files
WHERE updated_at > NOW() - INTERVAL '1 day'
AND is_deleted = false;
```

## Best Practices for DHG Project

1. **Always Include Soft Delete Check**
   ```sql
   WHERE is_deleted = false
   ```

2. **Use Parameterized Queries**
   When using Supabase client:
   ```typescript
   const { data, error } = await supabase
     .from('documentation_files')
     .select('*')
     .eq('is_deleted', false)
     .ilike('path', `%${searchTerm}%`);
   ```

3. **Pagination for Large Result Sets**
   ```sql
   SELECT * FROM documentation_files
   WHERE is_deleted = false
   ORDER BY path ASC
   LIMIT 20 OFFSET 0;
   ```

4. **Use Transactions for Multiple Operations**
   ```sql
   BEGIN;
   -- Update operation 1
   UPDATE documentation_files SET is_deleted = true WHERE id = 'some-id';
   -- Update operation 2
   INSERT INTO audit_logs (action, table_name, record_id) VALUES ('delete', 'documentation_files', 'some-id');
   COMMIT;
   ```

5. **Optimize Queries with Proper Indexes**
   Our common indexes:
   - `documentation_files(path)`
   - `documentation_files(is_deleted, path)`
   - `documents(document_type_id, is_deleted)`
   - `sources_google(file_id)`
   - `expert_documents(source_id, is_deleted)`

6. **Leverage PostgreSQL-Specific Features**
   ```sql
   -- Use DISTINCT ON for getting the latest version of each item
   SELECT DISTINCT ON (document_id) *
   FROM document_versions
   WHERE is_deleted = false
   ORDER BY document_id, version_number DESC;
   ```

## Common Queries for the Docs Page

### Sync Database Operation

The following query pattern is used when syncing the documentation files database with the actual files on disk:

```sql
-- Insert new files
INSERT INTO documentation_files (path, filename, last_modified, size, is_deleted, created_at, updated_at)
VALUES ('docs/example.md', 'example.md', '2025-03-07T17:15:00Z', 1024, false, NOW(), NOW());

-- Update existing files
UPDATE documentation_files
SET 
  path = 'docs/updated.md',
  filename = 'updated.md',
  last_modified = '2025-03-07T18:30:00Z',
  size = 2048,
  is_deleted = false,
  updated_at = NOW()
WHERE id = 'file-id';

-- Mark files as deleted (soft delete)
UPDATE documentation_files
SET 
  is_deleted = true,
  updated_at = NOW()
WHERE id = 'file-id';
```

### Google Drive Sync Operations

The following query patterns are used for Google Drive synchronization:

```sql
-- Insert new Google Drive files
INSERT INTO sources_google (
  file_id, 
  name, 
  mime_type, 
  created_time, 
  modified_time, 
  web_view_link, 
  parents, 
  is_deleted
)
VALUES (
  'google-file-id-123', 
  'Example Document.pdf', 
  'application/pdf', 
  '2025-03-07T17:15:00Z', 
  '2025-03-07T17:15:00Z', 
  'https://drive.google.com/file/d/google-file-id-123/view', 
  '["parent-folder-id"]', 
  false
);

-- Record document processing
INSERT INTO expert_documents (
  source_id,
  document_type_id,
  processing_status,
  processed_at,
  content_extract,
  is_deleted
)
VALUES (
  'source-google-id',
  'document-type-id',
  'completed',
  NOW(),
  'Extracted content from the document...',
  false
);

-- Update processing status
UPDATE expert_documents
SET
  processing_status = 'completed',
  processed_at = NOW(),
  updated_at = NOW()
WHERE
  source_id = 'source-google-id'
  AND is_deleted = false;
```

## Troubleshooting

### Common Issues

1. **Missing Results**
   - Check if RLS policies are affecting your query
   - Verify is_deleted = false is included

2. **Performance Issues**
   - Use EXPLAIN ANALYZE to identify bottlenecks
   - Check if appropriate indexes exist
   - Consider using materialized views for complex aggregations

3. **Timestamp Comparison Issues**
   - Use proper timezone handling: 
     ```sql
     WHERE created_at > (NOW() - INTERVAL '7 days')
     ```

4. **Trigger Side Effects**
   - Be aware of triggers that might modify data:
     ```sql
     -- Our update_timestamp trigger will automatically set updated_at
     UPDATE documentation_files SET path = 'new/path' WHERE id = 'file-id';
     ```

5. **Google Drive Sync Issues**
   - Check for duplicate file_id entries in sources_google
   - Verify expert_documents records have valid source_id references
   - Ensure processing_status is properly updated

### Debugging Queries

When debugging complex queries, use CTEs to break down the logic:

```sql
WITH files_to_process AS (
  SELECT id, path FROM documentation_files WHERE is_deleted = false
),
matched_files AS (
  SELECT id FROM files_to_process WHERE path LIKE 'docs/architecture/%'
)
SELECT * FROM matched_files;
```

## Additional Database Objects to Include in Requests

When requesting SQL queries, include these additional database objects for better results:

1. **Foreign Key Relationships**
   ```
   documents.document_type_id → document_types.id
   experts.source_document_id → documents.id
   expert_documents.source_id → sources_google.id
   expert_documents.document_type_id → document_types.id
   ```

2. **Trigger Functions**
   ```
   update_timestamp() - Updates updated_at field on row changes
   audit_changes() - Logs changes to the audit_log table
   ```

3. **Check Constraints**
   ```
   documents.status IN ('draft', 'published', 'archived')
   expert_documents.processing_status IN ('pending', 'processing', 'completed', 'failed')
   ```

4. **Custom Types**
   ```
   CREATE TYPE document_status AS ENUM ('draft', 'published', 'archived');
   CREATE TYPE processing_status AS ENUM ('pending', 'processing', 'completed', 'failed');
   ```

5. **Materialized Views**
   ```
   document_statistics - Pre-calculated statistics refreshed daily
   expert_document_summary - Summary of processed documents and extracted experts
   ```

6. **Indexes**
   ```
   CREATE INDEX idx_documentation_files_path ON documentation_files(path) WHERE is_deleted = false;
   CREATE INDEX idx_sources_google_file_id ON sources_google(file_id);
   CREATE INDEX idx_expert_documents_source_processing ON expert_documents(source_id, processing_status);
   ```

## Additional Resources

- [Supabase Documentation](https://supabase.com/docs)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- Internal DHG documentation at `docs/architecture/supabase_design/` 