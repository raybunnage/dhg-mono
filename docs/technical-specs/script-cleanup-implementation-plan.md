# Script Cleanup Implementation Plan

## Overview

This document provides a comprehensive implementation plan for safely cleaning up unused scripts in the DHG monorepo while maintaining the ability to restore them if needed.

## Current State Analysis

### Script Organization
1. **CLI Pipeline Scripts** (`scripts/cli-pipeline/`): 21+ active pipelines with health checks
2. **Root Scripts** (`scripts/`): Mixed collection of utility scripts, many potentially unused
3. **App Scripts**: Scripts embedded in individual apps
4. **Python Scripts** (`scripts/python/`): Audio processing and ML scripts

### Tracking Systems Available
1. **sys_archived_cli_pipeline_files**: Table for tracking archived scripts
2. **command_tracking**: Usage data for CLI commands
3. **sys_cli_pipelines**: Pipeline registration and health check status
4. **command_definitions**: Individual command definitions
5. **scripts_registry**: Individual script file tracking

## Implementation Phases

### Phase 1: Discovery & Analysis (Days 1-2)

#### 1.1 Create Script Inventory
```bash
# Create comprehensive script inventory
./scripts/cli-pipeline/deprecation/deprecation-cli.sh analyze-scripts

# Generate usage report from command tracking
./scripts/cli-pipeline/deprecation/deprecation-cli.sh generate-report --type scripts
```

#### 1.2 Categorize Scripts
- **Active**: Used within last 30 days
- **Inactive**: Used 30-90 days ago  
- **Dormant**: Not used in 90+ days
- **Unknown**: No tracking data available

#### 1.3 Identify Dependencies
```typescript
// Check for scripts referenced in:
// - package.json scripts
// - Shell script calls
// - Import statements
// - Documentation
```

### Phase 2: Safety Validation (Days 3-4)

#### 2.1 Create Validation Script
```typescript
// scripts/cli-pipeline/deprecation/commands/validate-archivable.ts
interface ArchivableScript {
  file_path: string;
  last_used: Date | null;
  usage_count: number;
  dependencies: string[];
  safe_to_archive: boolean;
  reason: string;
}
```

#### 2.2 Safety Criteria
1. **No recent usage** (90+ days)
2. **No active dependencies**
3. **Not referenced in package.json**
4. **Not part of active CLI pipeline**
5. **Has alternative/replacement available**

#### 2.3 Generate Safety Report
```bash
./scripts/cli-pipeline/deprecation/deprecation-cli.sh validate-scripts --safety-check
```

### Phase 3: Archiving Process (Days 5-7)

#### 3.1 Archive Structure
```
scripts/
├── cli-pipeline/
│   └── {domain}/
│       └── .archived_scripts/
│           └── script-name.20250608.ts
├── .archived_root_scripts/
│   └── 20250608/
│       ├── manifest.json
│       └── {original-script-files}
└── python/
    └── .archived_scripts/
        └── script-name.20250608.py
```

#### 3.2 Archive Manifest Format
```json
{
  "archive_date": "2025-06-08",
  "scripts": [
    {
      "original_path": "scripts/fix/old-fix.sh",
      "archived_path": "scripts/.archived_root_scripts/20250608/fix/old-fix.sh",
      "last_used": "2024-12-15",
      "usage_count": 3,
      "reason": "Superseded by CLI pipeline command",
      "replacement": "./scripts/cli-pipeline/fix/fix-cli.sh old-fix"
    }
  ]
}
```

#### 3.3 Database Tracking
```sql
-- Insert archive records
INSERT INTO sys_archived_cli_pipeline_files (
  pipeline_name,
  command_name,
  original_file_path,
  archived_file_path,
  last_used_date,
  usage_count,
  description
) VALUES (
  'root_scripts',
  'legacy_fix',
  'scripts/fix/old-fix.sh',
  'scripts/.archived_root_scripts/20250608/fix/old-fix.sh',
  '2024-12-15',
  3,
  'Legacy fix script superseded by CLI pipeline'
);
```

### Phase 4: Implementation Commands (Days 8-10)

#### 4.1 Create Archive Commands
```bash
# Add to deprecation-cli.sh
archive-scripts)      # Archive validated scripts
restore-script)       # Restore an archived script
list-archived)        # List all archived scripts
search-archived)      # Search archived scripts
```

#### 4.2 Batch Archive Process
```typescript
// scripts/cli-pipeline/deprecation/commands/archive-scripts.ts
async function archiveScripts(dryRun: boolean = true) {
  // 1. Read validated archivable scripts
  // 2. Create archive directories
  // 3. Move files with date suffix
  // 4. Update database tracking
  // 5. Generate archive report
  // 6. Update git index
}
```

#### 4.3 Restore Process
```typescript
// scripts/cli-pipeline/deprecation/commands/restore-script.ts
async function restoreScript(archivePath: string) {
  // 1. Verify archived file exists
  // 2. Check if original path is available
  // 3. Restore file to original location
  // 4. Update database tracking
  // 5. Re-register if CLI command
}
```

### Phase 5: Rollback Procedures (Ongoing)

#### 5.1 Quick Restore
```bash
# Restore single script
./scripts/cli-pipeline/deprecation/deprecation-cli.sh restore-script --path "scripts/fix/old-fix.sh"

# Restore by date
./scripts/cli-pipeline/deprecation/deprecation-cli.sh restore-batch --date "2025-06-08"
```

#### 5.2 Emergency Rollback
```bash
# Full rollback of archive operation
./scripts/cli-pipeline/deprecation/deprecation-cli.sh rollback --archive-id "20250608"
```

#### 5.3 Archive Search
```bash
# Search archived scripts by name or content
./scripts/cli-pipeline/deprecation/deprecation-cli.sh search-archived --query "fix"
```

## Safety Measures

### 1. Pre-Archive Checklist
- [ ] Full backup of scripts directory
- [ ] Git commit before archiving
- [ ] Dry run of archive process
- [ ] Review of dependencies
- [ ] Team notification

### 2. Validation Rules
```typescript
const NEVER_ARCHIVE = [
  'scripts/cli-pipeline/**/*-cli.sh',  // Main CLI entry points
  'scripts/start-all-servers.js',      // Critical infrastructure
  'scripts/kill-all-servers.js',       // Critical infrastructure
  '**/package.json',                   // Package files
  '**/health-check.sh'                 // Health checks
];
```

### 3. Progressive Archiving
1. Start with scripts unused for 180+ days
2. Archive in small batches (10-20 files)
3. Wait 1 week between batches
4. Monitor for issues

### 4. Documentation Requirements
- Update CLAUDE.md with archive locations
- Document in ai_work_summaries
- Create archive report in docs/

## Monitoring & Metrics

### Success Metrics
- Number of scripts archived
- Disk space recovered
- No production issues
- Successful restores when needed

### Monitoring Commands
```bash
# Check archive status
./scripts/cli-pipeline/deprecation/deprecation-cli.sh archive-status

# Monitor for usage of archived scripts
./scripts/cli-pipeline/deprecation/deprecation-cli.sh monitor-archived
```

## Example Workflow

```bash
# Day 1: Discovery
./scripts/cli-pipeline/deprecation/deprecation-cli.sh analyze-scripts
./scripts/cli-pipeline/deprecation/deprecation-cli.sh generate-report --output unused-scripts.json

# Day 3: Validation
./scripts/cli-pipeline/deprecation/deprecation-cli.sh validate-scripts --safety-check

# Day 5: Dry Run
./scripts/cli-pipeline/deprecation/deprecation-cli.sh archive-scripts --dry-run

# Day 6: Archive Batch 1
./scripts/cli-pipeline/deprecation/deprecation-cli.sh archive-scripts --batch 1 --limit 20

# Day 8: Verify
./scripts/cli-pipeline/deprecation/deprecation-cli.sh list-archived
./scripts/cli-pipeline/deprecation/deprecation-cli.sh archive-status

# If needed: Restore
./scripts/cli-pipeline/deprecation/deprecation-cli.sh restore-script --path "scripts/old-script.sh"
```

## Risk Mitigation

1. **Git Safety**: All archives are committed to git for recovery
2. **Database Tracking**: Full audit trail in sys_archived_cli_pipeline_files
3. **Manifest Files**: JSON manifests document each archive operation
4. **Gradual Process**: Archive in phases, not all at once
5. **Easy Restore**: Simple commands to restore any archived script

## Next Steps

1. Review and approve this implementation plan
2. Create the validation and archive commands
3. Run discovery phase to identify candidates
4. Begin progressive archiving with oldest unused scripts
5. Monitor and adjust process based on results