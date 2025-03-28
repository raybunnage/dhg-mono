# Claude Code Assistant Documentation

This file documents the files created and updated by Claude Code in the code documentation directory.

## Code Documentation Files

These files were created to document various components of the system:

1. `docs/code-documentation/AI-documentation.md`
2. `docs/code-documentation/Classify-documentation.md`
3. `docs/code-documentation/Cmds-documentation.md`
4. `docs/code-documentation/Code-documentation.md`
5. `docs/code-documentation/Docs-documentation.md`
6. `docs/code-documentation/Experts-documentation.md`
7. `docs/code-documentation/Gmail-documentation.md`
8. `docs/code-documentation/Guts-documentation.md`
9. `docs/code-documentation/Home-documentation.md`
10. `docs/code-documentation/Scripts-documentation.md`
11. `docs/code-documentation/Show-documentation.md`
12. `docs/code-documentation/Supabase-documentation.md`
13. `docs/code-documentation/Sync-documentation.md`
14. `docs/code-documentation/Transcribe-documentation.md`
15. `docs/code-documentation/Viewer-documentation.md`
16. `docs/code-documentation/Viewer2-documentation.md`
17. `docs/code-documentation/Write-documentation.md`
18. `docs/code-documentation/code-maintainability-score.md`
19. `docs/code-documentation/improving-code-maintainability.md`
20. `docs/code-documentation/maintainability-assessment-guide.md`
21. `docs/code-implementation/code-refactoring-priority-guide.md`

## CLI Pipeline Service Documentation

The following documentation files in the `docs/cli-pipeline` folder describe various services in the CLI pipeline:

### Recently Updated Service Documentation (March 23-24, 2025)

1. `docs/cli-pipeline/document-pipeline-documentation.md` (March 24)
2. `docs/cli-pipeline/document-organization-documentation.md` (March 23)
3. `docs/cli-pipeline/file-management-documentation.md` (March 23)
4. `docs/cli-pipeline/document-type-checker-documentation.md` (March 23)
5. `docs/cli-pipeline/script-claude-service-documentation.md` (March 23)
6. `docs/cli-pipeline/supabase-client-service-documentation.md` (March 23)
7. `docs/cli-pipeline/script-management-service-documentation.md` (March 23)
8. `docs/cli-pipeline/prompt-query-service-documentation.md` (March 23)
9. `docs/cli-pipeline/document-classification-service-documentation.md` (March 23)
10. `docs/cli-pipeline/supabase-service-documentation.md` (March 23)
11. `docs/cli-pipeline/report-service-documentation.md` (March 23)
12. `docs/cli-pipeline/file-service-documentation.md` (March 23)
13. `docs/cli-pipeline/claude-service-documentation.md` (March 23)

### Prompt-Related Documentation

1. `docs/cli-pipeline/prompt-lookup-script-analysis-prompt.md` (March 22)
2. `docs/cli-pipeline/prompt-lookup-markdown-document-classification-prompt.md` (March 21)

### General Documentation

1. `docs/cli-pipeline/CLI_PIPELINE_GUIDANCE.md` (March 19)
2. `docs/cli-pipeline/cli-pipeline-commands.md` (March 16)

## CLI Pipeline Scripts

The `scripts/cli-pipeline` directory contains numerous scripts for various tasks:

### Server Scripts
1. `simple-md-server.js` - Markdown file server
2. `simple-script-server.js` - Script file server
3. `docs-archive-server.js` - Document archive server

### Server Launcher Scripts
1. `start-md-server.sh` - Starts the markdown server
2. `start-script-server.sh` - Starts the script server
3. `start-archive-server.sh` - Starts the archive server

### Document Pipeline Scripts
1. `document-pipeline-main.sh` - Main document pipeline orchestrator
2. `document-pipeline-manager.sh` - Manages document pipeline execution
3. `document-summary-report.ts` - Generates document summary reports
4. `document-type-manager.ts` - Manages document types
5. `display-doc-paths.sh` - Displays document paths
6. `display-doc-paths.ts` - TypeScript version of document path display
7. `display-doc-paths-simple.ts` - Simplified document path display
8. `display-doc-paths-enhanced.ts` - Enhanced document path display
9. `show-doc-paths.sh` - Shows document paths
10. `show-doc-paths-enhanced.sh` - Enhanced document path visualization
11. `sync-markdown-files.sh` - Syncs markdown files
12. `sync-markdown-files.ts` - TypeScript version of markdown file sync

### Script Pipeline Scripts
1. `script-pipeline-main.sh` - Main script pipeline orchestrator
2. `script-manager.sh` - Manages scripts
3. `analyze-script.ts` - Analyzes scripts
4. `analyze-scripts.sh` - Orchestrates script analysis
5. `test-script-analyzer.ts` - Tests script analyzer
6. `classify-script-with-prompt.sh` - Classifies scripts using prompts
7. `classify-script-with-prompt.ts` - TypeScript version of script classification
8. `classify-untyped-script.js` - Classifies scripts without types
9. `classify-untyped-script.ts` - TypeScript version of untyped script classification
10. `show-untyped-scripts.sh` - Shows scripts without types
11. `check-duplicates.ts` - Checks for duplicate scripts

### AI and Prompt Management
1. `run-ai-analyze.sh` - Runs AI analysis
2. `prompt-lookup.sh` - Looks up prompts
3. `prompt-lookup.ts` - TypeScript version of prompt lookup
4. `check-claude-api-key.sh` - Checks Claude API key
5. `classify-document-with-prompt.sh` - Classifies documents using prompts
6. `setup-prompts.sh` - Sets up prompts
7. `validate-ai-assets.sh` - Validates AI assets
8. `validate-prompt-relationships.sh` - Validates prompt relationships

### Utility Scripts
1. `command-history-tracker.ts` - Tracks command history
2. `load-env.sh` - Loads environment variables
3. `run-sync.sh` - Runs sync operations
4. `test-env.sh` - Tests environment setup
5. `import-script-analysis.sh` - Imports script analysis

## Fix and Root Scripts

The following scripts handle system maintenance and database operations:

### Fix Scripts (`scripts/fix/`)

These scripts are designed to repair and fix various parts of the system:

1. `fix-ai-integration.sh` - Repairs AI integration (Mar 23)
2. `fix-batch-analyze.sh` - Fixes batch analysis functionality (Mar 23)
3. `fix-metadata-fields.js` - Corrects metadata fields (Mar 23)
4. `fix-metadata.sh` - Fixes metadata (Mar 23)
5. `fix-permissions.sh` - Repairs file and directory permissions (Mar 26)
6. `migrate-size-field.ts` - Migrates file size fields (Mar 24)
7. `supabase-connect.js` - Fixes Supabase connections (Mar 27)

### Root Scripts (`scripts/root/`)

These scripts handle core system operations:

1. `apply_execute_sql_rpc.sh` - Applies SQL RPC execution (Mar 17)
2. `backup-env.sh` - Backs up environment variables (Mar 20)
3. `check-export-function.js` - Validates export functions (Mar 5)
4. `classify-markdowns.sh` - Classifies markdown documents (Mar 20)
5. `clear-vite-cache.sh` - Clears Vite build cache (Mar 20)
6. `create-migration.sh` - Creates database migrations (Mar 20)
7. `deploy.sh` - Handles deployment (Mar 20)
8. `direct-db-sync.js` - Directly syncs with the database (Mar 20)
9. `ensure-sync-script.sh` - Ensures sync scripts are functioning (Mar 20)
10. `export-db-functions.js` - Exports database functions (Mar 5)
11. `final-sync.js` - Performs final synchronization (Mar 20)
12. `generate-function-types.js` - Generates function type definitions (Mar 2)
13. `generate-types.ts` - Generates TypeScript types (Feb 18)
14. `get-git-info.sh` - Retrieves git repository information (Feb 17)
15. `get-types.ts` - Gets TypeScript types (Feb 17)
16. `markdown-report.sh` - Generates markdown reports (Mar 20)
17. `migrate-cli-scripts.sh` - Migrates CLI scripts (Mar 20)
18. `process-documentation.ts` - Processes documentation files (Mar 20)
19. `restore-document-types.sh` - Restores document types (Mar 20)
20. `run-direct-sync.sh` - Runs direct database sync (Mar 20)
21. `run-sync-direct.sh` - Alternative direct sync runner (Mar 20)
22. `search-db-functions.js` - Searches database functions (Mar 20)
23. `set-permissions.sh` - Sets file permissions (Mar 20)
24. `setup-cli-package.sh` - Sets up CLI package (Mar 20)
25. `show-tree.js` - Shows directory tree structure (Mar 20)
26. `simple-db-query.sh` - Runs simple database queries (Mar 20)
27. `sync-scripts-direct.js` - Direct script synchronization (Mar 20)
28. `sync-scripts.sh` - Script synchronization (Mar 20)
29. `test-gitignore.sh` - Tests gitignore patterns (Mar 20)
30. `track.sh` - Tracks script usage (Mar 20)
31. `update-docs-database.sh` - Updates documentation database (Mar 20)
32. `verify-cli-scripts.sh` - Verifies CLI scripts (Mar 20)
33. `verify-document-types.sh` - Verifies document types (Mar 20)

## Audio Processing Scripts

The following scripts handle audio processing functionality:

### Python Audio Scripts (`scripts/python/`)

These scripts provide audio extraction and processing capabilities:

1. `clip_audio.py` - Clips audio files to specific lengths (Mar 26)
2. `clip_audio.sh` - Shell wrapper for audio clipping (Mar 26)
3. `clip_navaux.sh` - Clips the Navaux audio file (Mar 26)
4. `extract_audio.sh` - Extracts audio from media files (Mar 26)
5. `modal_audio_summarize.sh` - Summarizes audio using Modal (Mar 26)
6. `modal_process.py` - Modal-based audio processing (Mar 26)
7. `modal_process.sh` - Shell wrapper for Modal processing (Mar 26)
8. `modal_summary.py` - Generates summaries using Modal (Mar 26)
9. `modal_summary.sh` - Shell wrapper for Modal summaries (Mar 26)
10. `process_local.py` - Processes audio locally (Mar 26)
11. `summarize_audio.sh` - Summarizes audio content (Mar 26)
12. `whisper_audio.py` - Transcribes audio using Whisper (Mar 26)
13. `whisper_audio.sh` - Shell wrapper for Whisper transcription (Mar 26)

### Python Audio Processor Package (`packages/python-audio-processor/scripts/`)

These scripts are part of the dedicated audio processing package:

1. `audio_transcript_configurable.py` - Configurable audio transcription (Mar 27)
2. `base_audio_transcript.py` - Base audio transcription functionality (Mar 27)
3. `estimate_modal_time.sh` - Estimates Modal processing time (Mar 27)
4. `estimate_processing_time.py` - Estimates processing time (Mar 27)
5. `extract_audio_text.py` - Extracts text from audio (Mar 27)
6. `parallel_transcript.py` - Parallel audio transcription (Mar 26)
7. `process_m4a_summary.py` - Processes M4A files and creates summaries (Mar 26)
8. `process_m4a_transcript.py` - Transcribes M4A audio files (Mar 26)
9. `quick_audio_transcript.py` - Fast audio transcription (Mar 26)
10. `run_modal_test.sh` - Tests Modal functionality (Mar 27)
11. `run_text_extraction.sh` - Runs text extraction (Mar 27)
12. `test_modal_roundtrip.py` - Tests complete Modal processing (Mar 26)

