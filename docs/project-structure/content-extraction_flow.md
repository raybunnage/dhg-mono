# Content Extraction and Batch Processing Flow

## Database Relationships
```sql
sources_google
  id
  drive_id
  name
  web_view_link
  mime_type
  ...

expert_documents
  id
  source_id      -- References sources_google
  batch_id       -- References processing_batches
  content        -- Extracted document content
  status         -- 'queued', 'processing', 'completed', 'error'
  ...

processing_batches
  id
  status
  total_files
  processed_files
  ...
```

## Process Flow
1. User selects files from sources_google
2. Creates batch and expert_documents records
3. Content extraction happens
4. AI processing uses extracted content

Here's the implementation for a content extraction button:
