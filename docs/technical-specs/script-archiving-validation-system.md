# Script Archiving Validation System - Phase 2C

## Overview

The validation system ensures that archived scripts haven't broken any functionality in the monorepo. It provides automated checks and easy rollback capabilities.

## Validation Components

### 1. Import Reference Validation
- Scan all TypeScript/JavaScript files for imports of archived scripts
- Detect broken require() or import statements
- Check package.json scripts for references to archived files

### 2. CLI Command Validation
- Verify all registered CLI commands still function
- Test command execution without actually running operations
- Check shell script references aren't broken

### 3. App Build Verification
- Run build commands for each app to ensure no missing dependencies
- Check for TypeScript compilation errors
- Verify Vite/webpack builds complete successfully

### 4. Batch Restoration Tools
- Restore by archive ID (e.g., all scripts from "fix-scripts-phase1-20250608")
- Restore by category (e.g., all "app_script" type files)
- Restore by date range
- Dry-run mode to preview what would be restored

## Implementation Plan

### Step 1: Create Validation Command Structure
```bash
./scripts/cli-pipeline/deprecation/deprecation-cli.sh validate-archiving
./scripts/cli-pipeline/deprecation/deprecation-cli.sh restore-batch --archive-id <id>
./scripts/cli-pipeline/deprecation/deprecation-cli.sh validate-imports
./scripts/cli-pipeline/deprecation/deprecation-cli.sh validate-cli-commands
```

### Step 2: Import Validation Logic
1. Scan all .ts, .tsx, .js, .jsx files
2. Extract import/require statements
3. Check if imported paths match archived scripts
4. Report any broken references

### Step 3: CLI Command Validation
1. Query command_definitions table
2. For each command, check if script file exists
3. Validate shell script syntax (bash -n)
4. Report any missing or broken commands

### Step 4: Build Verification
1. For each app in apps/ directory
2. Run `npm run build` or `pnpm build`
3. Capture and analyze error output
4. Report build failures related to missing scripts

### Step 5: Batch Restoration
1. Query sys_archived_scripts_files by various criteria
2. Copy files from archived location back to original
3. Update database records
4. Provide summary of restored files

## Success Criteria

1. **Zero broken imports** after archiving
2. **All CLI commands functional** 
3. **All apps build successfully**
4. **Batch restoration works** with proper tracking
5. **Clear validation reports** showing what was checked

## Risk Mitigation

1. **Dry-run mode** for all operations
2. **Detailed logging** of all validation checks
3. **Rollback tracking** in database
4. **Backup before restoration** to prevent conflicts