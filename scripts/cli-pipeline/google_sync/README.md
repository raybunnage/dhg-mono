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

### Authentication

- `auth status` - Check if Google auth token is valid
- `auth login` - Login to Google Drive and get a new token
- `auth refresh` - Refresh the Google auth token

### Sync

- `sync folder` - Sync a specific Google Drive folder
- `sync roots` - Sync all registered root folders

### Roots Management

- `roots list` - List all registered root folders
- `roots add` - Add a new root folder for syncing
- `roots remove` - Remove a root folder

### File Operations

- `files list` - List synced files
- `files extract` - Extract content from synced files
- `files batch-extract` - Extract content from multiple files in batch

### Audio Operations

- `audio extract` - Extract audio from video or audio files
- `audio batch-extract` - Extract audio from multiple files in batch

### Maintenance

- `cleanup fix-paths` - Fix missing parent paths in the database
- `cleanup purge` - Purge old records from the database

### Statistics

- `stats sync` - Get sync statistics
- `stats types` - Get statistics by file types

### Utilities

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

## Examples

```bash
# Sync a specific folder with detailed output
google-sync sync folder --id 1EHBAhSv1hmcuctiAgaLI9stLvefFFl3m --verbose

# List all audio files
google-sync files list --type "audio/" --limit 100

# Batch extract content from PDF files
google-sync files batch-extract --type "application/pdf" --limit 20

# Fix missing parent paths
google-sync cleanup fix-paths
```

## Development

This CLI tool is built using Commander.js and integrates with shared services for Google Drive and Supabase interactions. To extend the functionality:

1. Add new commands to `index.js`
2. Implement the command functionality in appropriate service files
3. Use shared services where possible to maintain consistency with the web UI

## License

MIT