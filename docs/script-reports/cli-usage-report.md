# CLI Command Usage Report

*Generated on 4/28/2025 at 11:06:52 AM*

## Database CLI: Output Display Issue Fixed

We identified and fixed an issue with the database CLI pipeline tools like `table-records` not displaying output to the terminal. The main issues were:

1. **Database Query Issue**: The database service was attempting to directly query `information_schema.tables` which isn't directly accessible via Supabase's client interface. Fixed by using the `execute_sql` RPC function.

2. **Command Tracking Output Loss**: Output was being lost during the command tracking process. 

The solution was implemented with a special `--simple` flag that:
- Bypasses the complex command tracking infrastructure
- Uses simplified scripts that focus solely on displaying output
- Uses more direct output methods without fancy formatting
- Works reliably in all cases

**Usage Examples**:
```
# List database tables with records
./scripts/cli-pipeline/database/database-cli.sh table-records --simple

# Show empty tables
./scripts/cli-pipeline/database/database-cli.sh empty-tables --simple  

# Test database connection
./scripts/cli-pipeline/database/database-cli.sh connection-test --simple
```

The `--simple` implementation approach is now available for all database CLI commands and guarantees terminal output display.

## Summary

- Total Pipelines: 12 (active in last 30 days)
- Total Commands: 145
- Total Executions: 2472
- Success Rate: 85.4%

## Most Used Commands

| Command | Pipeline | Total Uses | Success Rate | Last Used |
| ------- | -------- | ---------- | ------------ | --------- |
| update-media-document-types | google_sync | 191 | 89.5% | 4/23/2025, 12:50:33 PM |
| check-reprocessing-status | google_sync | 144 | 96.5% | 4/23/2025, 8:34:08 PM |
| sources-google-integrity | google_sync | 108 | 86.1% | 4/23/2025, 8:20:25 PM |
| show-expert-documents | google_sync | 100 | 83.0% | 4/21/2025, 4:24:26 PM |
| list | document_types | 77 | 87.0% | 4/28/2025, 5:47:06 AM |
| list | google_sync | 66 | 98.5% | 4/23/2025, 9:04:56 PM |
| classify-powerpoints | google_sync | 65 | 76.9% | 4/23/2025, 9:04:07 PM |
| needs-reprocessing | google_sync | 65 | 72.3% | 4/23/2025, 8:32:13 PM |
| classify-docs-service | google_sync | 64 | 92.2% | 4/23/2025, 8:59:32 PM |
| list-google-sources | google_sync | 63 | 92.1% | 4/23/2025, 9:04:57 PM |

## Recently Used Commands (Last 30 days)

| Command | Pipeline | Times Used | Last Used |
| ------- | -------- | ---------- | --------- |
| usage-report | all_pipelines | 5 | 4/28/2025, 11:06:51 AM |
| connection-test | database | 4 | 4/28/2025, 11:06:09 AM |
| schema-health | database | 2 | 4/28/2025, 11:05:54 AM |
| table-structure | database | 3 | 4/28/2025, 11:05:39 AM |
| database-functions | database | 2 | 4/28/2025, 11:05:27 AM |
| empty-tables | database | 2 | 4/28/2025, 11:05:13 AM |
| table-records | database | 5 | 4/28/2025, 11:04:59 AM |
| db-health-check | database | 4 | 4/28/2025, 11:04:33 AM |
| classification-rollup | all_pipelines | 8 | 4/28/2025, 10:56:04 AM |
| --help | presentations | 6 | 4/28/2025, 10:55:36 AM |

## Usage by Pipeline

### google_sync

- Commands: 69
- Total Executions: 1644
- Success Rate: 87.0%

#### Most Used Commands

| Command | Total Uses | Success Rate | Avg Duration | Last Used |
| ------- | ---------- | ------------ | ------------ | --------- |
| update-media-document-types | 191 | 89.5% | 3.72s | 4/23/2025, 12:50:33 PM |
| check-reprocessing-status | 144 | 96.5% | 11.80s | 4/23/2025, 8:34:08 PM |
| sources-google-integrity | 108 | 86.1% | 3.80s | 4/23/2025, 8:20:25 PM |
| show-expert-documents | 100 | 83.0% | 52.68s | 4/21/2025, 4:24:26 PM |
| list | 66 | 98.5% | 2.69s | 4/23/2025, 9:04:56 PM |
| classify-powerpoints | 65 | 76.9% | 31.67s | 4/23/2025, 9:04:07 PM |
| needs-reprocessing | 65 | 72.3% | 4.15s | 4/23/2025, 8:32:13 PM |
| classify-docs-service | 64 | 92.2% | 76.40s | 4/23/2025, 8:59:32 PM |
| list-google-sources | 63 | 92.1% | 1.79s | 4/23/2025, 9:04:57 PM |
| reclassify-docs | 61 | 96.7% | 3.81s | 4/23/2025, 8:34:07 PM |

### document_types

- Commands: 10
- Total Executions: 242
- Success Rate: 82.6%

#### Most Used Commands

| Command | Total Uses | Success Rate | Avg Duration | Last Used |
| ------- | ---------- | ------------ | ------------ | --------- |
| list | 77 | 87.0% | 1.09s | 4/28/2025, 5:47:06 AM |
| health-check | 43 | 83.7% | 1.75s | 4/28/2025, 10:55:34 AM |
| update | 34 | 85.3% | 1.19s | 4/20/2025, 10:59:00 AM |
| get | 27 | 96.3% | 950ms | 4/20/2025, 10:54:31 AM |
| set-classifier | 26 | 61.5% | 75.56s | 4/20/2025, 10:50:24 AM |
| create | 15 | 60.0% | 1.08s | 4/20/2025, 10:50:07 AM |
| generate | 8 | 62.5% | 9.25s | 4/19/2025, 7:35:35 PM |
| categories | 6 | 100.0% | 1.02s | 4/20/2025, 10:36:23 AM |
| delete | 4 | 100.0% | 1.66s | 4/19/2025, 7:28:03 PM |
| stats | 2 | 100.0% | 1.42s | 4/19/2025, 7:09:24 PM |

### classify

- Commands: 13
- Total Executions: 155
- Success Rate: 76.1%

#### Most Used Commands

| Command | Total Uses | Success Rate | Avg Duration | Last Used |
| ------- | ---------- | ------------ | ------------ | --------- |
| classify-subjects | 59 | 72.9% | 55.49s | 4/27/2025, 11:22:01 AM |
| classify-source | 12 | 75.0% | 8.31s | 4/27/2025, 7:52:39 AM |
| check-mp4-titles | 12 | 100.0% | 1.87s | 4/26/2025, 2:04:30 PM |
| classify-remaining-experts | 11 | 72.7% | 2.91s | 4/27/2025, 3:44:24 PM |
| list-unclassified | 11 | 100.0% | 3.48s | 4/27/2025, 7:50:41 AM |
| debug-classification-status | 11 | 63.6% | 2.07s | 4/26/2025, 5:02:19 PM |
| classify-batch-from-file | 10 | 20.0% | 292.61s | 4/27/2025, 10:15:37 AM |
| extract-titles | 10 | 90.0% | 24.09s | 4/26/2025, 1:56:52 PM |
| write-unclassified-ids | 8 | 100.0% | 2.60s | 4/27/2025, 11:20:24 AM |
| health-check | 6 | 66.7% | 1.42s | 4/27/2025, 4:47:04 PM |

### prompt_service

- Commands: 13
- Total Executions: 117
- Success Rate: 82.1%

#### Most Used Commands

| Command | Total Uses | Success Rate | Avg Duration | Last Used |
| ------- | ---------- | ------------ | ------------ | --------- |
| health-check | 53 | 84.9% | 2.55s | 4/28/2025, 10:55:34 AM |
| add-query | 14 | 64.3% | 1.87s | 4/20/2025, 12:03:15 PM |
| summarize-metadata | 9 | 88.9% | 1.71s | 4/20/2025, 12:04:15 PM |
| load | 8 | 62.5% | 1.70s | 4/26/2025, 10:24:05 AM |
| --help | 8 | 100.0% | 1.77s | 4/26/2025, 10:23:01 AM |
| view-metadata | 8 | 100.0% | 1.65s | 4/20/2025, 12:13:57 PM |
| verify-claude-temperature | 6 | 66.7% | 2.01s | 4/20/2025, 11:14:46 AM |
| clean-metadata | 3 | 66.7% | 2.12s | 4/20/2025, 11:11:07 AM |
| update | 2 | 100.0% | 1.34s | 4/20/2025, 12:13:51 PM |
| list | 2 | 100.0% | 1.76s | 4/20/2025, 11:14:54 AM |

### presentations

- Commands: 9
- Total Executions: 114
- Success Rate: 80.7%

#### Most Used Commands

| Command | Total Uses | Success Rate | Avg Duration | Last Used |
| ------- | ---------- | ------------ | ------------ | --------- |
| health-check | 48 | 87.5% | 2.99s | 4/28/2025, 10:55:34 AM |
| create-presentation-assets | 27 | 85.2% | 12.40s | 4/27/2025, 11:19:06 AM |
| create-presentations-from-mp4 | 17 | 64.7% | 1.84s | 4/26/2025, 5:31:48 PM |
| --help | 6 | 100.0% | N/A | 4/28/2025, 10:55:36 AM |
| update-root-drive-id | 6 | 83.3% | 2.93s | 4/24/2025, 3:16:13 AM |
| review-presentations | 4 | 0.0% | 1.50s | 4/27/2025, 10:50:23 AM |
| create-presentations-assets | 3 | 66.7% | 1.37s | 4/27/2025, 11:15:28 AM |
| compare-presentations-assets | 2 | 100.0% | 1.34s | 4/27/2025, 11:48:54 AM |
| write-unclassified-ids | 1 | 100.0% | 1.43s | 4/27/2025, 11:10:30 AM |

### experts

- Commands: 10
- Total Executions: 59
- Success Rate: 91.5%

#### Most Used Commands

| Command | Total Uses | Success Rate | Avg Duration | Last Used |
| ------- | ---------- | ------------ | ------------ | --------- |
| health-check | 22 | 100.0% | 2.59s | 4/28/2025, 10:55:32 AM |
| add-expert | 15 | 80.0% | 1.02s | 4/21/2025, 5:39:26 PM |
| assign-folder-experts | 7 | 100.0% | 82.13s | 4/21/2025, 5:42:32 PM |
| --help | 6 | 100.0% | 1.04s | 4/21/2025, 5:38:02 PM |
| list-experts | 4 | 100.0% | 1.17s | 4/21/2025, 5:38:44 PM |
| list | 1 | 100.0% | 949ms | 4/21/2025, 5:37:49 PM |
| LIST | 1 | 100.0% | 983ms | 4/21/2025, 5:37:41 PM |
| main | 1 | 100.0% | 995ms | 4/21/2025, 5:23:52 PM |
| --helP | 1 | 0.0% | 1.01s | 4/21/2025, 5:19:33 PM |
| --hellp | 1 | 0.0% | 1.08s | 4/21/2025, 4:49:38 PM |

### all_pipelines

- Commands: 3
- Total Executions: 35
- Success Rate: 94.3%

#### Most Used Commands

| Command | Total Uses | Success Rate | Avg Duration | Last Used |
| ------- | ---------- | ------------ | ------------ | --------- |
| master-health-check | 22 | 100.0% | 8.30s | 4/28/2025, 10:55:28 AM |
| classification-rollup | 8 | 87.5% | 1.82s | 4/28/2025, 10:56:04 AM |
| usage-report | 5 | 80.0% | 1.28s | 4/28/2025, 11:06:51 AM |

### media_processing

- Commands: 5
- Total Executions: 34
- Success Rate: 94.1%

#### Most Used Commands

| Command | Total Uses | Success Rate | Avg Duration | Last Used |
| ------- | ---------- | ------------ | ------------ | --------- |
| health-check | 23 | 95.7% | 2.11s | 4/28/2025, 10:55:32 AM |
| find-missing-sources_google-mp4s | 5 | 100.0% | 1.57s | 4/18/2025, 3:30:09 PM |
| process-local-mp4-files | 3 | 100.0% | 99.88s | 4/18/2025, 6:10:59 PM |
| transcribe | 2 | 50.0% | 144.27s | 4/18/2025, 6:11:02 PM |
| convert | 1 | 100.0% | 3.53s | 4/18/2025, 5:56:21 PM |

### database

- Commands: 7
- Total Executions: 22
- Success Rate: 95.5%

#### Most Used Commands

| Command | Total Uses | Success Rate | Avg Duration | Last Used |
| ------- | ---------- | ------------ | ------------ | --------- |
| table-records | 5 | 80.0% | 1.18s | 4/28/2025, 11:04:59 AM |
| connection-test | 4 | 100.0% | 1.02s | 4/28/2025, 11:06:09 AM |
| db-health-check | 4 | 100.0% | 967ms | 4/28/2025, 11:04:33 AM |
| table-structure | 3 | 100.0% | 944ms | 4/28/2025, 11:05:39 AM |
| schema-health | 2 | 100.0% | 987ms | 4/28/2025, 11:05:54 AM |
| database-functions | 2 | 100.0% | 1.16s | 4/28/2025, 11:05:27 AM |
| empty-tables | 2 | 100.0% | 1.02s | 4/28/2025, 11:05:13 AM |

### document

- Commands: 1
- Total Executions: 22
- Success Rate: 59.1%

#### Most Used Commands

| Command | Total Uses | Success Rate | Avg Duration | Last Used |
| ------- | ---------- | ------------ | ------------ | --------- |
| health-check | 22 | 59.1% | 1.31s | 4/28/2025, 10:55:32 AM |

### scripts

- Commands: 1
- Total Executions: 20
- Success Rate: 65.0%

#### Most Used Commands

| Command | Total Uses | Success Rate | Avg Duration | Last Used |
| ------- | ---------- | ------------ | ------------ | --------- |
| health-check | 20 | 65.0% | 1.34s | 4/28/2025, 10:55:32 AM |

### document_pipeline

- Commands: 4
- Total Executions: 8
- Success Rate: 100.0%

#### Most Used Commands

| Command | Total Uses | Success Rate | Avg Duration | Last Used |
| ------- | ---------- | ------------ | ------------ | --------- |
| health-check | 5 | 100.0% | 1.39s | 4/20/2025, 11:29:18 AM |
| test-google-doc-classification | 1 | 100.0% | 797ms | 4/15/2025, 9:53:39 PM |
| show-untyped | 1 | 100.0% | 973ms | 4/15/2025, 9:53:07 PM |
| --help | 1 | 100.0% | 865ms | 4/15/2025, 9:52:44 PM |

