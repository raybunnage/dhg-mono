# Script Pipeline Command Documentation

## Overview

The Script Pipeline system is a set of bash scripts and Node.js utilities that discover, index, and analyze script files throughout the DHG monorepo. It provides a robust way to discover new scripts, synchronize them with the Supabase database, and classify them using Claude AI.

This document explains the `find-new` command and the underlying architecture that enables reliable script discovery and database synchronization.

## How the `find-new` Command Works

The `find-new` command searches through the repository directories for JavaScript (`.js`) and Shell (`.sh`) script files, and indexes them in the Supabase database. It processes **all** matching files without limiting the number of files processed.

### Command Usage

```bash
./scripts/cli-pipeline/script-pipeline-main.sh find-new
```

### Execution Flow

1. **Environment Setup**: 
   - Loads environment variables from `.env.development` and `.env.local`
   - Sets up required API keys (Claude API, Supabase)
   - Configures logging to a timestamped file

2. **Command Routing**:
   - The main script (`script-pipeline-main.sh`) parses the `find-new` command
   - Calls the `find_new_scripts` function in `script-manager.sh`

3. **Database Connection**:
   - Uses `supabase-connect.js` to establish database connection
   - Retrieves Supabase credentials from environment variables
   - Tests connection to the Supabase instance

4. **Script Discovery**:
   - Creates a temporary Node.js script (`temp-sync-scripts.js`)
   - Uses a recursive file-finding algorithm to locate all script files
   - Ignores files in excluded directories (`node_modules`, `.git`, etc.)

5. **Database Synchronization**:
   - Compares discovered scripts with those already in the database
   - Normalizes file paths for consistent comparison
   - Adds new scripts, updates modified scripts, and marks deleted scripts
   - Calculates file hashes to detect changes in content

## Key Components

### 1. **script-pipeline-main.sh**
- Entry point for the script pipeline
- Loads environment variables
- Provides command-line interface
- Routes commands to appropriate functions

### 2. **script-manager.sh**
- Contains core script management functionality
- Handles logging and error reporting
- Delegates database operations to `supabase-connect.js`

### 3. **supabase-connect.js**
- Creates a secure connection to Supabase
- Manages credential retrieval and validation
- Contains the `findAndSyncScripts` function that:
  - Generates a temporary script with dynamic configuration
  - Executes recursive file discovery
  - Processes all found scripts without any limit
  - Handles database synchronization logic
  - Reports detailed results

## Why It Works

The script pipeline successfully discovers and synchronizes files for several reasons:

1. **Robust Environment Handling**:
   - Multiple fallback mechanisms for environment variables
   - Graceful error handling when credentials are missing
   - Clear logging of configuration states

2. **Flexible Path Normalization**:
   - Handles both absolute and relative paths
   - Normalizes paths for consistent comparison
   - Prevents duplicate entries for the same file

3. **Efficient File Processing**:
   - Uses Node.js streams and asynchronous patterns
   - Calculates file hashes to detect content changes
   - Records file metadata (size, creation date, modification date)

4. **Proper Database Synchronization**:
   - Checks existing records before attempting insertion
   - Uses database transactions where appropriate
   - Reports detailed synchronization results

5. **No File Limit**:
   - Processes all discovered script files without artificial limits
   - Only the classification commands have optional limits

## Database Schema Integration

The script discovery process inserts records into the `scripts` table with the following key fields:

- `file_path`: Relative path to the script file
- `title`: Filename of the script
- `language`: Detected language (javascript or bash)
- `last_modified_at`: Timestamp of file's last modification
- `file_hash`: MD5 hash of file contents for change detection
- `metadata`: JSON object with additional file metadata
- `is_deleted`: Flag indicating if the file no longer exists on disk

## Troubleshooting

If script discovery isn't working as expected:

1. **Check Environment Variables**:
   - Ensure `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set
   - Verify credentials have the correct permissions

2. **Examine Logs**:
   - Check timestamped log files in `script-analysis-results/` directory
   - Look for specific error messages

3. **Verify Database Connection**:
   - Run the script with verbose logging to see connection details
   - Test database connectivity separately if needed

4. **Check File Patterns**:
   - Ensure your scripts have the correct extensions (`.js` or `.sh`)
   - Check that they're not in excluded directories

## Conclusion

The `find-new` command in the script pipeline provides a robust way to discover and track scripts across the repository. It's designed to handle all scripts without arbitrary limits, ensuring comprehensive coverage of the codebase's executable components.

Understanding the underlying architecture helps developers effectively manage, monitor, and maintain the growing collection of automation scripts within the monorepo.