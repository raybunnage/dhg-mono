# Batch Processing System

## Database Schema

### Processing Batches Table

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key for the batch |
| created_at | timestamptz | When the batch was created |
| updated_at | timestamptz | Last time the batch was updated |
| status | text | Current status: 'queued', 'processing', 'completed', 'error' |
| total_files | integer | Number of files in this batch |
| processed_files | integer | Number of files that have been processed |
| error_message | text | Any error message for the batch as a whole |
| completed_at | timestamptz | When the batch completed processing |

### Batch Processing Status View

| Column | Type | Description |
|--------|------|-------------|
| batch_id | uuid | Reference to the processing_batches table |
| batch_created_at | timestamptz | When the batch was created |
| batch_status | text | Current batch status |
| total_files | integer | Number of files in batch |
| total_documents | bigint | Total number of expert_documents records |
| completed_count | bigint | Number of successfully processed documents |
| failed_count | bigint | Number of failed documents |
| in_progress_count | bigint | Number of documents currently processing |
| queued_count | bigint | Number of documents waiting to be processed |
| permanent_failures | bigint | Documents that failed after max retries |
| max_retries | integer | Highest retry count in the batch |
| error_messages | text | Aggregated error messages from all documents |
| latest_error_at | timestamptz | Most recent error timestamp |
| batch_started_at | timestamptz | When first document started processing |
| batch_completed_at | timestamptz | When last document completed |
| processing_hours | numeric | Total processing duration |
| error_rate_percentage | numeric | Percentage of documents that failed |
| computed_status | text | Overall batch status based on document statuses |
| top_error_types | json | Most common error messages |

## Workflow

### 1. Batch Creation
When a user selects files in the FileTree component and clicks "Process Selected":
1. A new record is created in `processing_batches` with status 'queued'
2. Expert document records are created for each file, linked to the batch
3. The UI updates to show the queued status

### 2. Processing Pipeline
The AI processing system (to be implemented) will:
1. Poll for batches with status 'queued'
2. Update batch status to 'processing'
3. Process each document in the batch:
   - Update document status to 'processing'
   - Extract content using AI
   - Update document status to 'completed' or 'failed'
4. Update batch status to 'completed' when all documents are done

### 3. Error Handling
The system includes robust error tracking:
- Individual document failures don't fail the whole batch
- Documents can be retried up to 3 times
- Errors are categorized and tracked for analysis
- The batch view shows error patterns and rates

### 4. Monitoring
The `batch_processing_status` view provides:
- Real-time progress monitoring
- Error analysis and patterns
- Performance metrics
- Batch completion statistics

### Integration Points
The batch processing system is designed to work with:
1. The file selection UI (FileTree component)
2. The upcoming AI processing system
3. The expert document management system
4. Future retry and error handling systems

## Future Enhancements
Planned features include:
- Automatic retry of failed documents
- Priority queuing for certain document types
- Batch size optimization based on performance
- Enhanced error categorization and reporting 