# Media Processing CLI Pipeline

A unified command-line interface for media processing tasks including converting MP4 files to M4A for audio extraction, transcribing audio files, checking media file status, and managing processed media files.

## Installation

Ensure you have Node.js and TypeScript installed:

```bash
npm install -g typescript ts-node
```

## Usage

```bash
ts-node scripts/cli-pipeline/media-processing/index.ts <command> [options]
```

### Available Commands

#### Media File Checking

```bash
# Check for missing or orphaned MP4/M4A files
ts-node scripts/cli-pipeline/media-processing/index.ts check-media-files

# Display only summary information
ts-node scripts/cli-pipeline/media-processing/index.ts check-media-files --summary

# Output results in JSON format
ts-node scripts/cli-pipeline/media-processing/index.ts check-media-files --json

# Run the JavaScript-based file checker (legacy)
ts-node scripts/cli-pipeline/media-processing/index.ts find-missing-js-files

# Run a shell script-based checker (legacy)
ts-node scripts/cli-pipeline/media-processing/index.ts run-shell-check
ts-node scripts/cli-pipeline/media-processing/index.ts run-shell-check --script mp4-files-check
ts-node scripts/cli-pipeline/media-processing/index.ts run-shell-check --script check-missing-mp4-files
```

#### Media Conversion

```bash
# Convert MP4 files to M4A for audio extraction
ts-node scripts/cli-pipeline/media-processing/index.ts convert-mp4

# Process all MP4 files
ts-node scripts/cli-pipeline/media-processing/index.ts convert-mp4 --all

# Process specific file
ts-node scripts/cli-pipeline/media-processing/index.ts convert-mp4 --file "filename.mp4"
```

#### Transcription

```bash
# Transcribe audio files to text
ts-node scripts/cli-pipeline/media-processing/index.ts transcribe-audio

# Transcribe with specific model
ts-node scripts/cli-pipeline/media-processing/index.ts transcribe-audio --model medium

# Transcribe audio files and generate summary
ts-node scripts/cli-pipeline/media-processing/index.ts transcribe-with-summary
```

#### File Management

```bash
# Delete processed media files that have been extracted 
ts-node scripts/cli-pipeline/media-processing/index.ts purge-processed-media

# Show what would be deleted without actually removing files
ts-node scripts/cli-pipeline/media-processing/index.ts purge-processed-media --dry-run

# Delete without confirmation
ts-node scripts/cli-pipeline/media-processing/index.ts purge-processed-media --force

# Only purge files processed more than 30 days ago
ts-node scripts/cli-pipeline/media-processing/index.ts purge-processed-media --days 30
```

#### Listing and Reporting

```bash
# List files ready for processing
ts-node scripts/cli-pipeline/media-processing/index.ts list-ready

# List files pending processing
ts-node scripts/cli-pipeline/media-processing/index.ts list-pending

# List files ready for transcription
ts-node scripts/cli-pipeline/media-processing/index.ts list-transcribable

# Find videos that can be processed
ts-node scripts/cli-pipeline/media-processing/index.ts find-processable-videos
```

## Shell Scripts

For convenience, several shell scripts have been included in the `shell-scripts` directory that provide similar functionality but can be run directly without TypeScript:

```bash
# Check missing MP4 files
scripts/cli-pipeline/media-processing/shell-scripts/check-missing-mp4-files.sh

# Compare MP4 files
scripts/cli-pipeline/media-processing/shell-scripts/compare-mp4-files.sh

# Find missing MP4 files
scripts/cli-pipeline/media-processing/shell-scripts/find-missing-mp4-files.sh

# Generate MP4 files summary
scripts/cli-pipeline/media-processing/shell-scripts/mp4-files-summary.sh
```

## Directory Structure

```
scripts/cli-pipeline/media-processing/
├── README.md              # This documentation
├── index.ts               # Main entry point for the CLI
├── commands/              # Command implementations
│   ├── check-media-files.ts
│   ├── convert-mp4.ts
│   ├── find-missing-js-files.ts
│   ├── find-processable-videos.ts
│   ├── list-pending.ts
│   ├── list-ready.ts
│   ├── list-transcribable.ts
│   ├── purge-processed-media.ts
│   ├── run-shell-check.ts
│   ├── transcribe-audio.ts
│   └── transcribe-with-summary.ts
├── js-scripts/            # Legacy JavaScript implementations
│   └── find-missing-mp4-files.js
└── shell-scripts/         # Bash script alternatives
    ├── check-missing-mp4-files.sh
    ├── compare-mp4-files.sh
    ├── find-missing-mp4-files.sh
    ├── find-mp4-missing-files.sh
    ├── mp4-files-check.sh
    └── mp4-files-summary.sh
```