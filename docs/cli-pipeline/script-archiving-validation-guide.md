# Script Archiving Validation Guide

## Overview

The script archiving validation system ensures that archived scripts haven't broken any functionality in the monorepo. It provides automated checks and rollback capabilities for safe script cleanup.

## Validation Commands

### 1. Import Validation

**Command**: `validate-imports`

Scans the entire codebase for references to archived scripts.

```bash
./scripts/cli-pipeline/deprecation/deprecation-cli.sh validate-imports
```

**What it checks**:
- JavaScript/TypeScript imports (`import ... from`)
- CommonJS requires (`require()`)
- Dynamic imports (`import()`)
- Shell script sources (`source`, `.`, direct execution)

**Output**:
- Lists all broken imports found
- Groups by archived script
- Shows which files reference archived scripts
- Provides recommendations for fixing

**Example output**:
```
✅ SUCCESS: No broken imports found!
All imports are valid. The archived scripts are not referenced by any active code.
```

### 2. CLI Command Validation

**Command**: `validate-cli-commands`

Validates that all registered CLI commands still have their implementation files.

```bash
./scripts/cli-pipeline/deprecation/deprecation-cli.sh validate-cli-commands
```

**What it checks**:
- Main CLI shell scripts exist
- Command implementation files exist
- Shell script syntax is valid
- Archived vs missing scripts

**Output**:
- Lists broken commands by pipeline
- Distinguishes between archived and missing scripts
- Provides restoration commands for archived scripts
- Shell script syntax validation results

**Example findings**:
- 142 broken commands found across 25 pipelines
- Many commands registered but never implemented
- All shell scripts have valid syntax

### 3. Comprehensive Validation

**Command**: `validate-archiving`

Runs all validation checks in sequence.

```bash
./scripts/cli-pipeline/deprecation/deprecation-cli.sh validate-archiving
```

This runs:
1. Import validation
2. CLI command validation

## Restoration Commands

### Batch Restoration

**Command**: `restore-batch`

Restore multiple archived scripts based on criteria.

```bash
# Restore by archive ID
./scripts/cli-pipeline/deprecation/deprecation-cli.sh restore-batch --archive-id fix-scripts-phase1-20250608

# Restore by category
./scripts/cli-pipeline/deprecation/deprecation-cli.sh restore-batch --category python

# Restore by date range
./scripts/cli-pipeline/deprecation/deprecation-cli.sh restore-batch --date-range 2025-06-08,2025-06-09

# Dry run mode (preview only)
./scripts/cli-pipeline/deprecation/deprecation-cli.sh restore-batch --archive-id fix-scripts-phase1-20250608 --dry-run

# Skip confirmation
./scripts/cli-pipeline/deprecation/deprecation-cli.sh restore-batch --archive-id fix-scripts-phase1-20250608 --force
```

**Features**:
- Shows restoration plan before executing
- Skips files that already exist
- Restores executable permissions for shell scripts
- Updates database tracking
- Generates detailed report

### Single File Restoration

**Command**: `restore-script`

Restore a single archived script.

```bash
./scripts/cli-pipeline/deprecation/deprecation-cli.sh restore-script --path scripts/some-script.ts
```

## Understanding Validation Results

### Import Validation Results

**Green (Success)**:
- No broken imports found
- Safe to keep scripts archived

**Yellow (Warning)**:
- Broken imports found
- Review each case to determine:
  - Is it dead code that can be removed?
  - Should the script be restored?
  - Can the import be updated to a different script?

### CLI Command Validation Results

**Common Issues**:
1. **Missing Implementation**: Command registered but never created
   - Action: Remove from command registry or implement

2. **Archived Script**: Implementation was archived
   - Action: Restore if needed or remove from registry

3. **Syntax Errors**: Shell script has syntax issues
   - Action: Fix syntax errors

## Best Practices

### Before Archiving Scripts

1. **Run full validation first**:
   ```bash
   ./scripts/cli-pipeline/deprecation/deprecation-cli.sh validate-archiving
   ```

2. **Archive in small batches**:
   - Easier to identify issues
   - Simpler rollback if needed

3. **Use descriptive archive IDs**:
   - Include date and purpose
   - Example: `cleanup-unused-auth-scripts-20250608`

### After Archiving Scripts

1. **Always validate**:
   - Run import validation
   - Check CLI commands
   - Test critical workflows

2. **Monitor for issues**:
   - Watch error logs
   - Check CI/CD pipelines
   - Listen for user reports

3. **Document changes**:
   - Update relevant documentation
   - Note in work summaries
   - Track in dev tasks

### Restoration Strategy

1. **Investigate before restoring**:
   - Why was it archived?
   - Is the reference still needed?
   - Can it be replaced?

2. **Use dry-run first**:
   ```bash
   ./scripts/cli-pipeline/deprecation/deprecation-cli.sh restore-batch --archive-id <id> --dry-run
   ```

3. **Test after restoration**:
   - Re-run validation
   - Test affected features
   - Commit if successful

## Reports and Tracking

### Generated Reports

All validation commands generate JSON reports in `docs/script-reports/`:

- `import-validation-YYYY-MM-DD.json`
- `cli-command-validation-YYYY-MM-DD.json`
- `batch-restoration-YYYY-MM-DD-timestamp.json`

### Database Tracking

The `sys_archived_scripts_files` table tracks:
- Original and archived paths
- Archive date and reason
- Restoration status and date
- Archive batch ID

## Troubleshooting

### "Command not found" errors

If validation commands fail to run:
1. Check you're in the project root
2. Ensure script has execute permissions
3. Verify TypeScript is installed

### Import validation too slow

For large codebases:
1. Use more specific file patterns
2. Exclude additional directories
3. Run on specific subdirectories

### Restoration conflicts

If restoration fails:
1. Check if file already exists
2. Verify archived file still exists
3. Check file permissions
4. Review error messages in report

## Summary

The validation system provides confidence when cleaning up scripts:

1. **Validate before archiving** - Ensure nothing will break
2. **Archive with tracking** - Maintain history and enable rollback
3. **Validate after archiving** - Confirm everything still works
4. **Restore if needed** - Easy rollback with batch tools
5. **Document findings** - Track what was done and why

This systematic approach enables safe, reversible script cleanup while maintaining monorepo integrity.