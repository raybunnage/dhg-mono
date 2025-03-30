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

The CLI now includes TypeScript-based commands for improved reliability and type safety. Use the `google-drive-cli.sh` script in the `scripts` directory to access these features:

```bash
# List all registered root folders
./scripts/google-drive-cli.sh list-roots

# List potential root folders that aren't registered yet
./scripts/google-drive-cli.sh list-potential-roots

# Add a new root folder
./scripts/google-drive-cli.sh add-root 1wriOM2j2IglnMcejplqG_XcCxSIfoRMV --name "Dynamic Healing Discussion Group"

# Remove a root folder
./scripts/google-drive-cli.sh remove-root <id>

# Sync a specific folder
./scripts/google-drive-cli.sh sync-folder 1wriOM2j2IglnMcejplqG_XcCxSIfoRMV --dry-run

# Sync a folder recursively
./scripts/google-drive-cli.sh sync-folder dynamic-healing --recursive
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
- `list-drive-direct` - List files in Drive directly (no DB interaction)
- `list-drive-service` - List files using service account
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
  - `scripts/` - Scripts directory
    - `google-drive-cli.sh` - Main entry point wrapper script for TypeScript commands
    - `ts/` - TypeScript implementation of core commands
      - `list-drive-roots.ts` - List roots implementation
      - `google-drive-manager.ts` - Core CLI implementation
      - `sync-drive-service.ts` - Sync implementation
      - `utility/` - Additional utility scripts
        - Various helpers and specialized commands

## Adding New Functionality

To extend the functionality:
- New features should use the TypeScript versions in the `scripts/ts` directory
- Use the shared services and authentication methods whenever possible
- When adding new TypeScript files, use the correct relative path to imports:
  - Import from supabase: `import type { Database } from '../../../../../../supabase/types';`
  - Import from packages: `import { defaultGoogleAuth } from '../../../../../../packages/shared/services/google-drive';`

## License

MIT