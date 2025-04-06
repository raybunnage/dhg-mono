raybunnage@Rays-Laptop dhg-mono % ./scripts/cli-pipeline/presentations/presentations-cli.sh 
Loading environment variables from /Users/raybunnage/Documents/github/dhg-mono/.env
Loading environment variables from /Users/raybunnage/Documents/github/dhg-mono/.env.local
Loading environment variables from /Users/raybunnage/Documents/github/dhg-mono/.env.development
Usage: presentations-cli [options] [command]

CLI for managing and enhancing presentations and related expert documents

Options:
  -V, --version                           output the version number
  -h, --help                              output usage information

Commands:
  review-presentations [options]          Review the state of presentations and their related expert documents
  generate-summary [options]              Generate AI summary from presentation transcript
  generate-expert-bio [options]           Generate AI expert bio/profile from presentation content
  check-professional-documents [options]  Check for professional documents (CV, bio, announcement) associated with presentations
(node:63984) [DEP0040] DeprecationWarning: The `punycode` module is deprecated. Please use a userland alternative instead.
(Use `node --trace-deprecation ...` to show where the warning was created)
raybunnage@Rays-Laptop dhg-mono % ./scripts/cli-pipeline/presentations/presentations-cli.sh --help 
Loading environment variables from /Users/raybunnage/Documents/github/dhg-mono/.env
Loading environment variables from /Users/raybunnage/Documents/github/dhg-mono/.env.local
Loading environment variables from /Users/raybunnage/Documents/github/dhg-mono/.env.development
Usage: presentations-cli [options] [command]

CLI for managing and enhancing presentations and related expert documents

Options:
  -V, --version                           output the version number
  -h, --help                              output usage information

Commands:
  review-presentations [options]          Review the state of presentations and their related expert documents
  generate-summary [options]              Generate AI summary from presentation transcript
  generate-expert-bio [options]           Generate AI expert bio/profile from presentation content
  check-professional-documents [options]  Check for professional documents (CV, bio, announcement) associated with presentations
raybunnage@Rays-Laptop dhg-mono % ./scripts/cli-pipeline/presentations/presentations-cli.sh -V    
Loading environment variables from /Users/raybunnage/Documents/github/dhg-mono/.env
Loading environment variables from /Users/raybunnage/Documents/github/dhg-mono/.env.local
Loading environment variables from /Users/raybunnage/Documents/github/dhg-mono/.env.development
0.1.0
raybunnage@Rays-Laptop dhg-mono % ./scripts/cli-pipeline/presentations/presentations-cli.sh review-pre
sentations
Loading environment variables from /Users/raybunnage/Documents/github/dhg-mono/.env
Loading environment variables from /Users/raybunnage/Documents/github/dhg-mono/.env.local
Loading environment variables from /Users/raybunnage/Documents/github/dhg-mono/.env.development
2025-04-06T18:37:02.781Z [info]: Reviewing presentations...
Current process.env after loading: [
  'SUPABASE_KEY',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_ANON_KEY',
  'CLI_SUPABASE_URL',
  'CLI_SUPABASE_KEY',
  'SUPABASE_PROJECT_ID',
  'SUPABASE_DB_PASSWORD',
  'SUPABASE_DB_URL'
]
Creating Supabase client with URL: https://jdksnfkupzyw...
(node:64121) [DEP0040] DeprecationWarning: The `punycode` module is deprecated. Please use a userland alternative instead.
(Use `node --trace-deprecation ...` to show where the warning was created)
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/presentations?select=id%2Ctitle%2Cexpert_id%2Ccreated_at%2Cupdated_at%2Cexperts%28name%29&order=created_at.desc&limit=10
2025-04-06T18:37:03.120Z [error]: Error fetching presentations: Could not find a relationship between 'presentations' and 'experts' in the schema cache
2025-04-06T18:37:03.120Z [error]: Error in reviewPresentations: Could not find a relationship between 'presentations' and 'experts' in the schema cache
2025-04-06T18:37:03.120Z [error]: Error reviewing presentations: Could not find a relationship between 'presentations' and 'experts' in the schema cache
raybunnage@Rays-Laptop dhg-mono % ./scripts/cli-pipeline/presentations/presentations-cli.sh review-presentations
Loading environment variables from /Users/raybunnage/Documents/github/dhg-mono/.env
Loading environment variables from /Users/raybunnage/Documents/github/dhg-mono/.env.local
Loading environment variables from /Users/raybunnage/Documents/github/dhg-mono/.env.development
2025-04-06T18:46:17.554Z [info]: Reviewing presentations...
Current process.env after loading: [
  'SUPABASE_KEY',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_ANON_KEY',
  'CLI_SUPABASE_URL',
  'CLI_SUPABASE_KEY',
  'SUPABASE_PROJECT_ID',
  'SUPABASE_DB_PASSWORD',
  'SUPABASE_DB_URL'
]
Creating Supabase client with URL: https://jdksnfkupzyw...
(node:65471) [DEP0040] DeprecationWarning: The `punycode` module is deprecated. Please use a userland alternative instead.
(Use `node --trace-deprecation ...` to show where the warning was created)
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/presentations?select=id%2Ctitle%2Cmain_video_id%2Ccreated_at%2Cupdated_at&order=created_at.desc&limit=10
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/presentation_assets?select=id%2Casset_type%2Ccreated_at&presentation_id=eq.500dc7e5-2c94-49a8-aa0d-df3874746465
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/presentation_assets?select=id%2Casset_type%2Ccreated_at&presentation_id=eq.af9c8913-269e-4c06-8fcb-01d30c618811
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/presentation_assets?select=id%2Casset_type%2Ccreated_at&presentation_id=eq.9bec896a-fdb1-4071-8d69-adc6764627e8
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/presentation_assets?select=id%2Casset_type%2Ccreated_at&presentation_id=eq.70b39370-cbb8-4564-8e5e-3bf944d38037
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/presentation_assets?select=id%2Casset_type%2Ccreated_at&presentation_id=eq.8a61b64d-faac-4018-b54b-81e7a4227327
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/presentation_assets?select=id%2Casset_type%2Ccreated_at&presentation_id=eq.6f92d159-793d-4870-a06b-e2039ed0690f
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/presentation_assets?select=id%2Casset_type%2Ccreated_at&presentation_id=eq.f70f5bc9-15af-45b8-840e-a1eb6f6c7f2a
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/presentation_assets?select=id%2Casset_type%2Ccreated_at&presentation_id=eq.51c1e5ff-5a5c-4763-ba01-1293c542c5d0
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/presentation_assets?select=id%2Casset_type%2Ccreated_at&presentation_id=eq.0a0120c2-3b97-4c65-b0eb-a34b642437a4
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/presentation_assets?select=id%2Casset_type%2Ccreated_at&presentation_id=eq.ada228c3-78c4-4d4d-9eb1-7d41dae5c85e
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/sources_google?select=expert_id&id=eq.c2606283-ca07-4cd1-ab1e-ca86dacc0744
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/sources_google?select=expert_id&id=eq.9c1b9a04-e5f2-4738-b2ab-84ad65767158
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/sources_google?select=expert_id&id=eq.14837a21-bc77-47fe-ae2c-bbe952a31bbc
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/sources_google?select=expert_id&id=eq.1138b35e-b7a8-4af1-8973-6f433bb84ba2

PRESENTATION REVIEW SUMMARY
==========================

Presentation: Kovacic.Porges.`106.21 (ada228c3-78c4-4d4d-9eb1-7d41dae5c85e)
Status: missing-transcript
Assets: None
Next Steps:
  - Create transcript from audio or video file
  - Run transcription process using media-processing pipeline
-----------------------------------
Presentation: Dan Clauw.1.22.25 (500dc7e5-2c94-49a8-aa0d-df3874746465)
Status: missing-transcript
Assets: 1
  - video: Available
Next Steps:
  - Create transcript from audio or video file
  - Run transcription process using media-processing pipeline
-----------------------------------
Presentation: Fradkin.Obsessive Thoughts.1.8.23 (af9c8913-269e-4c06-8fcb-01d30c618811)
Status: missing-transcript
Assets: None
Next Steps:
  - Create transcript from audio or video file
  - Run transcription process using media-processing pipeline
-----------------------------------
Presentation: Liz Baker.11.3.21 (9bec896a-fdb1-4071-8d69-adc6764627e8)
Status: missing-transcript
Assets: None
Next Steps:
  - Create transcript from audio or video file
  - Run transcription process using media-processing pipeline
-----------------------------------
Presentation: Peper.11.21.24 (70b39370-cbb8-4564-8e5e-3bf944d38037)
Status: missing-transcript
Assets: 1
  - video: Available
Next Steps:
  - Create transcript from audio or video file
  - Run transcription process using media-processing pipeline
-----------------------------------
Presentation: Sullivan.Ballantyne.5.3.23 (8a61b64d-faac-4018-b54b-81e7a4227327)
Status: missing-transcript
Assets: None
Next Steps:
  - Create transcript from audio or video file
  - Run transcription process using media-processing pipeline
-----------------------------------
Presentation: Pennebaker.10.19.22 (6f92d159-793d-4870-a06b-e2039ed0690f)
Status: missing-transcript
Assets: None
Next Steps:
  - Create transcript from audio or video file
  - Run transcription process using media-processing pipeline
-----------------------------------
Presentation: Rowena Field.3.1.23 (f70f5bc9-15af-45b8-840e-a1eb6f6c7f2a)
Status: missing-transcript
Assets: None
Next Steps:
  - Create transcript from audio or video file
  - Run transcription process using media-processing pipeline
-----------------------------------
Presentation: Sutphinb.10.6.24 (51c1e5ff-5a5c-4763-ba01-1293c542c5d0)
Status: missing-transcript
Assets: 1
  - video: Available
Next Steps:
  - Create transcript from audio or video file
  - Run transcription process using media-processing pipeline
-----------------------------------
Presentation: Clawson.cytokine10.28.20 (0a0120c2-3b97-4c65-b0eb-a34b642437a4)
Status: missing-transcript
Assets: 1
  - video: Available
Next Steps:
  - Create transcript from audio or video file
  - Run transcription process using media-processing pipeline
-----------------------------------
2025-04-06T18:46:18.177Z [info]: Reviewed 10 presentations.
raybunnage@Rays-Laptop dhg-mono % ./scripts/cli-pipeline/presentations/presentations-cli.sh review-presentations
raybunnage@Rays-Laptop dhg-mono % ./scripts/cli-pipeline/presentations/presentations-cli.sh review-presentations
Loading environment variables from /Users/raybunnage/Documents/github/dhg-mono/.env
Loading environment variables from /Users/raybunnage/Documents/github/dhg-mono/.env.local
Loading environment variables from /Users/raybunnage/Documents/github/dhg-mono/.env.development
2025-04-06T18:51:40.344Z [info]: Reviewing presentations...
Current process.env after loading: [
  'SUPABASE_KEY',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_ANON_KEY',
  'CLI_SUPABASE_URL',
  'CLI_SUPABASE_KEY',
  'SUPABASE_PROJECT_ID',
  'SUPABASE_DB_PASSWORD',
  'SUPABASE_DB_URL'
]
Creating Supabase client with URL: https://jdksnfkupzyw...
(node:66211) [DEP0040] DeprecationWarning: The `punycode` module is deprecated. Please use a userland alternative instead.
(Use `node --trace-deprecation ...` to show where the warning was created)
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/presentations?select=id%2Ctitle%2Cmain_video_id%2Ccreated_at%2Cupdated_at&order=created_at.desc&limit=10
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/presentation_assets?select=id%2Casset_type%2Ccreated_at&presentation_id=eq.500dc7e5-2c94-49a8-aa0d-df3874746465
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/presentation_assets?select=id%2Casset_type%2Ccreated_at&presentation_id=eq.af9c8913-269e-4c06-8fcb-01d30c618811
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/presentation_assets?select=id%2Casset_type%2Ccreated_at&presentation_id=eq.9bec896a-fdb1-4071-8d69-adc6764627e8
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/presentation_assets?select=id%2Casset_type%2Ccreated_at&presentation_id=eq.70b39370-cbb8-4564-8e5e-3bf944d38037
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/presentation_assets?select=id%2Casset_type%2Ccreated_at&presentation_id=eq.8a61b64d-faac-4018-b54b-81e7a4227327
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/presentation_assets?select=id%2Casset_type%2Ccreated_at&presentation_id=eq.6f92d159-793d-4870-a06b-e2039ed0690f
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/presentation_assets?select=id%2Casset_type%2Ccreated_at&presentation_id=eq.f70f5bc9-15af-45b8-840e-a1eb6f6c7f2a
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/presentation_assets?select=id%2Casset_type%2Ccreated_at&presentation_id=eq.51c1e5ff-5a5c-4763-ba01-1293c542c5d0
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/presentation_assets?select=id%2Casset_type%2Ccreated_at&presentation_id=eq.0a0120c2-3b97-4c65-b0eb-a34b642437a4
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/presentation_assets?select=id%2Casset_type%2Ccreated_at&presentation_id=eq.ada228c3-78c4-4d4d-9eb1-7d41dae5c85e
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/sources_google?select=expert_id&id=eq.c2606283-ca07-4cd1-ab1e-ca86dacc0744
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/sources_google?select=expert_id&id=eq.14837a21-bc77-47fe-ae2c-bbe952a31bbc
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/sources_google?select=expert_id&id=eq.9c1b9a04-e5f2-4738-b2ab-84ad65767158
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/sources_google?select=expert_id&id=eq.1138b35e-b7a8-4af1-8973-6f433bb84ba2

PRESENTATION REVIEW SUMMARY
==========================

| Title | ID | Expert | Status | Has Transcript | Assets | Next Steps |
|-------|----|---------|---------|---------|---------|--------------------|
| Kovacic.Porges.`106.21 | ada228c3-78c4-4d4d-9eb1-7d41dae5c85e | N/A | missing-transcript | No | None | Create transcript from audio or video file<br>Run transcription process using media-processing pipeline |
| Dan Clauw.1.22.25 | 500dc7e5-2c94-49a8-aa0d-df3874746465 | N/A | missing-transcript | No | video | Create transcript from audio or video file<br>Run transcription process using media-processing pipeline |
| Fradkin.Obsessive Thoughts.1.8.23 | af9c8913-269e-4c06-8fcb-01d30c618811 | N/A | missing-transcript | No | None | Create transcript from audio or video file<br>Run transcription process using media-processing pipeline |
| Liz Baker.11.3.21 | 9bec896a-fdb1-4071-8d69-adc6764627e8 | N/A | missing-transcript | No | None | Create transcript from audio or video file<br>Run transcription process using media-processing pipeline |
| Peper.11.21.24 | 70b39370-cbb8-4564-8e5e-3bf944d38037 | N/A | missing-transcript | No | video | Create transcript from audio or video file<br>Run transcription process using media-processing pipeline |
| Sullivan.Ballantyne.5.3.23 | 8a61b64d-faac-4018-b54b-81e7a4227327 | N/A | missing-transcript | No | None | Create transcript from audio or video file<br>Run transcription process using media-processing pipeline |
| Pennebaker.10.19.22 | 6f92d159-793d-4870-a06b-e2039ed0690f | N/A | missing-transcript | No | None | Create transcript from audio or video file<br>Run transcription process using media-processing pipeline |
| Rowena Field.3.1.23 | f70f5bc9-15af-45b8-840e-a1eb6f6c7f2a | N/A | missing-transcript | No | None | Create transcript from audio or video file<br>Run transcription process using media-processing pipeline |
| Sutphinb.10.6.24 | 51c1e5ff-5a5c-4763-ba01-1293c542c5d0 | N/A | missing-transcript | No | video | Create transcript from audio or video file<br>Run transcription process using media-processing pipeline |
| Clawson.cytokine10.28.20 | 0a0120c2-3b97-4c65-b0eb-a34b642437a4 | N/A | missing-transcript | No | video | Create transcript from audio or video file<br>Run transcription process using media-processing pipeline |


2025-04-06T18:51:41.089Z [info]: Reviewed 10 presentations.
raybunnage@Rays-Laptop dhg-mono % ./scripts/cli-pipeline/presentations/presentations-cli.sh review-presentations
Loading environment variables from /Users/raybunnage/Documents/github/dhg-mono/.env
Loading environment variables from /Users/raybunnage/Documents/github/dhg-mono/.env.local
Loading environment variables from /Users/raybunnage/Documents/github/dhg-mono/.env.development
2025-04-06T19:21:06.686Z [info]: Reviewing presentations...
Current process.env after loading: [
  'SUPABASE_KEY',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_ANON_KEY',
  'CLI_SUPABASE_URL',
  'CLI_SUPABASE_KEY',
  'SUPABASE_PROJECT_ID',
  'SUPABASE_DB_PASSWORD',
  'SUPABASE_DB_URL'
]
Creating Supabase client with URL: https://jdksnfkupzyw...
(node:69238) [DEP0040] DeprecationWarning: The `punycode` module is deprecated. Please use a userland alternative instead.
(Use `node --trace-deprecation ...` to show where the warning was created)
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/presentations?select=id%2Ctitle%2Cmain_video_id%2Ccreated_at%2Cupdated_at&order=created_at.desc&limit=10
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/presentation_assets?select=id%2Casset_type%2Ccreated_at&presentation_id=eq.500dc7e5-2c94-49a8-aa0d-df3874746465
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/presentation_assets?select=id%2Casset_type%2Ccreated_at&presentation_id=eq.af9c8913-269e-4c06-8fcb-01d30c618811
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/presentation_assets?select=id%2Casset_type%2Ccreated_at&presentation_id=eq.9bec896a-fdb1-4071-8d69-adc6764627e8
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/presentation_assets?select=id%2Casset_type%2Ccreated_at&presentation_id=eq.70b39370-cbb8-4564-8e5e-3bf944d38037
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/presentation_assets?select=id%2Casset_type%2Ccreated_at&presentation_id=eq.8a61b64d-faac-4018-b54b-81e7a4227327
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/presentation_assets?select=id%2Casset_type%2Ccreated_at&presentation_id=eq.6f92d159-793d-4870-a06b-e2039ed0690f
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/presentation_assets?select=id%2Casset_type%2Ccreated_at&presentation_id=eq.f70f5bc9-15af-45b8-840e-a1eb6f6c7f2a
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/presentation_assets?select=id%2Casset_type%2Ccreated_at&presentation_id=eq.51c1e5ff-5a5c-4763-ba01-1293c542c5d0
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/presentation_assets?select=id%2Casset_type%2Ccreated_at&presentation_id=eq.0a0120c2-3b97-4c65-b0eb-a34b642437a4
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/presentation_assets?select=id%2Casset_type%2Ccreated_at&presentation_id=eq.ada228c3-78c4-4d4d-9eb1-7d41dae5c85e
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/sources_google?select=expert_id&id=eq.c2606283-ca07-4cd1-ab1e-ca86dacc0744
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/sources_google?select=expert_id&id=eq.1138b35e-b7a8-4af1-8973-6f433bb84ba2
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/sources_google?select=expert_id&id=eq.14837a21-bc77-47fe-ae2c-bbe952a31bbc
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/sources_google?select=expert_id&id=eq.9c1b9a04-e5f2-4738-b2ab-84ad65767158

PRESENTATION REVIEW SUMMARY
==========================

| Title | ID | Expert | Status | Has Transcript | Assets | Next Steps |
|-------|----|---------|---------|---------|---------|--------------------|
| Kovacic.Porges.`106.21 | ada228c3-78c4-4d4d-9eb1-7d41dae5c85e | N/A | missing-transcript | No | None | Create transcript from audio or video file<br>Run transcription process using media-processing pipeline |
| Dan Clauw.1.22.25 | 500dc7e5-2c94-49a8-aa0d-df3874746465 | N/A | missing-transcript | No | video | Create transcript from audio or video file<br>Run transcription process using media-processing pipeline |
| Fradkin.Obsessive Thoughts.1.8.23 | af9c8913-269e-4c06-8fcb-01d30c618811 | N/A | missing-transcript | No | None | Create transcript from audio or video file<br>Run transcription process using media-processing pipeline |
| Liz Baker.11.3.21 | 9bec896a-fdb1-4071-8d69-adc6764627e8 | N/A | missing-transcript | No | None | Create transcript from audio or video file<br>Run transcription process using media-processing pipeline |
| Peper.11.21.24 | 70b39370-cbb8-4564-8e5e-3bf944d38037 | N/A | missing-transcript | No | video | Create transcript from audio or video file<br>Run transcription process using media-processing pipeline |
| Sullivan.Ballantyne.5.3.23 | 8a61b64d-faac-4018-b54b-81e7a4227327 | N/A | missing-transcript | No | None | Create transcript from audio or video file<br>Run transcription process using media-processing pipeline |
| Pennebaker.10.19.22 | 6f92d159-793d-4870-a06b-e2039ed0690f | N/A | missing-transcript | No | None | Create transcript from audio or video file<br>Run transcription process using media-processing pipeline |
| Rowena Field.3.1.23 | f70f5bc9-15af-45b8-840e-a1eb6f6c7f2a | N/A | missing-transcript | No | None | Create transcript from audio or video file<br>Run transcription process using media-processing pipeline |
| Sutphinb.10.6.24 | 51c1e5ff-5a5c-4763-ba01-1293c542c5d0 | N/A | missing-transcript | No | video | Create transcript from audio or video file<br>Run transcription process using media-processing pipeline |
| Clawson.cytokine10.28.20 | 0a0120c2-3b97-4c65-b0eb-a34b642437a4 | N/A | missing-transcript | No | video | Create transcript from audio or video file<br>Run transcription process using media-processing pipeline |


2025-04-06T19:21:07.343Z [info]: Reviewed 10 presentations.
raybunnage@Rays-Laptop dhg-mono % ./scripts/cli-pipeline/presentations/presentations-cli.sh review-presentations
Loading environment variables from /Users/raybunnage/Documents/github/dhg-mono/.env
Loading environment variables from /Users/raybunnage/Documents/github/dhg-mono/.env.local
Loading environment variables from /Users/raybunnage/Documents/github/dhg-mono/.env.development
2025-04-06T19:24:55.344Z [info]: Reviewing presentations...
Current process.env after loading: [
  'SUPABASE_KEY',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_ANON_KEY',
  'CLI_SUPABASE_URL',
  'CLI_SUPABASE_KEY',
  'SUPABASE_PROJECT_ID',
  'SUPABASE_DB_PASSWORD',
  'SUPABASE_DB_URL'
]
Creating Supabase client with URL: https://jdksnfkupzyw...
(node:69627) [DEP0040] DeprecationWarning: The `punycode` module is deprecated. Please use a userland alternative instead.
(Use `node --trace-deprecation ...` to show where the warning was created)
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/presentations?select=id%2Ctitle%2Cmain_video_id%2Ccreated_at%2Cupdated_at&order=created_at.desc&limit=300
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/presentation_assets?select=id%2Casset_type%2Ccreated_at&presentation_id=eq.ada228c3-78c4-4d4d-9eb1-7d41dae5c85e
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/presentation_assets?select=id%2Casset_type%2Ccreated_at&presentation_id=eq.500dc7e5-2c94-49a8-aa0d-df3874746465
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/presentation_assets?select=id%2Casset_type%2Ccreated_at&presentation_id=eq.af9c8913-269e-4c06-8fcb-01d30c618811
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/presentation_assets?select=id%2Casset_type%2Ccreated_at&presentation_id=eq.9bec896a-fdb1-4071-8d69-adc6764627e8
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/presentation_assets?select=id%2Casset_type%2Ccreated_at&presentation_id=eq.70b39370-cbb8-4564-8e5e-3bf944d38037
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/presentation_assets?select=id%2Casset_type%2Ccreated_at&presentation_id=eq.8a61b64d-faac-4018-b54b-81e7a4227327
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/presentation_assets?select=id%2Casset_type%2Ccreated_at&presentation_id=eq.6f92d159-793d-4870-a06b-e2039ed0690f
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/presentation_assets?select=id%2Casset_type%2Ccreated_at&presentation_id=eq.f70f5bc9-15af-45b8-840e-a1eb6f6c7f2a
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/presentation_assets?select=id%2Casset_type%2Ccreated_at&presentation_id=eq.51c1e5ff-5a5c-4763-ba01-1293c542c5d0
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/presentation_assets?select=id%2Casset_type%2Ccreated_at&presentation_id=eq.27086169-aadc-4dd6-ad61-173987dfe638
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/presentation_assets?select=id%2Casset_type%2Ccreated_at&presentation_id=eq.394871ea-5203-433d-a2d0-56ff05729fd7
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/presentation_assets?select=id%2Casset_type%2Ccreated_at&presentation_id=eq.eb605266-fe9c-479f-9b91-b30ae0056b9c
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/presentation_assets?select=id%2Casset_type%2Ccreated_at&presentation_id=eq.f70c4f3f-5c9f-4d0c-911c-96d0a443302f
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/presentation_assets?select=id%2Casset_type%2Ccreated_at&presentation_id=eq.6afb55ca-decd-434c-b61c-ab53fa2aa2ef
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/presentation_assets?select=id%2Casset_type%2Ccreated_at&presentation_id=eq.ae87f0a6-876b-425a-918a-309709bcb390
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/presentation_assets?select=id%2Casset_type%2Ccreated_at&presentation_id=eq.ae7885d0-37b0-4102-a7e0-ded5d80aa349
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/presentation_assets?select=id%2Casset_type%2Ccreated_at&presentation_id=eq.50ee2adb-8a44-4d45-9e8f-f2febad759b5
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/presentation_assets?select=id%2Casset_type%2Ccreated_at&presentation_id=eq.c40df3ea-3b1b-4c1c-989a-86460e69c635
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/presentation_assets?select=id%2Casset_type%2Ccreated_at&presentation_id=eq.be823236-6eb2-430d-98fa-34ab25cdff5a
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/presentation_assets?select=id%2Casset_type%2Ccreated_at&presentation_id=eq.548d06ba-71fa-4e8b-8481-94d58604a5cc
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/presentation_assets?select=id%2Casset_type%2Ccreated_at&presentation_id=eq.169db4b8-f580-48fd-8abb-c8c67d378848
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/presentation_assets?select=id%2Casset_type%2Ccreated_at&presentation_id=eq.a12668ac-0cd7-42ac-a93e-5efa3c46ad4e
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/presentation_assets?select=id%2Casset_type%2Ccreated_at&presentation_id=eq.6a1a8cfb-ff4c-43c0-a087-8b7fea7efc56
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/presentation_assets?select=id%2Casset_type%2Ccreated_at&presentation_id=eq.7ec108bc-7634-41bd-a6c5-1e65acd9df2b
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/presentation_assets?select=id%2Casset_type%2Ccreated_at&presentation_id=eq.535887b5-1a2b-4681-aa0d-6bfc7b36ed31
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/presentation_assets?select=id%2Casset_type%2Ccreated_at&presentation_id=eq.b51020f8-60b8-43d2-8f90-0d10293edfd0
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/presentation_assets?select=id%2Casset_type%2Ccreated_at&presentation_id=eq.d4a7096c-0bab-4dce-8cde-5afd8afdbe24
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/presentation_assets?select=id%2Casset_type%2Ccreated_at&presentation_id=eq.23b64868-b0db-4440-af30-a6157330d039
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/presentation_assets?select=id%2Casset_type%2Ccreated_at&presentation_id=eq.53c304c9-ed1c-4ae6-8add-47e615b4048e
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/presentation_assets?select=id%2Casset_type%2Ccreated_at&presentation_id=eq.2fb73b30-341d-494b-9c28-e8417491d901
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/presentation_assets?select=id%2Casset_type%2Ccreated_at&presentation_id=eq.f545bd1d-9be3-49a7-b366-82ba687db947
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/presentation_assets?select=id%2Casset_type%2Ccreated_at&presentation_id=eq.c6b47531-9539-463f-909c-fd5eb2fe6a37
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/presentation_assets?select=id%2Casset_type%2Ccreated_at&presentation_id=eq.0ddf1fc0-492c-46f1-80a8-1a899ec863d2
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/presentation_assets?select=id%2Casset_type%2Ccreated_at&presentation_id=eq.74f20d36-c5a0-4e4d-a9c7-d05e89f8bdfd
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/presentation_assets?select=id%2Casset_type%2Ccreated_at&presentation_id=eq.c4603e54-f688-4058-97c1-94e5a6270369
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/presentation_assets?select=id%2Casset_type%2Ccreated_at&presentation_id=eq.ee8ad893-7a8b-4e3e-aeb9-4977e7786ca8
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/presentation_assets?select=id%2Casset_type%2Ccreated_at&presentation_id=eq.97bb9985-355c-475a-93c0-366205d40bb7
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/presentation_assets?select=id%2Casset_type%2Ccreated_at&presentation_id=eq.101ce661-c2df-44d5-90bf-c653535fa8d4
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/presentation_assets?select=id%2Casset_type%2Ccreated_at&presentation_id=eq.59057085-2d01-421e-8bcd-6830b53449bc
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/presentation_assets?select=id%2Casset_type%2Ccreated_at&presentation_id=eq.ceb37a3e-f977-4b45-a49a-35b54f86a002
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/presentation_assets?select=id%2Casset_type%2Ccreated_at&presentation_id=eq.13becfd3-a46c-4339-86d6-f48706e4d4c3
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/presentation_assets?select=id%2Casset_type%2Ccreated_at&presentation_id=eq.03a81eb9-e1ab-44cd-b328-926bcb14cf32
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/presentation_assets?select=id%2Casset_type%2Ccreated_at&presentation_id=eq.c252a4c5-92f7-49fa-9aed-6d20560c666f
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/presentation_assets?select=id%2Casset_type%2Ccreated_at&presentation_id=eq.45432399-5e74-4f19-ba9a-27613cd04e80
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/presentation_assets?select=id%2Casset_type%2Ccreated_at&presentation_id=eq.b20bb858-dbf0-4ee3-92a3-769f08cba72c
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/presentation_assets?select=id%2Casset_type%2Ccreated_at&presentation_id=eq.84ca511b-d39b-4372-b397-f61a6d74d6aa
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/presentation_assets?select=id%2Casset_type%2Ccreated_at&presentation_id=eq.54522d9e-c541-4421-9091-95cab6815a29
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/presentation_assets?select=id%2Casset_type%2Ccreated_at&presentation_id=eq.be5f38d9-e6ea-419a-805d-562b05659e84
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/presentation_assets?select=id%2Casset_type%2Ccreated_at&presentation_id=eq.087a47cd-3a44-4121-9d13-9b6bf45bb65c
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/presentation_assets?select=id%2Casset_type%2Ccreated_at&presentation_id=eq.ec79babd-ee7f-4a56-b9ab-877e58d2625f
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/presentation_assets?select=id%2Casset_type%2Ccreated_at&presentation_id=eq.7f5c49fd-bc23-425f-af54-08981b5e1d4c
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/presentation_assets?select=id%2Casset_type%2Ccreated_at&presentation_id=eq.6faf9fd5-5f73-4fb7-b51d-faa68d43d6c8
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/presentation_assets?select=id%2Casset_type%2Ccreated_at&presentation_id=eq.17519552-a0d3-461f-967d-f78f307531dc
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/presentation_assets?select=id%2Casset_type%2Ccreated_at&presentation_id=eq.f7b7ba54-c71d-4542-8c95-c1b67d525c82
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/presentation_assets?select=id%2Casset_type%2Ccreated_at&presentation_id=eq.5031f08c-ac35-41fc-8794-8c54fb8a7184
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/presentation_assets?select=id%2Casset_type%2Ccreated_at&presentation_id=eq.6761caa1-d28f-400b-a770-dd5eb773cc1e
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/presentation_assets?select=id%2Casset_type%2Ccreated_at&presentation_id=eq.a032dcdc-4474-4abb-898a-75103ae3d938
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/presentation_assets?select=id%2Casset_type%2Ccreated_at&presentation_id=eq.67766945-3dd4-42c2-a832-6bef8dce247e
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/presentation_assets?select=id%2Casset_type%2Ccreated_at&presentation_id=eq.021696d8-e805-4012-9349-86086a6e649d
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/presentation_assets?select=id%2Casset_type%2Ccreated_at&presentation_id=eq.30881b33-0eae-48a3-9d02-e2a686f946e5
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/presentation_assets?select=id%2Casset_type%2Ccreated_at&presentation_id=eq.0f1cdc2d-950a-4f5e-8ead-12299c0cc100
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/presentation_assets?select=id%2Casset_type%2Ccreated_at&presentation_id=eq.f24aaafd-e4e2-436f-9524-3fa78245ff0e
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/presentation_assets?select=id%2Casset_type%2Ccreated_at&presentation_id=eq.22fdc7db-3b7a-4ef1-bacd-9a8cead1831e
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/presentation_assets?select=id%2Casset_type%2Ccreated_at&presentation_id=eq.514628e0-ab8c-4416-a4c0-f8b8e66a3fba
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/presentation_assets?select=id%2Casset_type%2Ccreated_at&presentation_id=eq.7c117eee-5e9f-4622-89ac-0f9610384f96
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/presentation_assets?select=id%2Casset_type%2Ccreated_at&presentation_id=eq.88242db9-0374-4023-ad38-38baf824d5a8
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/presentation_assets?select=id%2Casset_type%2Ccreated_at&presentation_id=eq.ac1835ee-0afa-4efc-b584-6d5dc885e07d
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/presentation_assets?select=id%2Casset_type%2Ccreated_at&presentation_id=eq.d4d4cf2a-770a-4cd2-ae46-6f7b1705b47e
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/presentation_assets?select=id%2Casset_type%2Ccreated_at&presentation_id=eq.fba43200-8fb8-48e3-9f33-432b67f4e514
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/presentation_assets?select=id%2Casset_type%2Ccreated_at&presentation_id=eq.7c4778cb-b660-431f-a9f0-0cb64072bae8
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/presentation_assets?select=id%2Casset_type%2Ccreated_at&presentation_id=eq.9c6d90a0-8985-43ed-b104-2435d8a88566
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/presentation_assets?select=id%2Casset_type%2Ccreated_at&presentation_id=eq.011c1202-d0b6-4c5f-966e-6f84eb0e31f8
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/presentation_assets?select=id%2Casset_type%2Ccreated_at&presentation_id=eq.6b5730e7-933e-434b-a0ee-6de4488d16cc
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/presentation_assets?select=id%2Casset_type%2Ccreated_at&presentation_id=eq.577d7d5f-8d22-4969-b9dc-8d328fb0e6a7
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/presentation_assets?select=id%2Casset_type%2Ccreated_at&presentation_id=eq.80cad99e-6d25-4d92-9323-ea433deeea82
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/presentation_assets?select=id%2Casset_type%2Ccreated_at&presentation_id=eq.90c1f1ab-71be-421c-b3c9-11995c521b62
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/presentation_assets?select=id%2Casset_type%2Ccreated_at&presentation_id=eq.d000f9be-955a-42b4-be48-9329bb9f39fc
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/presentation_assets?select=id%2Casset_type%2Ccreated_at&presentation_id=eq.930ae34f-5083-458c-ba2d-45112d74c199
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/presentation_assets?select=id%2Casset_type%2Ccreated_at&presentation_id=eq.5047ce94-4654-4033-b2b8-1bec2f5f1c5a
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/presentation_assets?select=id%2Casset_type%2Ccreated_at&presentation_id=eq.41c7e517-4c19-49f4-bba1-77643f1e8d66
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/presentation_assets?select=id%2Casset_type%2Ccreated_at&presentation_id=eq.cf53db47-cdc3-4bff-9314-1255c97f0f27
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/presentation_assets?select=id%2Casset_type%2Ccreated_at&presentation_id=eq.9786df52-6c9a-4286-ac13-3dcbafa6140b
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/presentation_assets?select=id%2Casset_type%2Ccreated_at&presentation_id=eq.7d422766-29de-47ac-a1f4-8299e07b10d1
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/presentation_assets?select=id%2Casset_type%2Ccreated_at&presentation_id=eq.5bd4c58e-e1a3-4f97-b291-fb6a543e0bcd
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/presentation_assets?select=id%2Casset_type%2Ccreated_at&presentation_id=eq.0acd765b-820d-4a8e-8543-ae36938da0c8
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/presentation_assets?select=id%2Casset_type%2Ccreated_at&presentation_id=eq.a22e932b-5f38-41f2-979b-b512589c1934
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/presentation_assets?select=id%2Casset_type%2Ccreated_at&presentation_id=eq.43f9fb80-cde9-4187-be7f-52855f8ecea6
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/presentation_assets?select=id%2Casset_type%2Ccreated_at&presentation_id=eq.8df8ff3a-2b2c-4b75-8810-ffc11f011da6
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/presentation_assets?select=id%2Casset_type%2Ccreated_at&presentation_id=eq.17fbfe62-5b86-4408-8f2a-a07d8faf4115
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/presentation_assets?select=id%2Casset_type%2Ccreated_at&presentation_id=eq.241f6e43-969a-47e4-8eaf-4c6cafbc634b
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/presentation_assets?select=id%2Casset_type%2Ccreated_at&presentation_id=eq.98d477ab-1dcf-44da-8b8d-50cad84d8dae
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/presentation_assets?select=id%2Casset_type%2Ccreated_at&presentation_id=eq.e95f2404-ce5f-43e5-af4c-ff7f9765e55e
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/presentation_assets?select=id%2Casset_type%2Ccreated_at&presentation_id=eq.cc0c0edf-9e40-4eba-8b89-8f33dd4a26e6
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/presentation_assets?select=id%2Casset_type%2Ccreated_at&presentation_id=eq.7c08125a-d220-4a6f-a087-47f568b0b0e2
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/presentation_assets?select=id%2Casset_type%2Ccreated_at&presentation_id=eq.ea48930b-1301-46da-accd-0be3a6b2848b
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/presentation_assets?select=id%2Casset_type%2Ccreated_at&presentation_id=eq.a49057d6-3389-4307-b057-4f8dac710b56
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/presentation_assets?select=id%2Casset_type%2Ccreated_at&presentation_id=eq.64c1da7b-b8e7-42a3-9644-af170db9d73f
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/presentation_assets?select=id%2Casset_type%2Ccreated_at&presentation_id=eq.28a7ebef-b9d0-4ea4-9c44-4604bf73c4cd
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/presentation_assets?select=id%2Casset_type%2Ccreated_at&presentation_id=eq.42020c2a-e397-45ec-b3a3-77d59082e815
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/presentation_assets?select=id%2Casset_type%2Ccreated_at&presentation_id=eq.36bd9f6a-e3eb-4c7d-bc0a-cdc650d68dde
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/presentation_assets?select=id%2Casset_type%2Ccreated_at&presentation_id=eq.2ddffadc-bf6e-452b-b98b-8b7b48ce831a
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/presentation_assets?select=id%2Casset_type%2Ccreated_at&presentation_id=eq.8ab0f3b5-afb6-4221-a515-d11a7b71b125
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/presentation_assets?select=id%2Casset_type%2Ccreated_at&presentation_id=eq.76792044-7cc5-4062-bf10-e67339af256c
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/presentation_assets?select=id%2Casset_type%2Ccreated_at&presentation_id=eq.05c5e00c-6979-460c-ba85-1ef1e3986e17
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/presentation_assets?select=id%2Casset_type%2Ccreated_at&presentation_id=eq.b52fd645-fa92-404c-a8c7-a674b10bc631
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/presentation_assets?select=id%2Casset_type%2Ccreated_at&presentation_id=eq.24f53497-1b6c-4bf0-8963-b60dca2d3411
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/presentation_assets?select=id%2Casset_type%2Ccreated_at&presentation_id=eq.32846b7f-5a5d-4622-9964-194f7853f08e
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/presentation_assets?select=id%2Casset_type%2Ccreated_at&presentation_id=eq.97eda0ba-1007-4854-9f8c-071d6aecb582
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/presentation_assets?select=id%2Casset_type%2Ccreated_at&presentation_id=eq.3c80d81d-db0a-441a-8052-3be069ebc23e
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/presentation_assets?select=id%2Casset_type%2Ccreated_at&presentation_id=eq.514732d5-8186-4d77-bb34-7c9dda32cd75
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/presentation_assets?select=id%2Casset_type%2Ccreated_at&presentation_id=eq.02e1adeb-9f57-4c58-af21-d7a094147955
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/presentation_assets?select=id%2Casset_type%2Ccreated_at&presentation_id=eq.0a0120c2-3b97-4c65-b0eb-a34b642437a4
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/sources_google?select=expert_id&id=eq.d758568b-7df5-4ad2-94e9-b8cdc0ba521a
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/sources_google?select=expert_id&id=eq.14837a21-bc77-47fe-ae2c-bbe952a31bbc
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/sources_google?select=expert_id&id=eq.c2606283-ca07-4cd1-ab1e-ca86dacc0744
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/sources_google?select=expert_id&id=eq.1138b35e-b7a8-4af1-8973-6f433bb84ba2
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/sources_google?select=expert_id&id=eq.313349ca-991e-4b93-a075-fec2c2fd19d8
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/sources_google?select=expert_id&id=eq.836c03c0-bc85-4550-92f2-92aaf4022e62
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/sources_google?select=expert_id&id=eq.fed9346c-6255-4992-bc3e-c788eb3ae858
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/sources_google?select=expert_id&id=eq.ce19b502-0448-4bb5-8d7e-b5280fbbc08b
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/sources_google?select=expert_id&id=eq.97f433d4-53f9-483f-9467-ee7953314c28
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/sources_google?select=expert_id&id=eq.411342b5-6380-4362-abc8-8c792b0793f2
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/sources_google?select=expert_id&id=eq.8b4bc63e-61f4-47fc-a990-dbe0c2c57673
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/sources_google?select=expert_id&id=eq.35269850-f06a-4ab0-b3f3-b6c9008bb711
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/sources_google?select=expert_id&id=eq.acd2af4a-269e-488e-8771-e1fb0a336fb9
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/sources_google?select=expert_id&id=eq.aff0ea55-7e15-4788-aabc-14ab72fb4599
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/sources_google?select=expert_id&id=eq.f248b090-3e99-4eef-aa7c-62e7284bd88f
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/sources_google?select=expert_id&id=eq.5822703f-e4fb-485d-a962-3bf587d6f968
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/sources_google?select=expert_id&id=eq.1ed899f4-3f66-4161-9bf0-9311f1119a5b
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/sources_google?select=expert_id&id=eq.4a2c0185-1eaa-4949-8630-234f1105748d
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/sources_google?select=expert_id&id=eq.8f47a86f-f8a0-464c-bb7c-81e4bea2fbfc
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/sources_google?select=expert_id&id=eq.2e2ace2e-85e2-42a7-a11e-2c4d457f2a3c
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/sources_google?select=expert_id&id=eq.34b7ac23-d28d-4ce2-bc34-0fc7afdc0f95
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/sources_google?select=expert_id&id=eq.c317acca-502d-4fc6-88ae-e83f6fb272d0
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/sources_google?select=expert_id&id=eq.ea80a9f0-8e98-4140-8e64-14f272b131ba
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/sources_google?select=expert_id&id=eq.7c8ff60a-a2ac-4526-90cf-cc0b5181d32c
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/sources_google?select=expert_id&id=eq.88d99fa3-b901-407c-8e77-079770d33fe3
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/sources_google?select=expert_id&id=eq.c4c0759a-ef5b-4d27-add1-a69e65ad6d2f
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/sources_google?select=expert_id&id=eq.9ede4af9-5706-4b1b-9a53-b0fc5e588eaa
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/sources_google?select=expert_id&id=eq.77f8c8aa-25cd-41c3-a5e4-b75d221cc403
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/sources_google?select=expert_id&id=eq.aac6cfac-1641-4ebe-aa83-85dec0e95150
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/sources_google?select=expert_id&id=eq.fa6ed757-df23-4a8c-a34b-bc48276f2329
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/sources_google?select=expert_id&id=eq.59703f95-bde2-45ad-a748-f592c9b68d0f
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/sources_google?select=expert_id&id=eq.acce4cae-d9a3-4b52-8cbd-f4dd1be2c0ad
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/sources_google?select=expert_id&id=eq.52161b75-5a61-417f-8d4a-99a1723ecaa6
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/sources_google?select=expert_id&id=eq.b0b020da-1db7-4c6f-9b45-f3614a2c0110
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/sources_google?select=expert_id&id=eq.48cb576f-046d-4d4a-9e57-a735ab28ed75
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/sources_google?select=expert_id&id=eq.7ce3d96f-e148-4d25-9392-9f49f3e68f5f
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/sources_google?select=expert_id&id=eq.5a591804-55cb-48c0-88cb-787ffb791949
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/sources_google?select=expert_id&id=eq.221817dd-d765-4f2f-a88c-4ba314d33204
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/sources_google?select=expert_id&id=eq.83194ac6-161d-4e0f-95c0-ab3336c7c198
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/sources_google?select=expert_id&id=eq.6db1138b-1e5e-47ca-813e-5b6427d065a2
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/sources_google?select=expert_id&id=eq.1eb0992f-6a8e-4710-bbdb-92a933a85496
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/sources_google?select=expert_id&id=eq.d07d4fda-6961-487b-bb6e-90755d925664
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/sources_google?select=expert_id&id=eq.f00e217a-7c6e-40c6-8359-969ca7094e55
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/sources_google?select=expert_id&id=eq.9c1b9a04-e5f2-4738-b2ab-84ad65767158
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/sources_google?select=expert_id&id=eq.85e3a03a-98d1-409e-9bd8-502cb5137486
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/sources_google?select=expert_id&id=eq.3f82a1a8-bbdd-4725-9cf7-f380d8cb6b82
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/sources_google?select=expert_id&id=eq.294478c6-aa77-44e8-b03f-9479819ff97d
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/sources_google?select=expert_id&id=eq.5449683a-6534-411f-897b-de7be25d06b4
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/sources_google?select=expert_id&id=eq.60b9bf66-9ab8-4014-b85c-738954e6e532
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/sources_google?select=expert_id&id=eq.2b13fea1-d853-4316-9e27-7c385df6236b
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/sources_google?select=expert_id&id=eq.1a647db0-0fcf-402d-9f09-32f61bc9f070
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/sources_google?select=expert_id&id=eq.052fa828-8d7c-47d3-8cd0-163ebf7a2340
Supabase request to: https://jdksnfkupzywjdfefkyj.supabase.co/rest/v1/sources_google?select=expert_id&id=eq.c0283744-abf9-4654-9f0a-8043cb29e14e

PRESENTATION REVIEW SUMMARY
==========================

| Title | ID | Expert | Status | Has Transcript | Assets | Expert Documents | Next Steps |
|-------|----|---------|---------|---------|---------|--------------------|----------------|
| Clawson.cytokine10.28.20 | 0a0120c2-3b97-4c65-b0eb-a34b642437a4 | N/A | missing-transcript | No | video | None | Create transcript from audio or video file<br>Run transcription process using media-processing pipeline |
| Kovacic.Porges.`106.21 | ada228c3-78c4-4d4d-9eb1-7d41dae5c85e | N/A | missing-transcript | No | None | None | Create transcript from audio or video file<br>Run transcription process using media-processing pipeline |
| Dan Clauw.1.22.25 | 500dc7e5-2c94-49a8-aa0d-df3874746465 | N/A | missing-transcript | No | video | None | Create transcript from audio or video file<br>Run transcription process using media-processing pipeline |
| Fradkin.Obsessive Thoughts.1.8.23 | af9c8913-269e-4c06-8fcb-01d30c618811 | N/A | missing-transcript | No | None | None | Create transcript from audio or video file<br>Run transcription process using media-processing pipeline |
| Liz Baker.11.3.21 | 9bec896a-fdb1-4071-8d69-adc6764627e8 | N/A | missing-transcript | No | None | None | Create transcript from audio or video file<br>Run transcription process using media-processing pipeline |
| Peper.11.21.24 | 70b39370-cbb8-4564-8e5e-3bf944d38037 | N/A | missing-transcript | No | video | None | Create transcript from audio or video file<br>Run transcription process using media-processing pipeline |
| Sullivan.Ballantyne.5.3.23 | 8a61b64d-faac-4018-b54b-81e7a4227327 | N/A | missing-transcript | No | None | None | Create transcript from audio or video file<br>Run transcription process using media-processing pipeline |
| Pennebaker.10.19.22 | 6f92d159-793d-4870-a06b-e2039ed0690f | N/A | missing-transcript | No | None | None | Create transcript from audio or video file<br>Run transcription process using media-processing pipeline |
| Rowena Field.3.1.23 | f70f5bc9-15af-45b8-840e-a1eb6f6c7f2a | N/A | missing-transcript | No | None | None | Create transcript from audio or video file<br>Run transcription process using media-processing pipeline |
| Sutphinb.10.6.24 | 51c1e5ff-5a5c-4763-ba01-1293c542c5d0 | N/A | missing-transcript | No | video | None | Create transcript from audio or video file<br>Run transcription process using media-processing pipeline |
| Bernie Seigel | 27086169-aadc-4dd6-ad61-173987dfe638 | N/A | missing-transcript | No | video | None | Create transcript from audio or video file<br>Run transcription process using media-processing pipeline |
| GigiConstable.1.6.21 | 394871ea-5203-433d-a2d0-56ff05729fd7 | N/A | missing-transcript | No | None | None | Create transcript from audio or video file<br>Run transcription process using media-processing pipeline |
| Hoverman.12.18.24 | eb605266-fe9c-479f-9b91-b30ae0056b9c | N/A | missing-transcript | No | video | None | Create transcript from audio or video file<br>Run transcription process using media-processing pipeline |
| Tribal Therapy.9.2.20 | f70c4f3f-5c9f-4d0c-911c-96d0a443302f | N/A | missing-transcript | No | None | None | Create transcript from audio or video file<br>Run transcription process using media-processing pipeline |
| RonGharbo.12.2.20 | 6afb55ca-decd-434c-b61c-ab53fa2aa2ef | N/A | missing-transcript | No | None | None | Create transcript from audio or video file<br>Run transcription process using media-processing pipeline |
| Porges.Lederman.Acute Pain | ae87f0a6-876b-425a-918a-309709bcb390 | N/A | missing-transcript | No | None | None | Create transcript from audio or video file<br>Run transcription process using media-processing pipeline |
| Gharbo.1.28.21 | ae7885d0-37b0-4102-a7e0-ded5d80aa349 | N/A | missing-transcript | No | None | None | Create transcript from audio or video file<br>Run transcription process using media-processing pipeline |
| DR Cawson.9.1.21 | 50ee2adb-8a44-4d45-9e8f-f2febad759b5 | N/A | missing-transcript | No | video | None | Create transcript from audio or video file<br>Run transcription process using media-processing pipeline |
| Panda.circadian.medicine.10.16.24 | c40df3ea-3b1b-4c1c-989a-86460e69c635 | N/A | missing-transcript | No | video | None | Create transcript from audio or video file<br>Run transcription process using media-processing pipeline |
| Kate Wolovsky.2.3.21 | be823236-6eb2-430d-98fa-34ab25cdff5a | N/A | missing-transcript | No | None | None | Create transcript from audio or video file<br>Run transcription process using media-processing pipeline |
| 1.18.23.Bezruchka.Population Health | 548d06ba-71fa-4e8b-8481-94d58604a5cc | N/A | missing-transcript | No | video | None | Create transcript from audio or video file<br>Run transcription process using media-processing pipeline |
| Carter.8.26.20 | 169db4b8-f580-48fd-8abb-c8c67d378848 | N/A | missing-transcript | No | video | None | Create transcript from audio or video file<br>Run transcription process using media-processing pipeline |
| GMT20201001-000428_BIC-Q-A_640x360 | a12668ac-0cd7-42ac-a93e-5efa3c46ad4e | N/A | missing-transcript | No | None | None | Create transcript from audio or video file<br>Run transcription process using media-processing pipeline |
| Wager.2.1.23 | 6a1a8cfb-ff4c-43c0-a087-8b7fea7efc56 | N/A | missing-transcript | No | None | None | Create transcript from audio or video file<br>Run transcription process using media-processing pipeline |
| Sue Carter.SexDiff.CP | 7ec108bc-7634-41bd-a6c5-1e65acd9df2b | N/A | missing-transcript | No | video | None | Create transcript from audio or video file<br>Run transcription process using media-processing pipeline |
| Ring of Fire.7.7.20 | 535887b5-1a2b-4681-aa0d-6bfc7b36ed31 | N/A | missing-transcript | No | None | None | Create transcript from audio or video file<br>Run transcription process using media-processing pipeline |
| Marilyn Sanders.10.20.21 | b51020f8-60b8-43d2-8f90-0d10293edfd0 | N/A | missing-transcript | No | None | None | Create transcript from audio or video file<br>Run transcription process using media-processing pipeline |
| S.Othmer.12.09.20.Neuroregulation | d4a7096c-0bab-4dce-8cde-5afd8afdbe24 | N/A | missing-transcript | No | None | None | Create transcript from audio or video file<br>Run transcription process using media-processing pipeline |
| Yoni Asher.2.15.23 | 23b64868-b0db-4440-af30-a6157330d039 | N/A | missing-transcript | No | None | None | Create transcript from audio or video file<br>Run transcription process using media-processing pipeline |
| Steve Cole.Social Expression.#2 | 53c304c9-ed1c-4ae6-8add-47e615b4048e | N/A | missing-transcript | No | None | None | Create transcript from audio or video file<br>Run transcription process using media-processing pipeline |
| Staats.Clawson | 2fb73b30-341d-494b-9c28-e8417491d901 | N/A | missing-transcript | No | None | None | Create transcript from audio or video file<br>Run transcription process using media-processing pipeline |
| Lustig.Amygdala.1.8.25 | f545bd1d-9be3-49a7-b366-82ba687db947 | N/A | missing-transcript | No | video | None | Create transcript from audio or video file<br>Run transcription process using media-processing pipeline |
| Naviaux.4.21.21 | c6b47531-9539-463f-909c-fd5eb2fe6a37 | N/A | missing-transcript | No | None | None | Create transcript from audio or video file<br>Run transcription process using media-processing pipeline |
| Schubiner.1.13.21 | 0ddf1fc0-492c-46f1-80a8-1a899ec863d2 | N/A | missing-transcript | No | None | None | Create transcript from audio or video file<br>Run transcription process using media-processing pipeline |
| Akparian.Q&A.7.1.20 | 74f20d36-c5a0-4e4d-a9c7-d05e89f8bdfd | N/A | missing-transcript | No | video | None | Create transcript from audio or video file<br>Run transcription process using media-processing pipeline |
| Gervitz.3.24.21 | c4603e54-f688-4058-97c1-94e5a6270369 | N/A | missing-transcript | No | None | None | Create transcript from audio or video file<br>Run transcription process using media-processing pipeline |
| Wilkinson.9.15.24 | ee8ad893-7a8b-4e3e-aeb9-4977e7786ca8 | N/A | missing-transcript | No | video | None | Create transcript from audio or video file<br>Run transcription process using media-processing pipeline |
| Gevirtz.3.10.21 | 97bb9985-355c-475a-93c0-366205d40bb7 | N/A | missing-transcript | No | None | None | Create transcript from audio or video file<br>Run transcription process using media-processing pipeline |
| Sue Carter talk 9-21-2022 | 101ce661-c2df-44d5-90bf-c653535fa8d4 | N/A | missing-transcript | No | video | None | Create transcript from audio or video file<br>Run transcription process using media-processing pipeline |
| Overman.11.17.21 | 59057085-2d01-421e-8bcd-6830b53449bc | N/A | missing-transcript | No | None | None | Create transcript from audio or video file<br>Run transcription process using media-processing pipeline |
| Sabey.11.1.23.Positive Programming | ceb37a3e-f977-4b45-a49a-35b54f86a002 | N/A | missing-transcript | No | None | None | Create transcript from audio or video file<br>Run transcription process using media-processing pipeline |
| Naviaux.Mitochondria.chronic Disease | 13becfd3-a46c-4339-86d6-f48706e4d4c3 | N/A | missing-transcript | No | None | None | Create transcript from audio or video file<br>Run transcription process using media-processing pipeline |
| CNS.ANS.Stimulation.Wager.5.27.20 | 03a81eb9-e1ab-44cd-b328-926bcb14cf32 | N/A | missing-transcript | No | video | None | Create transcript from audio or video file<br>Run transcription process using media-processing pipeline |
| Lederman.4.4.24 | c252a4c5-92f7-49fa-9aed-6d20560c666f | N/A | missing-transcript | No | None | None | Create transcript from audio or video file<br>Run transcription process using media-processing pipeline |
| Eagle.Armster.12.16.20 | 45432399-5e74-4f19-ba9a-27613cd04e80 | N/A | missing-transcript | No | video | None | Create transcript from audio or video file<br>Run transcription process using media-processing pipeline |
| Hanscom.11.11.20 | b20bb858-dbf0-4ee3-92a3-769f08cba72c | N/A | missing-transcript | No | None | None | Create transcript from audio or video file<br>Run transcription process using media-processing pipeline |
| Luskin.3.17.21 | 84ca511b-d39b-4372-b397-f61a6d74d6aa | N/A | missing-transcript | No | None | None | Create transcript from audio or video file<br>Run transcription process using media-processing pipeline |
| MedSchoolTraining.WHitaker | 54522d9e-c541-4421-9091-95cab6815a29 | N/A | missing-transcript | No | None | None | Create transcript from audio or video file<br>Run transcription process using media-processing pipeline |
| Gervitz.3.24.21 | be5f38d9-e6ea-419a-805d-562b05659e84 | N/A | missing-transcript | No | None | None | Create transcript from audio or video file<br>Run transcription process using media-processing pipeline |
| Valery Grinevich 2-4-2024 video | 087a47cd-3a44-4121-9d13-9b6bf45bb65c | N/A | missing-transcript | No | None | None | Create transcript from audio or video file<br>Run transcription process using media-processing pipeline |
| Tauben.Sullivan.4.20.22 | ec79babd-ee7f-4a56-b9ab-877e58d2625f | N/A | missing-transcript | No | None | None | Create transcript from audio or video file<br>Run transcription process using media-processing pipeline |
| Porges.1.20.21 | 7f5c49fd-bc23-425f-af54-08981b5e1d4c | N/A | missing-transcript | No | None | None | Create transcript from audio or video file<br>Run transcription process using media-processing pipeline |
| Allan Abbass presentation Apr 6 2022 | 6faf9fd5-5f73-4fb7-b51d-faa68d43d6c8 | N/A | missing-transcript | No | video | None | Create transcript from audio or video file<br>Run transcription process using media-processing pipeline |
| DHG.12.7.22.Nicole Restauri.Music and Healing | 17519552-a0d3-461f-967d-f78f307531dc | N/A | missing-transcript | No | video | None | Create transcript from audio or video file<br>Run transcription process using media-processing pipeline |
| Neil.Nathan.11.16.22 | f7b7ba54-c71d-4542-8c95-c1b67d525c82 | N/A | missing-transcript | No | None | None | Create transcript from audio or video file<br>Run transcription process using media-processing pipeline |
| OpenDiscuss.PVT.CNS.6.24.20 | 5031f08c-ac35-41fc-8794-8c54fb8a7184 | N/A | missing-transcript | No | video | None | Create transcript from audio or video file<br>Run transcription process using media-processing pipeline |
| Ian Harris.MSK Surgery and Pain.5.4.22 | 6761caa1-d28f-400b-a770-dd5eb773cc1e | N/A | missing-transcript | No | None | None | Create transcript from audio or video file<br>Run transcription process using media-processing pipeline |
| Meredith.10.18.23 | a032dcdc-4474-4abb-898a-75103ae3d938 | N/A | missing-transcript | No | None | None | Create transcript from audio or video file<br>Run transcription process using media-processing pipeline |
| Garland.Tall Poppy | 67766945-3dd4-42c2-a832-6bef8dce247e | N/A | missing-transcript | No | video | None | Create transcript from audio or video file<br>Run transcription process using media-processing pipeline |
| video1168985783 | 021696d8-e805-4012-9349-86086a6e649d | N/A | missing-transcript | No | None | None | Create transcript from audio or video file<br>Run transcription process using media-processing pipeline |
| NP.Discussion Group..6.24.20 | 30881b33-0eae-48a3-9d02-e2a686f946e5 | N/A | missing-transcript | No | None | None | Create transcript from audio or video file<br>Run transcription process using media-processing pipeline |
| Naviaux.3.2.22.Mito.metab | 0f1cdc2d-950a-4f5e-8ead-12299c0cc100 | N/A | missing-transcript | No | None | None | Create transcript from audio or video file<br>Run transcription process using media-processing pipeline |
| Pandi.2.24.21 | f24aaafd-e4e2-436f-9524-3fa78245ff0e | N/A | missing-transcript | No | None | None | Create transcript from audio or video file<br>Run transcription process using media-processing pipeline |
| PVT.Cytokines.Oxytocin.5.13.20 | 22fdc7db-3b7a-4ef1-bacd-9a8cead1831e | N/A | missing-transcript | No | video | None | Create transcript from audio or video file<br>Run transcription process using media-processing pipeline |
| 8.18.21.Mel Pohl | 514628e0-ab8c-4416-a4c0-f8b8e66a3fba | N/A | missing-transcript | No | video | None | Create transcript from audio or video file<br>Run transcription process using media-processing pipeline |
| 6.10.10.Anger.Sympathetic | 7c117eee-5e9f-4622-89ac-0f9610384f96 | N/A | missing-transcript | No | video | None | Create transcript from audio or video file<br>Run transcription process using media-processing pipeline |
| David Arndt.8.5.20 | 88242db9-0374-4023-ad38-38baf824d5a8 | N/A | missing-transcript | No | video | None | Create transcript from audio or video file<br>Run transcription process using media-processing pipeline |
| Simonsson.1.9.22 | ac1835ee-0afa-4efc-b584-6d5dc885e07d | N/A | missing-transcript | No | None | None | Create transcript from audio or video file<br>Run transcription process using media-processing pipeline |
| Lustig.Metabolism.Inflammation.Sugar | d4d4cf2a-770a-4cd2-ae46-6f7b1705b47e | N/A | missing-transcript | No | None | None | Create transcript from audio or video file<br>Run transcription process using media-processing pipeline |
| Clawson.Anger | fba43200-8fb8-48e3-9f33-432b67f4e514 | N/A | missing-transcript | No | video | None | Create transcript from audio or video file<br>Run transcription process using media-processing pipeline |
| Porges.Poly.8.19.20 | 7c4778cb-b660-431f-a9f0-0cb64072bae8 | N/A | missing-transcript | No | None | None | Create transcript from audio or video file<br>Run transcription process using media-processing pipeline |
| Horn.Carter.1.19.22.OXY.Love.Longevity | 9c6d90a0-8985-43ed-b104-2435d8a88566 | N/A | missing-transcript | No | video | None | Create transcript from audio or video file<br>Run transcription process using media-processing pipeline |
| video1202452101 | 011c1202-d0b6-4c5f-966e-6f84eb0e31f8 | N/A | missing-transcript | No | None | None | Create transcript from audio or video file<br>Run transcription process using media-processing pipeline |
| Wager.7.15.20 | 6b5730e7-933e-434b-a0ee-6de4488d16cc | N/A | missing-transcript | No | None | None | Create transcript from audio or video file<br>Run transcription process using media-processing pipeline |
| Aria.Porges.SSP | 577d7d5f-8d22-4969-b9dc-8d328fb0e6a7 | N/A | missing-transcript | No | video | None | Create transcript from audio or video file<br>Run transcription process using media-processing pipeline |
| Steve Cole.6.3.21 | 80cad99e-6d25-4d92-9323-ea433deeea82 | N/A | missing-transcript | No | None | None | Create transcript from audio or video file<br>Run transcription process using media-processing pipeline |
| Germer.Shame.Self Compassion | 90c1f1ab-71be-421c-b3c9-11995c521b62 | N/A | missing-transcript | No | None | None | Create transcript from audio or video file<br>Run transcription process using media-processing pipeline |
| Emotional vs physical pain | d000f9be-955a-42b4-be48-9329bb9f39fc | N/A | missing-transcript | No | video | None | Create transcript from audio or video file<br>Run transcription process using media-processing pipeline |
| Matt Lederman | 930ae34f-5083-458c-ba2d-45112d74c199 | N/A | missing-transcript | No | None | None | Create transcript from audio or video file<br>Run transcription process using media-processing pipeline |
| Cytokine Q&A.11.4.20 | 5047ce94-4654-4033-b2b8-1bec2f5f1c5a | N/A | missing-transcript | No | video | None | Create transcript from audio or video file<br>Run transcription process using media-processing pipeline |
| Anderson.Osteoporosis.inflammation.5.18.22 | 41c7e517-4c19-49f4-bba1-77643f1e8d66 | N/A | missing-transcript | No | video | None | Create transcript from audio or video file<br>Run transcription process using media-processing pipeline |
| Dale.Moral Injury.Health Care | cf53db47-cdc3-4bff-9314-1255c97f0f27 | N/A | missing-transcript | No | video | None | Create transcript from audio or video file<br>Run transcription process using media-processing pipeline |
| Horn.Carter.10.5.22 | 9786df52-6c9a-4286-ac13-3dcbafa6140b | N/A | missing-transcript | No | video | None | Create transcript from audio or video file<br>Run transcription process using media-processing pipeline |
| 3.15.23.Tamara Turner.Dance.Trance | 7d422766-29de-47ac-a1f4-8299e07b10d1 | N/A | missing-transcript | No | video | None | Create transcript from audio or video file<br>Run transcription process using media-processing pipeline |
| Clawson.sapiocortex.anger | 5bd4c58e-e1a3-4f97-b291-fb6a543e0bcd | N/A | missing-transcript | No | video | None | Create transcript from audio or video file<br>Run transcription process using media-processing pipeline |
| Wager.Placebo.2.2.22 | 0acd765b-820d-4a8e-8543-ae36938da0c8 | N/A | missing-transcript | No | video | None | Create transcript from audio or video file<br>Run transcription process using media-processing pipeline |
| From Flight to Faint.11.18.20 | a22e932b-5f38-41f2-979b-b512589c1934 | N/A | missing-transcript | No | None | None | Create transcript from audio or video file<br>Run transcription process using media-processing pipeline |
| Cook.Clawson.5.22.244 | 43f9fb80-cde9-4187-be7f-52855f8ecea6 | N/A | missing-transcript | No | video | None | Create transcript from audio or video file<br>Run transcription process using media-processing pipeline |
| Amster.Eagle.2.10.21 | 8df8ff3a-2b2c-4b75-8810-ffc11f011da6 | N/A | missing-transcript | No | video | None | Create transcript from audio or video file<br>Run transcription process using media-processing pipeline |
| Oxytocin,neuromod7.29.20 | 17fbfe62-5b86-4408-8f2a-a07d8faf4115 | N/A | missing-transcript | No | None | None | Create transcript from audio or video file<br>Run transcription process using media-processing pipeline |
| 3.29.23.Miller.Mast Cells | 241f6e43-969a-47e4-8eaf-4c6cafbc634b | N/A | missing-transcript | No | video | None | Create transcript from audio or video file<br>Run transcription process using media-processing pipeline |
| DHDG.2.21.24.open Discussion | 98d477ab-1dcf-44da-8b8d-50cad84d8dae | N/A | missing-transcript | No | video | None | Create transcript from audio or video file<br>Run transcription process using media-processing pipeline |
| Halaris.8.4.21.Mental Pain | e95f2404-ce5f-43e5-af4c-ff7f9765e55e | N/A | missing-transcript | No | None | None | Create transcript from audio or video file<br>Run transcription process using media-processing pipeline |
| Robert Dantzer | cc0c0edf-9e40-4eba-8b89-8f33dd4a26e6 | N/A | missing-transcript | No | None | None | Create transcript from audio or video file<br>Run transcription process using media-processing pipeline |
| 10.4.23.Hanscom:Clawson | 7c08125a-d220-4a6f-a087-47f568b0b0e2 | N/A | missing-transcript | No | video | None | Create transcript from audio or video file<br>Run transcription process using media-processing pipeline |
| 5.8.24Kjearvik | ea48930b-1301-46da-accd-0be3a6b2848b | N/A | missing-transcript | No | video | None | Create transcript from audio or video file<br>Run transcription process using media-processing pipeline |
| Matt and Alona.10.21.20 | a49057d6-3389-4307-b057-4f8dac710b56 | N/A | missing-transcript | No | None | None | Create transcript from audio or video file<br>Run transcription process using media-processing pipeline |
| Stellate Blocks.Lipov.Springer.8.12.20 | 64c1da7b-b8e7-42a3-9644-af170db9d73f | N/A | missing-transcript | No | None | None | Create transcript from audio or video file<br>Run transcription process using media-processing pipeline |
| Navaux.4.17.24 | 28a7ebef-b9d0-4ea4-9c44-4604bf73c4cd | N/A | missing-transcript | No | None | None | Create transcript from audio or video file<br>Run transcription process using media-processing pipeline |
| Horn.Fasting.9.6.23 | 42020c2a-e397-45ec-b3a3-77d59082e815 | N/A | missing-transcript | No | video | None | Create transcript from audio or video file<br>Run transcription process using media-processing pipeline |
| 6.3.20.Vagal Stim | 36bd9f6a-e3eb-4c7d-bc0a-cdc650d68dde | N/A | missing-transcript | No | video | None | Create transcript from audio or video file<br>Run transcription process using media-processing pipeline |
| 03.08.24.Landenecker | 2ddffadc-bf6e-452b-b98b-8b7b48ce831a | N/A | missing-transcript | No | video | None | Create transcript from audio or video file<br>Run transcription process using media-processing pipeline |
| 7.22.20.ANS.Safetyvs.Threat | 8ab0f3b5-afb6-4221-a515-d11a7b71b125 | N/A | missing-transcript | No | video | None | Create transcript from audio or video file<br>Run transcription process using media-processing pipeline |
| Tarnppolsky12.15.21 | 76792044-7cc5-4062-bf10-e67339af256c | N/A | missing-transcript | No | None | None | Create transcript from audio or video file<br>Run transcription process using media-processing pipeline |
| Abernathy.2.16.22.PVT and Medicine | 05c5e00c-6979-460c-ba85-1ef1e3986e17 | N/A | missing-transcript | No | video | None | Create transcript from audio or video file<br>Run transcription process using media-processing pipeline |
| 9.7.22.Aria.Porges.SSP | b52fd645-fa92-404c-a8c7-a674b10bc631 | N/A | missing-transcript | No | video | None | Create transcript from audio or video file<br>Run transcription process using media-processing pipeline |
| Wager.Intro.Networks.Intro.6.17.20 | 24f53497-1b6c-4bf0-8963-b60dca2d3411 | N/A | missing-transcript | No | None | None | Create transcript from audio or video file<br>Run transcription process using media-processing pipeline |
| 5.20.20.Flight to Freeze | 32846b7f-5a5d-4622-9964-194f7853f08e | N/A | missing-transcript | No | video | None | Create transcript from audio or video file<br>Run transcription process using media-processing pipeline |
| 6.16.21.DR Clawson.The very bottom up | 97eda0ba-1007-4854-9f8c-071d6aecb582 | N/A | missing-transcript | No | video | None | Create transcript from audio or video file<br>Run transcription process using media-processing pipeline |
| 10.14.20.Aria.Patterson.Carter.Social Connection | 3c80d81d-db0a-441a-8052-3be069ebc23e | N/A | missing-transcript | No | video | None | Create transcript from audio or video file<br>Run transcription process using media-processing pipeline |
| Naviaux.DR.1.24.24 | 514732d5-8186-4d77-bb34-7c9dda32cd75 | N/A | missing-transcript | No | video | None | Create transcript from audio or video file<br>Run transcription process using media-processing pipeline |
| 11.2.22.Staats | 02e1adeb-9f57-4c58-af21-d7a094147955 | N/A | missing-transcript | No | video | None | Create transcript from audio or video file<br>Run transcription process using media-processing pipeline |


2025-04-06T19:24:58.553Z [info]: Reviewed 112 presentations.
raybunnage@Rays-Laptop dhg-mono % 