# Media Processing CLI Pipeline

A unified command-line interface for media processing tasks including converting MP4 files to M4A for audio extraction, transcribing audio files, checking media file status, and managing processed media files. The pipeline also includes processing summaries, managing presentations, and linking assets.

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

#### Summary Processing

```bash
# Process a summary file and store in expert_documents
ts-node scripts/cli-pipeline/media-processing/index.ts process-summary <file>

# Save processed summary to database
ts-node scripts/cli-pipeline/media-processing/index.ts process-summary <file> --write-to-db

# Save processed summary to local file
ts-node scripts/cli-pipeline/media-processing/index.ts process-summary <file> --output-file <path>

# Specify AI summary format (short, medium, detailed)
ts-node scripts/cli-pipeline/media-processing/index.ts process-summary <file> --summary-type <type>

# Process multiple summary files in batch
ts-node scripts/cli-pipeline/media-processing/index.ts batch-process

# Specify directory containing summary files to process
ts-node scripts/cli-pipeline/media-processing/index.ts batch-process --directory <dir>

# Specify file pattern to match
ts-node scripts/cli-pipeline/media-processing/index.ts batch-process --pattern "*.txt"

# Specify output directory for processed summaries
ts-node scripts/cli-pipeline/media-processing/index.ts batch-process --output-dir <dir>
```

#### Presentation Management

```bash
# List all presentations
ts-node scripts/cli-pipeline/media-processing/index.ts manage-presentations --list

# Create a new presentation
ts-node scripts/cli-pipeline/media-processing/index.ts manage-presentations --create --title "My Presentation" --description "Description" --expert <id>

# Update an existing presentation
ts-node scripts/cli-pipeline/media-processing/index.ts manage-presentations --update <id> --title "Updated Title" --description "Updated Description"

# Delete a presentation
ts-node scripts/cli-pipeline/media-processing/index.ts manage-presentations --delete <id>

# Link assets to a presentation
ts-node scripts/cli-pipeline/media-processing/index.ts link-assets <presentation_id> --asset-type <type> --asset-id <id>

# Link a file as an asset to a presentation
ts-node scripts/cli-pipeline/media-processing/index.ts link-assets <presentation_id> --asset-type <type> --asset-file <file> --position <pos>

# List all assets linked to a presentation
ts-node scripts/cli-pipeline/media-processing/index.ts link-assets <presentation_id> --list

# Unlink an asset from a presentation
ts-node scripts/cli-pipeline/media-processing/index.ts link-assets <presentation_id> --unlink <id>
```

#### Status Checking and File Management

```bash
# Check processing status of summaries and presentations
ts-node scripts/cli-pipeline/media-processing/index.ts check-status

# Check status of a specific summary
ts-node scripts/cli-pipeline/media-processing/index.ts check-status --summary <id>

# Check status of a specific presentation
ts-node scripts/cli-pipeline/media-processing/index.ts check-status --presentation <id>

# Check status of all summaries
ts-node scripts/cli-pipeline/media-processing/index.ts check-status --all-summaries

# Check status of all presentations
ts-node scripts/cli-pipeline/media-processing/index.ts check-status --all-presentations

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
│   ├── batch-process.ts           # Process multiple summary files in batch
│   ├── check-media-files.ts       # Check for missing or orphaned media files
│   ├── check-status.ts            # Check processing status of summaries and presentations
│   ├── convert-mp4.ts             # Convert MP4 files to M4A for audio extraction
│   ├── find-missing-js-files.ts   # Run the JavaScript-based file checker (legacy)
│   ├── find-processable-videos.ts # Find videos that can be processed
│   ├── link-assets.ts             # Link assets to a presentation
│   ├── list-pending.ts            # List files pending processing
│   ├── list-ready.ts              # List files ready for processing
│   ├── list-transcribable.ts      # List files ready for transcription
│   ├── manage-presentations.ts    # Manage presentations
│   ├── process-summary.ts         # Process a summary file
│   ├── purge-processed-media.ts   # Delete processed media files
│   ├── run-shell-check.ts         # Run shell script-based checker
│   ├── transcribe-audio.ts        # Transcribe audio files
│   └── transcribe-with-summary.ts # Transcribe and generate summary
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