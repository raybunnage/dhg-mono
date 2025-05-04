# Media Processing CLI Pipeline Documentation

## Overview

The Media Processing CLI Pipeline is a comprehensive toolset for managing the complete lifecycle of media files, from discovery and copying through conversion, database integration, and transcription. This system streamlines the workflow of processing video and audio content to make it ready for analysis.

The pipeline handles these key processes:
- Finding and copying media files from external sources (e.g., Google Drive)
- Renaming files to match database conventions
- Registering files in the Supabase database
- Managing expert documents and presentation assets
- Converting MP4 video files to M4A audio files
- Transcribing audio content using Whisper AI
- Cleaning up processed files

## Table of Contents

1. [Installation & Setup](#installation--setup)
2. [Basic Command Structure](#basic-command-structure)
3. [Complete Media Processing Workflow](#complete-media-processing-workflow)
   - [Processing Videos End-to-End](#processing-videos-end-to-end)
   - [Using batch-process-media](#using-batch-process-media)
4. [Individual Commands](#individual-commands)
   - [File Finding & Copying](#file-finding--copying)
   - [Database Integration](#database-integration)
   - [File Conversion](#file-conversion)
   - [Transcription](#transcription)
   - [File Management](#file-management)
5. [Common Usage Patterns](#common-usage-patterns)
6. [Troubleshooting](#troubleshooting)

## Installation & Setup

The CLI tools are already integrated into the project structure and require no additional installation. However, you need to ensure:

1. Environment variables are properly configured in `.env`, `.env.local`, and `.env.development` files
2. Supabase connection credentials are valid
3. The appropriate directory structure exists:
   - `file_types/mp4/` - For video files
   - `file_types/m4a/` - For audio files
   - `file_types/transcripts/` - For transcription outputs

## Basic Command Structure

All commands in the media processing pipeline follow this basic structure:

```bash
scripts/cli-pipeline/media-processing/media-processing-cli.sh [command] [options]
```

To get help for a specific command:

```bash
scripts/cli-pipeline/media-processing/media-processing-cli.sh [command] --help
```

For general help and to see all available commands:

```bash
scripts/cli-pipeline/media-processing/media-processing-cli.sh --help
```

## Complete Media Processing Workflow

### Processing Videos End-to-End

The typical end-to-end workflow for processing videos involves the following steps:

1. **Find and copy media files** from Google Drive
2. **Rename files** to match database conventions
3. **Register files** in the database
4. **Update disk status** information
5. **Register expert documents** for these files
6. **Convert MP4 to M4A** for audio extraction
7. **Synchronize M4A filenames** with MP4 files
8. **Transcribe audio** using Whisper

While you could run each of these steps individually with separate commands, the `batch-process-media` command streamlines the entire workflow.

### Using batch-process-media

The `batch-process-media` command orchestrates the full workflow:

```bash
scripts/cli-pipeline/media-processing/media-processing-cli.sh batch-process-media [options]
```

#### Key Options

- `--limit <number>`: Process a specified number of files (default: 25)
- `--source <path>`: Specify the source directory for files (default: ~/Google Drive)
- `--model <model>`: Specify Whisper model to use (default: base)
- `--accelerator <type>`: Specify hardware accelerator (default: T4)
- `--dry-run`: Show what would be done without actually making changes

#### Skip Options

You can skip any step of the process with these options:
- `--skip-copy`: Skip the copy step
- `--skip-rename`: Skip the rename step
- `--skip-register`: Skip registering files in the database
- `--skip-disk-status`: Skip updating disk status
- `--skip-expert-docs`: Skip registering expert documents
- `--skip-conversion`: Skip MP4 to M4A conversion
- `--skip-m4a-sync`: Skip M4A filename synchronization
- `--skip-transcription`: Skip audio transcription

#### Step-by-Step Example

Here's a typical approach to process media files:

1. **Start with a dry run** to see what would happen:
   ```bash
   scripts/cli-pipeline/media-processing/media-processing-cli.sh batch-process-media --dry-run --limit 5
   ```

2. **Process a small batch** of files to verify everything works:
   ```bash
   scripts/cli-pipeline/media-processing/media-processing-cli.sh batch-process-media --limit 5
   ```

3. **Process remaining files** while skipping already completed steps:
   ```bash
   scripts/cli-pipeline/media-processing/media-processing-cli.sh batch-process-media --skip-copy --skip-rename --limit 10
   ```

4. **Check transcription status** after processing:
   ```bash
   scripts/cli-pipeline/media-processing/media-processing-cli.sh show-transcription-status
   ```

5. **Clean up processed files** when done:
   ```bash
   scripts/cli-pipeline/media-processing/media-processing-cli.sh purge-processed-media --dry-run
   ```

## Individual Commands

### File Finding & Copying

#### find-missing-media

Finds missing MP4 files in Google Drive and generates copy commands.

```bash
scripts/cli-pipeline/media-processing/media-processing-cli.sh find-missing-media [options]
```

Options:
- `--limit <number>`: Limit the number of files to list (default: 25)
- `--source <path>`: Source directory to search (default: ~/Google Drive)
- `--format <format>`: Output format (commands, list, json)
- `--deep`: Perform deep search through subdirectories

Example:
```bash
scripts/cli-pipeline/media-processing/media-processing-cli.sh find-missing-media --deep --limit 10
```

#### find-processable-videos

Finds MP4 files that are ready for processing.

```bash
scripts/cli-pipeline/media-processing/media-processing-cli.sh find-processable-videos [options]
```

Options:
- `--auto-process`: Automatically process found files

### Database Integration

#### register-local-mp4-files

Registers local MP4 files in the Supabase database.

```bash
scripts/cli-pipeline/media-processing/media-processing-cli.sh register-local-mp4-files [options]
```

Options:
- `--dry-run`: Show what would be registered without making changes
- `--force`: Register files even if similar filenames exist
- `--specific-files <list>`: Only register specific files (comma-separated list)

#### update-disk-status

Updates the database with file status on disk.

```bash
scripts/cli-pipeline/media-processing/media-processing-cli.sh update-disk-status [options]
```

Options:
- `--dry-run`: Show what would be updated without making changes
- `--force`: Process all presentations even if they already have disk status

#### register-expert-docs

Registers MP4 files as expert documents in the database.

```bash
scripts/cli-pipeline/media-processing/media-processing-cli.sh register-expert-docs [options]
```

Options:
- `--dry-run`: Show what would be created without making changes
- `--limit <number>`: Limit the number of presentations to process

### File Conversion

#### rename-mp4-files

Renames MP4 files to match database naming conventions.

```bash
scripts/cli-pipeline/media-processing/media-processing-cli.sh rename-mp4-files [options]
```

Options:
- `--dry-run`: Show what would be renamed without making changes
- `--force`: Rename even if destination files already exist
- `--generate-map`: Generate a CSV mapping file
- `--skip-sync`: Skip automatic M4A filename synchronization

#### convert-mp4

Converts MP4 files to M4A format for audio extraction.

```bash
scripts/cli-pipeline/media-processing/media-processing-cli.sh convert-mp4 [fileId|path] [options]
```

Options:
- `--dry-run`: Show what would be converted without processing
- `--limit <number>`: Number of files to process at once
- `--output <path>`: Specify output directory

#### sync-m4a-names

Synchronizes M4A filenames with their corresponding MP4 files.

```bash
scripts/cli-pipeline/media-processing/media-processing-cli.sh sync-m4a-names [options]
```

Options:
- `--dry-run`: Show what would be renamed without making changes
- `--force`: Rename even if destination files already exist
- `--after-rename`: Run after renaming MP4 files

### Transcription

#### transcribe-audio

Transcribes audio files to text using Whisper.

```bash
scripts/cli-pipeline/media-processing/media-processing-cli.sh transcribe-audio [fileId|path] [options]
```

Options:
- `--model <model>`: Whisper model to use (tiny, base, small, etc.)
- `--accelerator <type>`: Hardware accelerator (T4, A10G, A100, CPU)
- `--limit <number>`: Number of files to process at once
- `--file <file>`: Process a specific file

#### transcribe-with-summary

Transcribes audio and generates a summary.

```bash
scripts/cli-pipeline/media-processing/media-processing-cli.sh transcribe-with-summary [options]
```

Options:
- `--model <model>`: Whisper model to use
- `--file <file>`: Process a specific file

### File Management

#### list-pending

Lists files pending processing.

```bash
scripts/cli-pipeline/media-processing/media-processing-cli.sh list-pending [options]
```

#### list-ready

Lists files ready for content generation.

```bash
scripts/cli-pipeline/media-processing/media-processing-cli.sh list-ready [options]
```

#### list-transcribable

Lists files ready for transcription with copy-paste commands.

```bash
scripts/cli-pipeline/media-processing/media-processing-cli.sh list-transcribable [options]
```

#### show-transcription-status

Shows detailed status of transcriptions and processing times.

```bash
scripts/cli-pipeline/media-processing/media-processing-cli.sh show-transcription-status [options]
```

#### purge-processed-media

Removes processed MP4 and M4A files that have been successfully processed.

```bash
scripts/cli-pipeline/media-processing/media-processing-cli.sh purge-processed-media [options]
```

Options:
- `--dry-run`: Show what would be deleted without removing files
- `--force`: Delete without confirmation
- `--days <number>`: Only purge files processed more than X days ago

## Common Usage Patterns

### Incremental Processing

When processing a large batch of files, it's often best to work incrementally:

1. **Initial discovery and copying**:
   ```bash
   scripts/cli-pipeline/media-processing/media-processing-cli.sh batch-process-media --limit 10 --skip-transcription
   ```

2. **Continue with remaining database steps**:
   ```bash
   scripts/cli-pipeline/media-processing/media-processing-cli.sh batch-process-media --limit 10 --skip-copy --skip-rename
   ```

3. **Handle transcription separately** (often resource-intensive):
   ```bash
   scripts/cli-pipeline/media-processing/media-processing-cli.sh batch-process-media --skip-copy --skip-rename --skip-register --skip-disk-status --skip-expert-docs --skip-conversion --skip-m4a-sync --limit 10
   ```

### Status Checking

Regularly check the status of your processing pipeline:

```bash
# Check files waiting for processing
scripts/cli-pipeline/media-processing/media-processing-cli.sh list-pending

# Check files ready for transcription
scripts/cli-pipeline/media-processing/media-processing-cli.sh list-transcribable

# Check transcription status
scripts/cli-pipeline/media-processing/media-processing-cli.sh show-transcription-status
```

### Recovery From Failures

If a step fails during processing:

1. **Identify the failure point** using status commands
2. **Resume processing** by skipping completed steps
3. Use targeted commands for specific failures

## Troubleshooting

### Common Issues

1. **File not found errors**:
   - Verify source paths are correct
   - Check file permissions
   - Ensure Google Drive is properly mounted

2. **Database connection errors**:
   - Verify Supabase credentials in environment files
   - Check network connectivity

3. **Transcription failures**:
   - Check if audio file is valid
   - Verify Whisper API access
   - Try a different hardware accelerator

4. **File naming collisions**:
   - Use the `--force` option carefully to override
   - Check results with `--dry-run` first

### Debugging Tips

1. Always start with `--dry-run` to preview actions
2. Use smaller `--limit` values when diagnosing issues
3. Check log files in `_archive/debug-logs/` for detailed information
4. Run individual commands instead of the full batch process to isolate problems

### Getting Help

For more detailed help, you can:
- Use the `--help` option with any command
- Check the source code in `scripts/cli-pipeline/media-processing/`
- Refer to related documentation in the `docs/cli-pipeline/` directory