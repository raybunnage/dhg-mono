# CLI Command Usage Report

*Generated on 5/25/2025 at 8:23:10 AM*

## Summary

- Total Pipelines: 15
- Total Commands: 223
- Total Executions: 4066
- Success Rate: 81.8%

## Most Used Commands

| Command | Pipeline | Total Uses | Success Rate | Last Used |
| ------- | -------- | ---------- | ------------ | --------- |
| update-media-document-types | google_sync | 191 | 89.5% | 4/23/2025, 12:50:33 PM |
| check-reprocessing-status | google_sync | 145 | 95.9% | 5/6/2025, 12:00:49 AM |
| needs-reprocessing | google_sync | 115 | 80.9% | 5/6/2025, 8:19:10 AM |
| list | document_types | 110 | 85.5% | 5/11/2025, 1:11:37 PM |
| list | google_sync | 109 | 97.2% | 5/10/2025, 3:09:25 PM |
| sources-google-integrity | google_sync | 108 | 86.1% | 4/23/2025, 8:20:25 PM |
| list-google-sources | google_sync | 106 | 88.7% | 5/10/2025, 3:09:27 PM |
| show-expert-documents | google_sync | 100 | 83.0% | 4/21/2025, 4:24:26 PM |
| health-check | prompt_service | 97 | 91.8% | 5/6/2025, 11:56:55 AM |
| health-check | document_types | 91 | 92.3% | 5/7/2025, 8:04:11 AM |

## Recently Used Commands (Last 30 days)

| Command | Pipeline | Times Used | Last Used |
| ------- | -------- | ---------- | --------- |
| usage-report | all_pipelines | 2 | 5/25/2025, 8:23:09 AM |
| verify-user-roles | database | 1 | 5/25/2025, 8:13:09 AM |
| migration-run-staged | database | 24 | 5/25/2025, 8:11:20 AM |
| table-records | database | 11 | 5/25/2025, 8:08:31 AM |
| table-structure | database | 2 | 5/25/2025, 8:08:14 AM |
| migration-dry-run | database | 4 | 5/25/2025, 8:07:55 AM |
| migration-validate | database | 5 | 5/25/2025, 8:07:39 AM |
| check-duplicates | google_sync | 14 | 5/25/2025, 7:52:53 AM |
| check-and-create-rls-policies | database | 8 | 5/23/2025, 1:21:56 PM |
| check-rls-policies | database | 14 | 5/23/2025, 1:21:55 PM |

## Usage by Pipeline

### google_sync

- Commands: 92
- Total Executions: 2304
- Success Rate: 83.9%

#### Most Used Commands

| Command | Total Uses | Success Rate | Avg Duration | Last Used |
| ------- | ---------- | ------------ | ------------ | --------- |
| update-media-document-types | 191 | 89.5% | 3.72s | 4/23/2025, 12:50:33 PM |
| check-reprocessing-status | 145 | 95.9% | 11.72s | 5/6/2025, 12:00:49 AM |
| needs-reprocessing | 115 | 80.9% | 2.66s | 5/6/2025, 8:19:10 AM |
| list | 109 | 97.2% | 2.82s | 5/10/2025, 3:09:25 PM |
| sources-google-integrity | 108 | 86.1% | 3.80s | 4/23/2025, 8:20:25 PM |
| list-google-sources | 106 | 88.7% | 1.99s | 5/10/2025, 3:09:27 PM |
| show-expert-documents | 100 | 83.0% | 52.68s | 4/21/2025, 4:24:26 PM |
| list-pipeline-status | 89 | 94.4% | 2.07s | 5/11/2025, 2:46:20 PM |
| classify-docs-service | 73 | 90.4% | 69.17s | 5/6/2025, 12:10:30 AM |
| update-main-video-id | 70 | 44.3% | 3.47s | 5/20/2025, 3:05:52 PM |

### document_types

- Commands: 12
- Total Executions: 416
- Success Rate: 82.9%

#### Most Used Commands

| Command | Total Uses | Success Rate | Avg Duration | Last Used |
| ------- | ---------- | ------------ | ------------ | --------- |
| list | 110 | 85.5% | 1.12s | 5/11/2025, 1:11:37 PM |
| health-check | 91 | 92.3% | 1.56s | 5/7/2025, 8:04:11 AM |
| create | 58 | 65.5% | 1.12s | 5/9/2025, 8:26:12 AM |
| review-and-reclassify | 36 | 75.0% | 245.61s | 5/9/2025, 3:35:20 PM |
| update | 36 | 86.1% | 1.20s | 5/5/2025, 7:35:41 PM |
| get | 33 | 97.0% | 946ms | 5/5/2025, 7:35:47 PM |
| set-classifier | 26 | 61.5% | 75.56s | 4/20/2025, 10:50:24 AM |
| generate | 8 | 62.5% | 9.25s | 4/19/2025, 7:35:35 PM |
| cheatsheet | 6 | 100.0% | 1.24s | 5/8/2025, 5:12:54 PM |
| categories | 6 | 100.0% | 1.02s | 4/20/2025, 10:36:23 AM |

### presentations

- Commands: 23
- Total Executions: 380
- Success Rate: 73.9%

#### Most Used Commands

| Command | Total Uses | Success Rate | Avg Duration | Last Used |
| ------- | ---------- | ------------ | ------------ | --------- |
| health-check | 80 | 65.0% | 2.77s | 5/20/2025, 11:40:33 AM |
| find-missing-presentations | 61 | 80.3% | 54.24s | 5/22/2025, 7:24:56 AM |
| process-mp4-files | 54 | 81.5% | 24.49s | 5/1/2025, 1:01:01 AM |
| review-presentations | 35 | 48.6% | 56.63s | 5/21/2025, 7:20:18 PM |
| create-presentation-assets | 30 | 86.7% | 22.03s | 5/22/2025, 6:53:19 AM |
| create-presentations-from-mp4 | 23 | 73.9% | 1.96s | 5/22/2025, 6:44:50 AM |
| --help | 20 | 45.0% | 875ms | 5/22/2025, 6:45:08 AM |
| generate-summary | 16 | 93.8% | 2.72s | 4/30/2025, 2:29:31 PM |
| check-video-consistency | 10 | 90.0% | 1.72s | 5/21/2025, 10:00:47 AM |
| repair-mismatched-video-ids | 9 | 100.0% | 1.91s | 5/21/2025, 10:34:26 AM |

### prompt_service

- Commands: 16
- Total Executions: 225
- Success Rate: 80.4%

#### Most Used Commands

| Command | Total Uses | Success Rate | Avg Duration | Last Used |
| ------- | ---------- | ------------ | ------------ | --------- |
| health-check | 97 | 91.8% | 2.66s | 5/6/2025, 11:56:55 AM |
| update | 30 | 66.7% | 1.57s | 5/11/2025, 10:06:06 PM |
| load | 23 | 56.5% | 1.63s | 5/11/2025, 10:04:17 PM |
| add-query | 18 | 66.7% | 1.89s | 5/5/2025, 5:44:34 PM |
| view-metadata | 10 | 90.0% | 1.67s | 5/5/2025, 5:34:10 PM |
| --help | 10 | 100.0% | 1.74s | 5/1/2025, 12:34:06 PM |
| summarize-metadata | 9 | 88.9% | 1.71s | 4/20/2025, 12:04:15 PM |
| associate-template | 7 | 100.0% | 2.04s | 5/11/2025, 9:08:50 PM |
| verify-claude-temperature | 6 | 66.7% | 2.01s | 4/20/2025, 11:14:46 AM |
| view | 4 | 50.0% | 1.74s | 5/5/2025, 5:33:29 PM |

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

### database

- Commands: 15
- Total Executions: 120
- Success Rate: 79.2%

#### Most Used Commands

| Command | Total Uses | Success Rate | Avg Duration | Last Used |
| ------- | ---------- | ------------ | ------------ | --------- |
| migration-run-staged | 24 | 54.2% | 1.54s | 5/25/2025, 8:11:20 AM |
| table-records | 24 | 83.3% | 1.20s | 5/25/2025, 8:08:31 AM |
| check-rls-policies | 14 | 64.3% | 1.63s | 5/23/2025, 1:21:55 PM |
| check-and-create-rls-policies | 8 | 100.0% | 408ms | 5/23/2025, 1:21:56 PM |
| migration-test | 7 | 57.1% | 1.48s | 5/23/2025, 9:34:16 AM |
| connection-test | 7 | 100.0% | 1.07s | 5/22/2025, 8:18:47 PM |
| table-structure | 6 | 100.0% | 1.06s | 5/25/2025, 8:08:14 AM |
| database-functions | 6 | 100.0% | 1.08s | 5/23/2025, 9:30:34 AM |
| db-health-check | 6 | 100.0% | 1.03s | 5/22/2025, 8:19:57 PM |
| migration-validate | 5 | 80.0% | 1.39s | 5/25/2025, 8:07:39 AM |

### experts

- Commands: 15
- Total Executions: 116
- Success Rate: 90.5%

#### Most Used Commands

| Command | Total Uses | Success Rate | Avg Duration | Last Used |
| ------- | ---------- | ------------ | ------------ | --------- |
| health-check | 49 | 95.9% | 1.96s | 5/6/2025, 11:56:54 AM |
| add-expert | 15 | 80.0% | 1.02s | 4/21/2025, 5:39:26 PM |
| assign-multiple-experts | 10 | 70.0% | 2013.02s | 5/21/2025, 5:55:12 AM |
| propagate-expert-ids | 8 | 87.5% | 75.81s | 5/1/2025, 1:44:13 PM |
| --help | 8 | 100.0% | 1.08s | 5/1/2025, 12:28:00 PM |
| assign-folder-experts | 7 | 100.0% | 82.13s | 4/21/2025, 5:42:32 PM |
| list-experts | 6 | 100.0% | 1.34s | 5/20/2025, 10:35:37 AM |
| transfer-expert-metadata | 5 | 100.0% | 10.35s | 5/1/2025, 2:14:59 PM |
| list | 2 | 100.0% | 1.15s | 5/20/2025, 10:35:15 AM |
| link-top-level-folders | 1 | 100.0% | 1.63s | 5/20/2025, 11:12:57 AM |

### media_processing

- Commands: 7
- Total Executions: 83
- Success Rate: 95.2%

#### Most Used Commands

| Command | Total Uses | Success Rate | Avg Duration | Last Used |
| ------- | ---------- | ------------ | ------------ | --------- |
| health-check | 47 | 97.9% | 1.88s | 5/7/2025, 8:04:09 AM |
| process-local-mp4-files | 9 | 100.0% | 91.38s | 5/2/2025, 1:54:11 PM |
| extract-video-metadata | 8 | 100.0% | 1.79s | 5/1/2025, 10:01:24 AM |
| transcribe | 7 | 71.4% | 111.89s | 5/2/2025, 1:56:58 PM |
| convert | 5 | 80.0% | 1.98s | 5/2/2025, 1:54:16 PM |
| find-missing-sources_google-mp4s | 5 | 100.0% | 1.57s | 4/18/2025, 3:30:09 PM |
| register-local-mp4-files | 2 | 100.0% | 1.30s | 4/30/2025, 8:15:35 AM |

### drive_filter

- Commands: 8
- Total Executions: 66
- Success Rate: 33.3%

#### Most Used Commands

| Command | Total Uses | Success Rate | Avg Duration | Last Used |
| ------- | ---------- | ------------ | ------------ | --------- |
| create-profile | 27 | 22.2% | 1.17s | 5/3/2025, 3:59:51 AM |
| list-profiles | 16 | 62.5% | 1.13s | 5/4/2025, 11:27:12 AM |
| add-drive | 10 | 20.0% | 1.28s | 5/3/2025, 4:28:12 AM |
| apply-migrations | 4 | 0.0% | 1.01s | 5/3/2025, 4:24:37 AM |
| set-active-profile | 4 | 75.0% | 1.06s | 5/3/2025, 4:09:42 AM |
| list-drives | 3 | 0.0% | 1.04s | 5/3/2025, 11:23:12 AM |
| get-active-profile | 1 | 100.0% | 1.28s | 5/3/2025, 11:18:52 AM |
| health-check | 1 | 0.0% | 924ms | 5/3/2025, 3:44:41 AM |

### all_pipelines

- Commands: 3
- Total Executions: 64
- Success Rate: 90.6%

#### Most Used Commands

| Command | Total Uses | Success Rate | Avg Duration | Last Used |
| ------- | ---------- | ------------ | ------------ | --------- |
| master-health-check | 48 | 91.7% | 7.47s | 5/7/2025, 7:58:58 AM |
| usage-report | 8 | 87.5% | 2.11s | 5/25/2025, 8:23:09 AM |
| classification-rollup | 8 | 87.5% | 1.82s | 4/28/2025, 10:56:04 AM |

### scripts

- Commands: 1
- Total Executions: 44
- Success Rate: 84.1%

#### Most Used Commands

| Command | Total Uses | Success Rate | Avg Duration | Last Used |
| ------- | ---------- | ------------ | ------------ | --------- |
| health-check | 44 | 84.1% | 813ms | 5/7/2025, 8:04:09 AM |

### mime_types

- Commands: 8
- Total Executions: 38
- Success Rate: 65.8%

#### Most Used Commands

| Command | Total Uses | Success Rate | Avg Duration | Last Used |
| ------- | ---------- | ------------ | ------------ | --------- |
| configure-processing-docx | 13 | 38.5% | 1.33s | 5/11/2025, 9:03:30 AM |
| configure-processing | 9 | 66.7% | 624ms | 5/11/2025, 9:04:53 AM |
| sync-mime-types | 6 | 66.7% | 631ms | 5/11/2025, 9:00:42 AM |
| sync | 6 | 100.0% | 1.79s | 5/11/2025, 9:00:41 AM |
| configure-processing-txt | 1 | 100.0% | 1.81s | 5/11/2025, 9:04:52 AM |
| configure-processing-pptx | 1 | 100.0% | 1.62s | 5/11/2025, 9:04:45 AM |
| configure-processing-mp4 | 1 | 100.0% | 1.75s | 5/11/2025, 9:04:38 AM |
| configure-processing-pdf | 1 | 100.0% | 1.92s | 5/11/2025, 9:04:29 AM |

### document

- Commands: 1
- Total Executions: 25
- Success Rate: 64.0%

#### Most Used Commands

| Command | Total Uses | Success Rate | Avg Duration | Last Used |
| ------- | ---------- | ------------ | ------------ | --------- |
| health-check | 25 | 64.0% | 1.20s | 4/30/2025, 9:19:46 PM |

### document_pipeline

- Commands: 8
- Total Executions: 19
- Success Rate: 100.0%

#### Most Used Commands

| Command | Total Uses | Success Rate | Avg Duration | Last Used |
| ------- | ---------- | ------------ | ------------ | --------- |
| health-check | 9 | 100.0% | 1.41s | 5/1/2025, 2:37:12 PM |
| sync | 3 | 100.0% | 1.44s | 5/1/2025, 2:38:47 PM |
| find-new | 2 | 100.0% | 2.46s | 5/1/2025, 2:38:33 PM |
| show-recent | 1 | 100.0% | 879ms | 5/1/2025, 2:40:30 PM |
| all | 1 | 100.0% | 1.26s | 5/1/2025, 2:39:01 PM |
| test-google-doc-classification | 1 | 100.0% | 797ms | 4/15/2025, 9:53:39 PM |
| show-untyped | 1 | 100.0% | 973ms | 4/15/2025, 9:53:07 PM |
| --help | 1 | 100.0% | 865ms | 4/15/2025, 9:52:44 PM |

### maintenance

- Commands: 1
- Total Executions: 11
- Success Rate: 100.0%

#### Most Used Commands

| Command | Total Uses | Success Rate | Avg Duration | Last Used |
| ------- | ---------- | ------------ | ------------ | --------- |
| health-check | 11 | 100.0% | 701ms | 5/11/2025, 1:59:23 PM |

