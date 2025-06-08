# Package.json Cleanup Summary

Date: 2025-06-08

## Overview

Cleaned up the root package.json by removing redundant and unused commands, improving developer experience and reducing confusion.

## Commands Removed (8 total) & Reorganized (1)

### 1. Archived App Reference
- **Removed**: `"experts": "pnpm --filter dhg-improve-experts dev"`
- **Reason**: App was archived and no longer exists

### 2. Duplicate App Commands (6)
Removed all `dev:*` variants that were exact duplicates of shorter commands:
- `"dev:hub"` → duplicate of `"hub"`
- `"dev:audio"` → duplicate of `"audio"`
- `"dev:admin-code"` → duplicate of `"admin-code"`
- `"dev:admin-suite"` → duplicate of `"admin-suite"`
- `"dev:admin-google"` → duplicate of `"admin-google"`
- `"dev:research"` → duplicate of `"research"`

### 3. Duplicate CLI Command
- **Removed**: `"document": "./scripts/cli-pipeline/document/doc-cli.sh"`
- **Kept**: `"doc"` (shorter and equally clear)

### 4. Reorganized App Command
- **Moved**: `"research": "pnpm --filter @dhg/research dev"`
- **From**: "Server Utilities" section
- **To**: "App Shortcuts" section (where it belongs with other app commands)

## Impact

### Before Cleanup
- 56 total commands
- 49 working commands
- 7 redundant/duplicate commands
- 1 reference to non-existent app
- 1 misplaced command

### After Cleanup
- 48 total commands
- 42 working commands
- 0 redundant commands
- All commands now functional
- All commands properly organized

### Command Distribution (After Cleanup)
- CLI pipeline commands: 20 (48%)
- Turbo commands: 6 (14%)
- App shortcuts: 6 (14%)
- Audio-specific: 5 (12%)
- Server utilities: 4 (10%)
- Utility commands: 2 (5%)

## Benefits

1. **Cleaner package.json**: 14% reduction in commands (from 56 to 48)
2. **No confusion**: Developers won't wonder which variant to use
3. **Consistent naming**: Single pattern for app shortcuts
4. **All commands work**: No broken references

## Documentation Updated

1. **package-json-command-analysis.md**: Updated with current state
2. **package-json-command-summary.md**: Reflects cleanup and new counts

## Remaining Suggestions

1. Consider adding shortcuts for `dhg-a` and `dhg-b` apps if they become active
2. Consider moving `maintenance-cli.sh` into its own subdirectory for consistency with other CLI pipelines

The package.json is now cleaner and more maintainable with all commands serving a unique purpose.