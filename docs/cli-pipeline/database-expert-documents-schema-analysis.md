# Database Column Usage Analysis

This document provides an analysis of database columns, showing their usage patterns, data types, and other metadata.

## Column Statistics Overview

| Column Name | Data Type | Usage % | Null % | Distinct Values | Last Updated |
|-------------|-----------|---------|--------|----------------|-------------|
| id | uuid | 100.00% | 0.00% | 711 | - |
| created_at | timestamp with time zone | 100.00% | 0.00% | 522 | - |
| updated_at | timestamp with time zone | 100.00% | 0.00% | 449 | 2025-04-19T20:25:30.698+00:00 |
| source_id | uuid | 100.00% | 0.00% | 676 | - |
| version | integer | 100.00% | 0.00% | 1 | - |
| is_latest | boolean | 100.00% | 0.00% | 1 | - |
| retry_count | integer | 100.00% | 0.00% | 1 | - |
| transcription_complete | boolean | 100.00% | 0.00% | 1 | - |
| summary_complete | boolean | 100.00% | 0.00% | 1 | - |
| diarization_complete | boolean | 100.00% | 0.00% | 1 | - |
| processing_status_updated_at | timestamp with time zone | 100.00% | 0.00% | 15 | - |
| document_type_id | uuid | 99.16% | 0.84% | 23 | - |
| processing_status | text | 80.31% | 19.69% | 3 | - |
| processed_content | jsonb | 78.48% | 21.52% | 557 | - |
| processing_skip_reason | text | 78.48% | 21.52% | 3 | - |
| ai_summary_status | USER-DEFINED | 77.78% | 22.22% | 2 | - |
| raw_content | text | 58.23% | 41.77% | 382 | - |
| classification_confidence | numeric | 43.18% | 56.82% | 7 | - |
| classification_metadata | jsonb | 43.18% | 56.82% | 307 | - |
| processing_completed_at | timestamp with time zone | 29.82% | 70.18% | 212 | - |
| word_count | integer | 28.13% | 71.87% | 185 | - |
| content_type | text | 20.25% | 79.75% | 1 | - |
| processing_started_at | timestamp with time zone | 19.69% | 80.31% | 140 | - |
| last_processed_at | timestamp with time zone | 19.55% | 80.45% | 139 | - |
| whisper_model_used | text | 19.55% | 80.45% | 1 | - |
| batch_id | uuid | 8.58% | 91.42% | 7 | - |
| confidence_score | numeric | 8.58% | 91.42% | 6 | - |
| key_insights | ARRAY | 8.58% | 91.42% | 1 | - |
| language | text | 8.58% | 91.42% | 1 | - |
| status | text | 8.58% | 91.42% | 1 | - |
| topics | ARRAY | 8.58% | 91.42% | 1 | - |
| processed_at | timestamp with time zone | 7.88% | 92.12% | 56 | - |
| processing_stats | jsonb | 6.05% | 93.95% | 42 | - |
| processing_error | text | 2.67% | 97.33% | 11 | - |
| ai_analysis | jsonb | 0.00% | 100.00% | 0 | - |
| ai_processing_details | jsonb | 0.00% | 100.00% | 0 | - |
| error_message | text | 0.00% | 100.00% | 0 | - |
| expert_id | uuid | 0.00% | 100.00% | 0 | - |
| last_error_at | timestamp with time zone | 0.00% | 100.00% | 0 | - |
| last_viewed_at | timestamp with time zone | 0.00% | 100.00% | 0 | - |
| model_used | text | 0.00% | 100.00% | 0 | - |
| previous_version_id | uuid | 0.00% | 100.00% | 0 | - |
| prompt_used | text | 0.00% | 100.00% | 0 | - |
| queued_at | timestamp with time zone | 0.00% | 100.00% | 0 | - |
| structure | jsonb | 0.00% | 100.00% | 0 | - |
| token_count | integer | 0.00% | 100.00% | 0 | - |

## Usage Groups

### Always Used (100%)
- id
- created_at
- updated_at
- source_id
- version
- is_latest
- retry_count
- transcription_complete
- summary_complete
- diarization_complete
- processing_status_updated_at

### Highly Used (>75%)
- document_type_id (99.16%)
- processing_status (80.31%)
- processed_content (78.48%)
- processing_skip_reason (78.48%)
- ai_summary_status (77.78%)

### Moderately Used (25-75%)
- raw_content (58.23%)
- classification_confidence (43.18%)
- classification_metadata (43.18%)
- processing_completed_at (29.82%)
- word_count (28.13%)

### Rarely Used (<25%)
- content_type (20.25%)
- processing_started_at (19.69%)
- last_processed_at (19.55%)
- whisper_model_used (19.55%)
- batch_id (8.58%)
- confidence_score (8.58%)
- key_insights (8.58%)
- language (8.58%)
- status (8.58%)
- topics (8.58%)
- processed_at (7.88%)
- processing_stats (6.05%)
- processing_error (2.67%)

### Never Used (0%)
- ai_analysis
- ai_processing_details
- error_message
- expert_id
- last_error_at
- last_viewed_at
- model_used
- previous_version_id
- prompt_used
- queued_at
- structure
- token_count

## Observations

1. **Core Data**: The essential columns (id, timestamps, source_id) are consistently populated.

2. **Processing Flags**: All boolean flags (transcription_complete, summary_complete, diarization_complete) are consistently set but all have the value "false".

3. **AI Related Columns**: Many AI-related columns (ai_analysis, ai_processing_details, model_used, prompt_used) are completely unused (100% null).

4. **Arrays and JSON**: Several complex data types (ARRAY, jsonb) show low usage rates, suggesting potential underutilization of these features.

5. **Status Information**: The table includes multiple status tracking columns with different usage patterns.

6. **Last Updated**: Only the updated_at column shows a recent update timestamp (2025-04-19).

7. **Distinct Values**: Some columns with high usage have very high distinct value counts (id: 711, source_id: 676), while others have very few (version: 1, is_latest: 1).
