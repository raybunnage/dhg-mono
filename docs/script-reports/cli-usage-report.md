# CLI Command Usage Report

*Generated on 5/21/2025 at 8:51:08 PM*

## Summary

- Total Pipelines: 15
- Total Commands: 214
- Total Executions: 3943
- Success Rate: 82.0%

## Most Used Commands

| Command | Pipeline | Total Uses | Success Rate | Last Used |
| ------- | -------- | ---------- | ------------ | --------- |
| update-media-document-types | google_sync | 191 | 89.5% | 4/23/2025, 2:50:33 PM |
| check-reprocessing-status | google_sync | 145 | 95.9% | 5/6/2025, 2:00:49 AM |
| needs-reprocessing | google_sync | 115 | 80.9% | 5/6/2025, 10:19:10 AM |
| list | document_types | 110 | 85.5% | 5/11/2025, 3:11:37 PM |
| list | google_sync | 109 | 97.2% | 5/10/2025, 5:09:25 PM |
| sources-google-integrity | google_sync | 108 | 86.1% | 4/23/2025, 10:20:25 PM |
| list-google-sources | google_sync | 106 | 88.7% | 5/10/2025, 5:09:27 PM |
| show-expert-documents | google_sync | 100 | 83.0% | 4/21/2025, 6:24:26 PM |
| health-check | prompt_service | 97 | 91.8% | 5/6/2025, 1:56:55 PM |
| health-check | document_types | 91 | 92.3% | 5/7/2025, 10:04:11 AM |

## Recently Used Commands (Last 30 days)

| Command | Pipeline | Times Used | Last Used |
| ------- | -------- | ---------- | --------- |
| review-presentations | presentations | 22 | 5/21/2025, 8:51:05 PM |
| usage-report | all_pipelines | 1 | 5/21/2025, 8:51:02 PM |
| --help | presentations | 7 | 5/21/2025, 8:01:43 PM |
| find-missing-presentations | presentations | 58 | 5/21/2025, 7:23:59 PM |
| create-one-presentation | presentations | 6 | 5/21/2025, 3:01:13 PM |
| list-presentations | presentations | 1 | 5/21/2025, 2:43:37 PM |
| repair-mismatched-video-ids | presentations | 9 | 5/21/2025, 12:34:26 PM |
| fix-mismatched-videos | presentations | 2 | 5/21/2025, 12:33:11 PM |
| repair-presentations | presentations | 1 | 5/21/2025, 12:27:21 PM |
| check-video-consistency | presentations | 10 | 5/21/2025, 12:00:47 PM |

## Usage by Pipeline

### google_sync

- Commands: 92
- Total Executions: 2290
- Success Rate: 84.0%

#### Most Used Commands

| Command | Total Uses | Success Rate | Avg Duration | Last Used |
| ------- | ---------- | ------------ | ------------ | --------- |
| update-media-document-types | 191 | 89.5% | 3.72s | 4/23/2025, 2:50:33 PM |
| check-reprocessing-status | 145 | 95.9% | 11.72s | 5/6/2025, 2:00:49 AM |
| needs-reprocessing | 115 | 80.9% | 2.66s | 5/6/2025, 10:19:10 AM |
| list | 109 | 97.2% | 2.82s | 5/10/2025, 5:09:25 PM |
| sources-google-integrity | 108 | 86.1% | 3.80s | 4/23/2025, 10:20:25 PM |
| list-google-sources | 106 | 88.7% | 1.99s | 5/10/2025, 5:09:27 PM |
| show-expert-documents | 100 | 83.0% | 52.68s | 4/21/2025, 6:24:26 PM |
| list-pipeline-status | 89 | 94.4% | 2.07s | 5/11/2025, 4:46:20 PM |
| classify-docs-service | 73 | 90.4% | 69.17s | 5/6/2025, 2:10:30 AM |
| update-main-video-id | 70 | 44.3% | 3.47s | 5/20/2025, 5:05:52 PM |

### document_types

- Commands: 12
- Total Executions: 416
- Success Rate: 82.9%

#### Most Used Commands

| Command | Total Uses | Success Rate | Avg Duration | Last Used |
| ------- | ---------- | ------------ | ------------ | --------- |
| list | 110 | 85.5% | 1.12s | 5/11/2025, 3:11:37 PM |
| health-check | 91 | 92.3% | 1.56s | 5/7/2025, 10:04:11 AM |
| create | 58 | 65.5% | 1.12s | 5/9/2025, 10:26:12 AM |
| review-and-reclassify | 36 | 75.0% | 245.61s | 5/9/2025, 5:35:20 PM |
| update | 36 | 86.1% | 1.20s | 5/5/2025, 9:35:41 PM |
| get | 33 | 97.0% | 946ms | 5/5/2025, 9:35:47 PM |
| set-classifier | 26 | 61.5% | 75.56s | 4/20/2025, 12:50:24 PM |
| generate | 8 | 62.5% | 9.25s | 4/19/2025, 9:35:35 PM |
| cheatsheet | 6 | 100.0% | 1.24s | 5/8/2025, 7:12:54 PM |
| categories | 6 | 100.0% | 1.02s | 4/20/2025, 12:36:23 PM |

### presentations

- Commands: 22
- Total Executions: 355
- Success Rate: 73.8%

#### Most Used Commands

| Command | Total Uses | Success Rate | Avg Duration | Last Used |
| ------- | ---------- | ------------ | ------------ | --------- |
| health-check | 80 | 65.0% | 2.77s | 5/20/2025, 1:40:33 PM |
| find-missing-presentations | 58 | 79.3% | 56.80s | 5/21/2025, 7:23:59 PM |
| process-mp4-files | 54 | 81.5% | 24.49s | 5/1/2025, 3:01:01 AM |
| create-presentation-assets | 27 | 85.2% | 12.40s | 4/27/2025, 1:19:06 PM |
| review-presentations | 26 | 46.2% | 17.83s | 5/21/2025, 8:39:17 PM |
| --help | 18 | 50.0% | 937ms | 5/21/2025, 8:01:43 PM |
| create-presentations-from-mp4 | 17 | 64.7% | 1.84s | 4/26/2025, 7:31:48 PM |
| generate-summary | 16 | 93.8% | 2.72s | 4/30/2025, 4:29:31 PM |
| check-video-consistency | 10 | 90.0% | 1.72s | 5/21/2025, 12:00:47 PM |
| repair-mismatched-video-ids | 9 | 100.0% | 1.91s | 5/21/2025, 12:34:26 PM |

### prompt_service

- Commands: 16
- Total Executions: 225
- Success Rate: 80.4%

#### Most Used Commands

| Command | Total Uses | Success Rate | Avg Duration | Last Used |
| ------- | ---------- | ------------ | ------------ | --------- |
| health-check | 97 | 91.8% | 2.66s | 5/6/2025, 1:56:55 PM |
| update | 30 | 66.7% | 1.57s | 5/12/2025, 12:06:06 AM |
| load | 23 | 56.5% | 1.63s | 5/12/2025, 12:04:17 AM |
| add-query | 18 | 66.7% | 1.89s | 5/5/2025, 7:44:34 PM |
| view-metadata | 10 | 90.0% | 1.67s | 5/5/2025, 7:34:10 PM |
| --help | 10 | 100.0% | 1.74s | 5/1/2025, 2:34:06 PM |
| summarize-metadata | 9 | 88.9% | 1.71s | 4/20/2025, 2:04:15 PM |
| associate-template | 7 | 100.0% | 2.04s | 5/11/2025, 11:08:50 PM |
| verify-claude-temperature | 6 | 66.7% | 2.01s | 4/20/2025, 1:14:46 PM |
| view | 4 | 50.0% | 1.74s | 5/5/2025, 7:33:29 PM |

### classify

- Commands: 13
- Total Executions: 155
- Success Rate: 76.1%

#### Most Used Commands

| Command | Total Uses | Success Rate | Avg Duration | Last Used |
| ------- | ---------- | ------------ | ------------ | --------- |
| classify-subjects | 59 | 72.9% | 55.49s | 4/27/2025, 1:22:01 PM |
| classify-source | 12 | 75.0% | 8.31s | 4/27/2025, 9:52:39 AM |
| check-mp4-titles | 12 | 100.0% | 1.87s | 4/26/2025, 4:04:30 PM |
| classify-remaining-experts | 11 | 72.7% | 2.91s | 4/27/2025, 5:44:24 PM |
| list-unclassified | 11 | 100.0% | 3.48s | 4/27/2025, 9:50:41 AM |
| debug-classification-status | 11 | 63.6% | 2.07s | 4/26/2025, 7:02:19 PM |
| classify-batch-from-file | 10 | 20.0% | 292.61s | 4/27/2025, 12:15:37 PM |
| extract-titles | 10 | 90.0% | 24.09s | 4/26/2025, 3:56:52 PM |
| write-unclassified-ids | 8 | 100.0% | 2.60s | 4/27/2025, 1:20:24 PM |
| health-check | 6 | 66.7% | 1.42s | 4/27/2025, 6:47:04 PM |

### experts

- Commands: 15
- Total Executions: 116
- Success Rate: 90.5%

#### Most Used Commands

| Command | Total Uses | Success Rate | Avg Duration | Last Used |
| ------- | ---------- | ------------ | ------------ | --------- |
| health-check | 49 | 95.9% | 1.96s | 5/6/2025, 1:56:54 PM |
| add-expert | 15 | 80.0% | 1.02s | 4/21/2025, 7:39:26 PM |
| assign-multiple-experts | 10 | 70.0% | 2013.02s | 5/21/2025, 7:55:12 AM |
| propagate-expert-ids | 8 | 87.5% | 75.81s | 5/1/2025, 3:44:13 PM |
| --help | 8 | 100.0% | 1.08s | 5/1/2025, 2:28:00 PM |
| assign-folder-experts | 7 | 100.0% | 82.13s | 4/21/2025, 7:42:32 PM |
| list-experts | 6 | 100.0% | 1.34s | 5/20/2025, 12:35:37 PM |
| transfer-expert-metadata | 5 | 100.0% | 10.35s | 5/1/2025, 4:14:59 PM |
| list | 2 | 100.0% | 1.15s | 5/20/2025, 12:35:15 PM |
| link-top-level-folders | 1 | 100.0% | 1.63s | 5/20/2025, 1:12:57 PM |

### media_processing

- Commands: 7
- Total Executions: 83
- Success Rate: 95.2%

#### Most Used Commands

| Command | Total Uses | Success Rate | Avg Duration | Last Used |
| ------- | ---------- | ------------ | ------------ | --------- |
| health-check | 47 | 97.9% | 1.88s | 5/7/2025, 10:04:09 AM |
| process-local-mp4-files | 9 | 100.0% | 91.38s | 5/2/2025, 3:54:11 PM |
| extract-video-metadata | 8 | 100.0% | 1.79s | 5/1/2025, 12:01:24 PM |
| transcribe | 7 | 71.4% | 111.89s | 5/2/2025, 3:56:58 PM |
| convert | 5 | 80.0% | 1.98s | 5/2/2025, 3:54:16 PM |
| find-missing-sources_google-mp4s | 5 | 100.0% | 1.57s | 4/18/2025, 5:30:09 PM |
| register-local-mp4-files | 2 | 100.0% | 1.30s | 4/30/2025, 10:15:35 AM |

### drive_filter

- Commands: 8
- Total Executions: 66
- Success Rate: 33.3%

#### Most Used Commands

| Command | Total Uses | Success Rate | Avg Duration | Last Used |
| ------- | ---------- | ------------ | ------------ | --------- |
| create-profile | 27 | 22.2% | 1.17s | 5/3/2025, 5:59:51 AM |
| list-profiles | 16 | 62.5% | 1.13s | 5/4/2025, 1:27:12 PM |
| add-drive | 10 | 20.0% | 1.28s | 5/3/2025, 6:28:12 AM |
| apply-migrations | 4 | 0.0% | 1.01s | 5/3/2025, 6:24:37 AM |
| set-active-profile | 4 | 75.0% | 1.06s | 5/3/2025, 6:09:42 AM |
| list-drives | 3 | 0.0% | 1.04s | 5/3/2025, 1:23:12 PM |
| get-active-profile | 1 | 100.0% | 1.28s | 5/3/2025, 1:18:52 PM |
| health-check | 1 | 0.0% | 924ms | 5/3/2025, 5:44:41 AM |

### all_pipelines

- Commands: 3
- Total Executions: 63
- Success Rate: 90.5%

#### Most Used Commands

| Command | Total Uses | Success Rate | Avg Duration | Last Used |
| ------- | ---------- | ------------ | ------------ | --------- |
| master-health-check | 48 | 91.7% | 7.47s | 5/7/2025, 9:58:58 AM |
| classification-rollup | 8 | 87.5% | 1.82s | 4/28/2025, 12:56:04 PM |
| usage-report | 7 | 85.7% | 1.31s | 5/21/2025, 8:51:02 PM |

### scripts

- Commands: 1
- Total Executions: 44
- Success Rate: 84.1%

#### Most Used Commands

| Command | Total Uses | Success Rate | Avg Duration | Last Used |
| ------- | ---------- | ------------ | ------------ | --------- |
| health-check | 44 | 84.1% | 813ms | 5/7/2025, 10:04:09 AM |

### mime_types

- Commands: 8
- Total Executions: 38
- Success Rate: 65.8%

#### Most Used Commands

| Command | Total Uses | Success Rate | Avg Duration | Last Used |
| ------- | ---------- | ------------ | ------------ | --------- |
| configure-processing-docx | 13 | 38.5% | 1.33s | 5/11/2025, 11:03:30 AM |
| configure-processing | 9 | 66.7% | 624ms | 5/11/2025, 11:04:53 AM |
| sync-mime-types | 6 | 66.7% | 631ms | 5/11/2025, 11:00:42 AM |
| sync | 6 | 100.0% | 1.79s | 5/11/2025, 11:00:41 AM |
| configure-processing-txt | 1 | 100.0% | 1.81s | 5/11/2025, 11:04:52 AM |
| configure-processing-pptx | 1 | 100.0% | 1.62s | 5/11/2025, 11:04:45 AM |
| configure-processing-mp4 | 1 | 100.0% | 1.75s | 5/11/2025, 11:04:38 AM |
| configure-processing-pdf | 1 | 100.0% | 1.92s | 5/11/2025, 11:04:29 AM |

### database

- Commands: 7
- Total Executions: 37
- Success Rate: 89.2%

#### Most Used Commands

| Command | Total Uses | Success Rate | Avg Duration | Last Used |
| ------- | ---------- | ------------ | ------------ | --------- |
| table-records | 14 | 71.4% | 1.18s | 5/20/2025, 10:40:03 AM |
| empty-tables | 5 | 100.0% | 1.11s | 4/28/2025, 3:43:02 PM |
| database-functions | 4 | 100.0% | 1.06s | 5/1/2025, 6:14:57 PM |
| table-structure | 4 | 100.0% | 935ms | 5/1/2025, 6:13:51 PM |
| connection-test | 4 | 100.0% | 1.02s | 4/28/2025, 1:06:09 PM |
| db-health-check | 4 | 100.0% | 967ms | 4/28/2025, 1:04:33 PM |
| schema-health | 2 | 100.0% | 987ms | 4/28/2025, 1:05:54 PM |

### document

- Commands: 1
- Total Executions: 25
- Success Rate: 64.0%

#### Most Used Commands

| Command | Total Uses | Success Rate | Avg Duration | Last Used |
| ------- | ---------- | ------------ | ------------ | --------- |
| health-check | 25 | 64.0% | 1.20s | 4/30/2025, 11:19:46 PM |

### document_pipeline

- Commands: 8
- Total Executions: 19
- Success Rate: 100.0%

#### Most Used Commands

| Command | Total Uses | Success Rate | Avg Duration | Last Used |
| ------- | ---------- | ------------ | ------------ | --------- |
| health-check | 9 | 100.0% | 1.41s | 5/1/2025, 4:37:12 PM |
| sync | 3 | 100.0% | 1.44s | 5/1/2025, 4:38:47 PM |
| find-new | 2 | 100.0% | 2.46s | 5/1/2025, 4:38:33 PM |
| show-recent | 1 | 100.0% | 879ms | 5/1/2025, 4:40:30 PM |
| all | 1 | 100.0% | 1.26s | 5/1/2025, 4:39:01 PM |
| test-google-doc-classification | 1 | 100.0% | 797ms | 4/15/2025, 11:53:39 PM |
| show-untyped | 1 | 100.0% | 973ms | 4/15/2025, 11:53:07 PM |
| --help | 1 | 100.0% | 865ms | 4/15/2025, 11:52:44 PM |

### maintenance

- Commands: 1
- Total Executions: 11
- Success Rate: 100.0%

#### Most Used Commands

| Command | Total Uses | Success Rate | Avg Duration | Last Used |
| ------- | ---------- | ------------ | ------------ | --------- |
| health-check | 11 | 100.0% | 701ms | 5/11/2025, 3:59:23 PM |

