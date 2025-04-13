# Google Drive Sync CLI

A command-line interface for syncing Google Drive files with Supabase, based on the functionality from the DHG Experts Sync page.

## Features

- Google Drive authentication management
- Sync files from specific folders or registered root folders
- Extract content from various file types
- Extract audio from media files
- Manage sync roots and file organization
- Generate statistics and reports
- Cleanup and maintenance operations

## Installation

```bash
cd scripts/cli-pipeline/google_sync
npm install
npm link
```

## Usage

### TypeScript-based Commands

The CLI now includes TypeScript-based commands for improved reliability and type safety. Use the `google-sync-cli.sh` script to access these features:

```bash
# List all registered root folders
./google-sync-cli.sh report-main-video-ids

# Count MP4 files in a folder
./google-sync-cli.sh count-mp4 dynamic-healing --recursive

# Generate a browser-based recursive search script
./google-sync-cli.sh browser-recursive-search

# Update sources from JSON
./google-sync-cli.sh update-sources-from-json

# Check for document types
./google-sync-cli.sh check-document-types

# Sync and update metadata
./google-sync-cli.sh sync-and-update-metadata 1wriOM2j2IglnMcejplqG_XcCxSIfoRMV --dry-run

# Get help
./google-sync-cli.sh --help
```

### Legacy Commands

The original JavaScript-based commands are still available:

```bash
# Check authentication status
google-sync auth status

# Authenticate with Google Drive
google-sync auth login

# Sync a specific folder
google-sync sync folder --id <folder-id>

# List all synced files of a specific type
google-sync files list --type "audio/x-m4a"

# Extract content from a file
google-sync files extract --id <file-id>

# Batch extract audio from media files
google-sync audio batch-extract
```

## Commands

### TypeScript CLI Commands

#### Core Commands
- `list-roots` - List all registered root folders in the database
- `list-potential-roots` - List folders in Google Drive that aren't registered as roots
- `add-root` - Add a new root folder for syncing
- `remove-root` - Remove a root folder
- `check-folder` - Check if a folder exists in Google Drive
- `sync` - Sync a specific root folder or all root folders
- `sync-folder` - Sync a specific folder (doesn't need to be a root)

#### Advanced Commands
- `add-root-service` - Add a new root folder using service account
- `check-roots` - Check the status of all registered root folders
- `disk-status` - Update presentations table with disk status for MP4 files
- `list-drive-direct` - List files in Drive directly (no DB interaction)
- `list-drive-service` - List files using service account
- `mp4-experts` - Create expert documents for presentations with MP4 files
- `report-drive-roots` - Generate a detailed report about all root folders
- `sync-and-update-metadata` - Sync folder and update metadata in one operation
- `update-metadata` - Update metadata for files in the database
- `update-dynamic-healing` - Update metadata for Dynamic Healing Discussion Group

#### Options
- `--dry-run` - Show what would be synced without making changes
- `--timeout [ms]` - Set timeout for sync operations
- `--name [name]` - Specify a name when adding a root folder
- `--description [desc]` - Specify a description when adding a root folder
- `--verbose` - Show more detailed output
- `--recursive` - Recursively sync subfolders (for sync-folder command)
- `--limit [number]` - Limit the number of files to process
- `--force` - Process all items even if they already have been processed (used with disk-status)

### Legacy Commands

#### Authentication

- `auth status` - Check if Google auth token is valid
- `auth login` - Login to Google Drive and get a new token
- `auth refresh` - Refresh the Google auth token

#### Sync

- `sync folder` - Sync a specific Google Drive folder
- `sync roots` - Sync all registered root folders

#### Roots Management

- `roots list` - List all registered root folders
- `roots add` - Add a new root folder for syncing
- `roots remove` - Remove a root folder

#### File Operations

- `files list` - List synced files
- `files extract` - Extract content from synced files
- `files batch-extract` - Extract content from multiple files in batch

#### Audio Operations

- `audio extract` - Extract audio from video or audio files
- `audio batch-extract` - Extract audio from multiple files in batch

#### Maintenance

- `cleanup fix-paths` - Fix missing parent paths in the database
- `cleanup purge` - Purge old records from the database

#### Statistics

- `stats sync` - Get sync statistics
- `stats types` - Get statistics by file types

#### Utilities

- `test-connection` - Test connections to Google Drive and Supabase
- `token-timer` - Display time until token expiration

## Configuration

Configuration can be stored in `~/.google_sync_config.json` or provided through environment variables.

Required environment variables:

- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_ANON_KEY` - Your Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key
- `GOOGLE_CLIENT_ID` - Google OAuth client ID
- `GOOGLE_CLIENT_SECRET` - Google OAuth client secret

## Development

This CLI tool integrates both JavaScript and TypeScript implementations:

1. The legacy JavaScript CLI uses Commander.js and standalone implementations
2. The TypeScript implementation leverages the shared services from the central packages

## Directory Structure

- `scripts/cli-pipeline/google_sync/` - Main directory for the Google Drive CLI pipeline
  - `google-sync-cli.sh` - Main entry point wrapper script for TypeScript commands
  - `index.ts` - Command definition and routing
  - Core implementation files:
    - `count-mp4-files.ts` - Count MP4 files implementation
    - `check-document-types.ts` - Check document types implementation
    - `sync-and-update-metadata.ts` - Sync and metadata update implementation
    - And other specialized commands

## Adding New Functionality

To extend the functionality:
- New features should use the TypeScript versions in the `scripts/ts` directory
- Use the shared services and authentication methods whenever possible
- When adding new TypeScript files, use the correct relative path to imports:
  - Import from supabase: `import type { Database } from '../../../../../../supabase/types';`
  - Import from packages: `import { defaultGoogleAuth } from '../../../../../../packages/shared/services/google-drive';`

## Specialized Commands

### Disk Status Command

The `disk-status` command checks for MP4 files in the `file_types/mp4` directory and updates the `presentations` table with disk availability status. This helps maintain synchronization between files in Google Drive and local storage.

```bash
# Check disk status in dry-run mode
./google-sync-cli.sh disk-status --dry-run

# Update disk status for all presentations (even already processed ones) 
# Note: This command may need special handling
./google-sync-cli.sh disk-status --force
```

The command adds the following metadata to the presentations table:

- `available_on_disk` - Boolean flag indicating if the file is available locally
- `disk_filename` - The actual filename on disk (might include INGESTED_ prefix)
- `disk_file_size` - The file size in bytes
- `disk_file_size_mb` - The file size in megabytes (rounded)
- `disk_status_updated` - Timestamp of when the status was last updated

This information can be used by applications to determine whether to stream from Google Drive or serve from the local disk.

### MP4 Experts Command

The `mp4-experts` command creates expert documents and presentation assets for presentations that have MP4 files available on disk. This is a prerequisite for further processing like transcription and AI analysis.

```bash
# Check what would be created in dry-run mode
./google-sync-cli.sh mp4-experts --dry-run

# Create expert documents and presentation assets
./google-sync-cli.sh mp4-experts

# Limit the number of presentations to process
./google-sync-cli.sh mp4-experts --limit 10
```

The command:
1. Finds presentations with `available_on_disk: true` in their metadata
2. For each presentation with a `main_video_id` that doesn't already have an expert document:
   - Creates a new record in the `expert_documents` table
   - Creates a new record in the `presentation_assets` table linking the presentation to the expert document
   - Sets appropriate statuses to mark the document as ready for processing

The created expert documents can then be processed by audio extraction, transcription, and AI analysis pipelines.

## License

MIT