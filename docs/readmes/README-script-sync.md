# Script Synchronization Tool

This set of tools provides database synchronization for scripts in the repository. It ensures that all scripts are properly tracked in the Supabase database, making them available for further analysis, classification, and management.

## Key Features

- **Path-Aware Syncing**: Preserves the full path from the project root in the database
- **Smart File Detection**: Finds .sh and .js script files while excluding common directories like node_modules
- **Restoration Logic**: Automatically restores scripts previously marked as deleted if they exist on disk
- **Database Integration**: Directly connects to Supabase for reliable database operations
- **Multiple Ways to Run**: Choose from pipeline script or direct Node.js execution

## Quick Start

The simplest way to run script synchronization:

```bash
# From project root
./scripts/root/sync-scripts.sh
```

## Running Options

### Option 1: Using the Pipeline Script

```bash
# From project root
./scripts/cli-pipeline/script-pipeline-main.sh sync
```

### Option 2: Direct Node.js Execution

```bash
# From project root
node scripts/root/final-sync.js
```

### Option 3: Using the Convenience Wrapper

```bash
# Default (pipeline) mode
./scripts/root/sync-scripts.sh

# Direct mode
./scripts/root/sync-scripts.sh --direct
```

## Environment Variables

These scripts use the following environment variables:

- `SUPABASE_URL`: URL of your Supabase instance
- `SUPABASE_KEY`: Service role API key for Supabase authentication

If these variables are not set, you'll be prompted for the Supabase key during execution.

## Files in This System

- `final-sync.js`: The core Node.js script with enhanced path handling and restore logic
- `script-pipeline-main.sh`: Main entry point for the script pipeline
- `script-manager.sh`: Contains the implementation of various script commands
- `ensure-sync-script.sh`: Ensures the sync script is available where needed
- `sync-scripts.sh`: Convenient wrapper script for easy execution

## How It Works

1. The script scans the repository for `.sh` and `.js` files, excluding certain directories
2. It calculates MD5 hashes of file contents to detect changes
3. For each script:
   - If it exists in the database with the same hash, no action is taken
   - If it's new, it's inserted into the database
   - If it exists but the hash changed, it's updated
   - If it was previously marked as deleted but now exists, it's restored
4. Scripts in the database that no longer exist on disk are marked as deleted

## Adding New Scripts

New scripts are automatically detected and added to the database during sync. If you want to specifically look for recently added scripts, use:

```bash
./scripts/cli-pipeline/script-pipeline-main.sh find-new
```

## Troubleshooting

- **Missing Dependencies**: Ensure @supabase/supabase-js is installed
- **Permission Issues**: Make sure all .sh files are executable (`chmod +x script.sh`)
- **Path Problems**: Run scripts from the project root directory
- **Authentication Errors**: Check that your Supabase credentials are correct