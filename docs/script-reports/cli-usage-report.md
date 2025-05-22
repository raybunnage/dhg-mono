# CLI Command Usage Report

*Generated on 5/21/2025 at 8:51:08 PM*

## Summary

- Total Pipelines: 13
- Total Commands: 155
- Total Executions: 2684
- Success Rate: 85.3%

## Most Used Commands

| Command | Pipeline | Total Uses | Success Rate | Last Used |
| ------- | -------- | ---------- | ------------ | --------- |
| update-media-document-types | google_sync | 191 | 89.5% | 4/23/2025, 12:50:33 PM |
| check-reprocessing-status | google_sync | 144 | 96.5% | 4/23/2025, 8:34:08 PM |
| sources-google-integrity | google_sync | 108 | 86.1% | 4/23/2025, 8:20:25 PM |
| show-expert-documents | google_sync | 100 | 83.0% | 4/21/2025, 4:24:26 PM |
| list | document_types | 84 | 88.1% | 5/1/2025, 10:25:39 AM |
| list | google_sync | 66 | 98.5% | 4/23/2025, 9:04:56 PM |
| classify-powerpoints | google_sync | 65 | 76.9% | 4/23/2025, 9:04:07 PM |
| needs-reprocessing | google_sync | 65 | 72.3% | 4/23/2025, 8:32:13 PM |
| classify-docs-service | google_sync | 64 | 92.2% | 4/23/2025, 8:59:32 PM |
| list-google-sources | google_sync | 63 | 92.1% | 4/23/2025, 9:04:57 PM |

## Recently Used Commands (Last 30 days)

| Command | Pipeline | Times Used | Last Used |
| ------- | -------- | ---------- | --------- |
| usage-report | all_pipelines | 6 | 5/1/2025, 12:24:35 PM |
| sync-and-update-metadata | google_sync | 3 | 5/1/2025, 12:22:10 PM |
| check-deleted-files | google_sync | 4 | 5/1/2025, 12:18:23 PM |
| propagate-expert-ids | experts | 5 | 5/1/2025, 11:22:33 AM |
| --help | experts | 1 | 5/1/2025, 11:22:04 AM |
| list | document_types | 16 | 5/1/2025, 10:25:39 AM |
| extract-video-metadata | media_processing | 8 | 5/1/2025, 10:01:24 AM |
| process-mp4-files | presentations | 54 | 5/1/2025, 1:01:01 AM |
| update | prompt_service | 14 | 4/30/2025, 11:07:10 PM |
| test-process-document | presentations | 7 | 4/30/2025, 10:23:28 PM |

## Usage by Pipeline

### google_sync

- Commands: 71
- Total Executions: 1661
- Success Rate: 86.7%

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
- Total Executions: 255
- Success Rate: 83.5%

#### Most Used Commands

| Command | Total Uses | Success Rate | Avg Duration | Last Used |
| ------- | ---------- | ------------ | ------------ | --------- |
| list | 84 | 88.1% | 1.11s | 5/1/2025, 10:25:39 AM |
| health-check | 49 | 85.7% | 1.74s | 4/30/2025, 9:19:48 PM |
| update | 34 | 85.3% | 1.19s | 4/20/2025, 10:59:00 AM |
| get | 27 | 96.3% | 950ms | 4/20/2025, 10:54:31 AM |
| set-classifier | 26 | 61.5% | 75.56s | 4/20/2025, 10:50:24 AM |
| create | 15 | 60.0% | 1.08s | 4/20/2025, 10:50:07 AM |
| generate | 8 | 62.5% | 9.25s | 4/19/2025, 7:35:35 PM |
| categories | 6 | 100.0% | 1.02s | 4/20/2025, 10:36:23 AM |
| delete | 4 | 100.0% | 1.66s | 4/19/2025, 7:28:03 PM |
| stats | 2 | 100.0% | 1.42s | 4/19/2025, 7:09:24 PM |

### presentations

- Commands: 13
- Total Executions: 210
- Success Rate: 82.4%

#### Most Used Commands

| Command | Total Uses | Success Rate | Avg Duration | Last Used |
| ------- | ---------- | ------------ | ------------ | --------- |
| process-mp4-files | 54 | 81.5% | 24.49s | 5/1/2025, 1:01:01 AM |
| health-check | 54 | 88.9% | 3.15s | 4/30/2025, 9:19:49 PM |
| create-presentation-assets | 27 | 85.2% | 12.40s | 4/27/2025, 11:19:06 AM |
| create-presentations-from-mp4 | 17 | 64.7% | 1.84s | 4/26/2025, 5:31:48 PM |
| generate-summary | 16 | 93.8% | 2.72s | 4/30/2025, 2:29:31 PM |
| --help | 11 | 81.8% | 591ms | 4/30/2025, 9:33:28 PM |
| test-process-document | 7 | 85.7% | 1.57s | 4/30/2025, 10:23:28 PM |
| presentations-cli | 7 | 100.0% | 1.48s | 4/30/2025, 5:41:40 PM |
| update-root-drive-id | 6 | 83.3% | 2.93s | 4/24/2025, 3:16:13 AM |
| review-presentations | 5 | 0.0% | 1.54s | 4/30/2025, 9:58:18 AM |

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
- Total Executions: 139
- Success Rate: 80.6%

#### Most Used Commands

| Command | Total Uses | Success Rate | Avg Duration | Last Used |
| ------- | ---------- | ------------ | ------------ | --------- |
| health-check | 59 | 86.4% | 2.58s | 4/30/2025, 9:19:48 PM |
| update | 16 | 62.5% | 1.58s | 4/30/2025, 11:07:10 PM |
| add-query | 14 | 64.3% | 1.87s | 4/20/2025, 12:03:15 PM |
| view-metadata | 9 | 100.0% | 1.68s | 4/30/2025, 12:35:49 PM |
| --help | 9 | 100.0% | 1.76s | 4/30/2025, 12:17:16 PM |
| summarize-metadata | 9 | 88.9% | 1.71s | 4/20/2025, 12:04:15 PM |
| load | 8 | 62.5% | 1.70s | 4/26/2025, 10:24:05 AM |
| verify-claude-temperature | 6 | 66.7% | 2.01s | 4/20/2025, 11:14:46 AM |
| clean-metadata | 3 | 66.7% | 2.12s | 4/20/2025, 11:11:07 AM |
| list | 2 | 100.0% | 1.76s | 4/20/2025, 11:14:54 AM |

### experts

- Commands: 11
- Total Executions: 68
- Success Rate: 92.6%

#### Most Used Commands

| Command | Total Uses | Success Rate | Avg Duration | Last Used |
| ------- | ---------- | ------------ | ------------ | --------- |
| health-check | 25 | 100.0% | 2.58s | 4/30/2025, 9:19:46 PM |
| add-expert | 15 | 80.0% | 1.02s | 4/21/2025, 5:39:26 PM |
| --help | 7 | 100.0% | 1.07s | 5/1/2025, 11:22:04 AM |
| assign-folder-experts | 7 | 100.0% | 82.13s | 4/21/2025, 5:42:32 PM |
| propagate-expert-ids | 5 | 100.0% | 51.92s | 5/1/2025, 11:22:33 AM |
| list-experts | 4 | 100.0% | 1.17s | 4/21/2025, 5:38:44 PM |
| list | 1 | 100.0% | 949ms | 4/21/2025, 5:37:49 PM |
| LIST | 1 | 100.0% | 983ms | 4/21/2025, 5:37:41 PM |
| main | 1 | 100.0% | 995ms | 4/21/2025, 5:23:52 PM |
| --helP | 1 | 0.0% | 1.01s | 4/21/2025, 5:19:33 PM |

### media_processing

- Commands: 7
- Total Executions: 57
- Success Rate: 93.0%

#### Most Used Commands

| Command | Total Uses | Success Rate | Avg Duration | Last Used |
| ------- | ---------- | ------------ | ------------ | --------- |
| health-check | 26 | 96.2% | 2.10s | 4/30/2025, 9:19:46 PM |
| extract-video-metadata | 8 | 100.0% | 1.79s | 5/1/2025, 10:01:24 AM |
| process-local-mp4-files | 8 | 100.0% | 70.04s | 4/30/2025, 9:01:36 AM |
| transcribe | 5 | 60.0% | 106.12s | 4/30/2025, 9:01:41 AM |
| find-missing-sources_google-mp4s | 5 | 100.0% | 1.57s | 4/18/2025, 3:30:09 PM |
| convert | 3 | 66.7% | 2.10s | 4/30/2025, 9:01:38 AM |
| register-local-mp4-files | 2 | 100.0% | 1.30s | 4/30/2025, 8:15:35 AM |

### all_pipelines

- Commands: 3
- Total Executions: 39
- Success Rate: 94.9%

#### Most Used Commands

| Command | Total Uses | Success Rate | Avg Duration | Last Used |
| ------- | ---------- | ------------ | ------------ | --------- |
| master-health-check | 25 | 100.0% | 8.53s | 4/30/2025, 9:19:42 PM |
| classification-rollup | 8 | 87.5% | 1.82s | 4/28/2025, 10:56:04 AM |
| usage-report | 6 | 83.3% | 1.30s | 5/1/2025, 12:24:35 PM |

### database

- Commands: 7
- Total Executions: 34
- Success Rate: 88.2%

#### Most Used Commands

| Command | Total Uses | Success Rate | Avg Duration | Last Used |
| ------- | ---------- | ------------ | ------------ | --------- |
| table-records | 13 | 69.2% | 1.16s | 4/28/2025, 1:27:17 PM |
| empty-tables | 5 | 100.0% | 1.11s | 4/28/2025, 1:43:02 PM |
| connection-test | 4 | 100.0% | 1.02s | 4/28/2025, 11:06:09 AM |
| db-health-check | 4 | 100.0% | 967ms | 4/28/2025, 11:04:33 AM |
| database-functions | 3 | 100.0% | 1.10s | 4/28/2025, 1:31:37 PM |
| table-structure | 3 | 100.0% | 944ms | 4/28/2025, 11:05:39 AM |
| schema-health | 2 | 100.0% | 987ms | 4/28/2025, 11:05:54 AM |

### document

- Commands: 1
- Total Executions: 25
- Success Rate: 64.0%

#### Most Used Commands

| Command | Total Uses | Success Rate | Avg Duration | Last Used |
| ------- | ---------- | ------------ | ------------ | --------- |
| health-check | 25 | 64.0% | 1.20s | 4/30/2025, 9:19:46 PM |

### scripts

- Commands: 1
- Total Executions: 23
- Success Rate: 69.6%

#### Most Used Commands

| Command | Total Uses | Success Rate | Avg Duration | Last Used |
| ------- | ---------- | ------------ | ------------ | --------- |
| health-check | 23 | 69.6% | 1.21s | 4/30/2025, 9:19:46 PM |

### maintenance

- Commands: 1
- Total Executions: 10
- Success Rate: 100.0%

#### Most Used Commands

| Command | Total Uses | Success Rate | Avg Duration | Last Used |
| ------- | ---------- | ------------ | ------------ | --------- |
| health-check | 10 | 100.0% | 679ms | 4/30/2025, 8:38:36 PM |

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

