# Documentation Archiving Pipeline Setup

## What Was Created

I've created a comprehensive documentation archiving pipeline with the following components:

### 1. Main CLI Script
- **Location**: `/scripts/cli-pipeline/documentation/documentation-cli.sh`
- **Purpose**: Central command interface for all documentation archiving operations

### 2. Core Commands

#### Archive Commands
- `archive-reports` - Archives old script reports (>30 days by default)
- `archive-specs` - Archives outdated/implemented technical specs
- `archive-solutions` - Archives resolved solution guides

#### Continuous Tracking Commands
- `add-continuous <path>` - Add a document to continuous tracking
- `list-continuous` - List all continuously tracked documents
- `update-continuous` - Update all tracked documents that are due
- `watch-continuous` - Monitor continuously tracked documents

#### Analysis Commands
- `analyze-relevance` - Analyze document relevance for archiving decisions
- `clean-archived` - Remove very old archived documents

### 3. Features

#### Archiving Strategy
- Documents are moved to `.archive_docs` folders within their categories
- Original files are replaced with reference stubs pointing to archives
- Archives are dated for easy identification
- Important files (README.md, etc.) are protected from archiving

#### Continuous Updates
- Documents can be tracked with different update frequencies:
  - `daily` - Every 24 hours
  - `weekly` - Every 7 days (default)
  - `on-change` - When source file is modified
- Tracked documents are copied to `/docs/continuously-updated/`
- Metadata stored in `.tracking.json`

#### Relevance Analysis
- Age-based scoring (older = less relevant)
- Category-specific rules
- Content analysis (length, deprecated markers)
- Optional AI analysis for borderline cases
- Generates actionable reports with recommendations

### 4. Usage Examples

```bash
# Add CLAUDE.md to continuous tracking
./scripts/cli-pipeline/documentation/documentation-cli.sh add-continuous CLAUDE.md project-instructions daily

# List all tracked documents
./scripts/cli-pipeline/documentation/documentation-cli.sh list-continuous

# Update all due documents
./scripts/cli-pipeline/documentation/documentation-cli.sh update-continuous

# Archive old script reports (dry run first)
./scripts/cli-pipeline/documentation/documentation-cli.sh archive-reports --dry-run
./scripts/cli-pipeline/documentation/documentation-cli.sh archive-reports

# Analyze document relevance
./scripts/cli-pipeline/documentation/documentation-cli.sh analyze-relevance --output relevance-report.md

# Clean very old archives (>180 days)
./scripts/cli-pipeline/documentation/documentation-cli.sh clean-archived --days 180
```

### 5. Integration

The documentation pipeline has been added to the master health check in `all-pipelines-cli.sh`.

To complete the integration when Supabase is available:
```bash
./scripts/cli-pipeline/all_pipelines/all-pipelines-cli.sh populate-command-registry
./scripts/cli-pipeline/all_pipelines/all-pipelines-cli.sh sync-command-status
```

### 6. Benefits

1. **Reduces Documentation Clutter**: Automatically archives outdated documents
2. **Preserves History**: Archives maintain full document history with dates
3. **Smart Archiving**: Uses relevance scoring to identify candidates
4. **Continuous Updates**: Key documents stay current automatically
5. **Flexible**: Configurable thresholds and update frequencies
6. **Safe**: Dry-run mode and protection for important files

### 7. Next Steps

1. Start tracking your most important documents:
   - CLAUDE.md (project instructions)
   - Key technical specs still in development
   - Frequently referenced solution guides

2. Run regular archiving to keep docs clean:
   - Weekly: `archive-reports` for script reports
   - Monthly: `analyze-relevance` to identify candidates
   - Quarterly: `clean-archived` to remove very old archives

3. Set up a cron job or reminder to run `update-continuous` regularly