# AI Page Living Docs Management Guide

## Overview

The AI page in dhg-admin-code now provides comprehensive management capabilities for living documentation. This guide explains how to use all the new features.

## Key Features

### 1. **Frequency Selector**
- Click on the frequency display (e.g., "7 day cycle") for any document
- Select from preset options:
  - Daily (1 day)
  - Weekly (7 days)
  - Bi-weekly (14 days)
  - Monthly (30 days)
  - Quarterly (90 days)
- Changes are saved immediately to the database

### 2. **Check Now Button** (🕐)
- Located on each document row
- Runs `check-updates` command for that specific document
- Shows if the document has changed since last check
- Updates the `last_checked` timestamp

### 3. **Update Now Button** (▶️)
- Located on each document row
- Runs `process-updates` command for that specific document
- Triggers document regeneration/update process
- Updates `last_updated` and calculates next review date

### 4. **Global Command Buttons**
- **Check All Updates**: Runs `check-updates` for all active documents
- **Process All Updates**: Runs `process-updates` for all documents needing review
- **List CLI Status**: Shows current status from CLI perspective

### 5. **Last Check Time Display**
- Shows when each document was last checked by the system
- Format: "Last checked: Jun 10, 2025 3:30 PM"
- Helps track monitoring activity

## CLI Commands

The underlying CLI commands that power the AI page:

```bash
# Check which documents need updates
./scripts/cli-pipeline/continuous_docs/continuous-docs-cli.sh check-updates

# Process and update documents
./scripts/cli-pipeline/continuous_docs/continuous-docs-cli.sh process-updates

# List all monitored documents
./scripts/cli-pipeline/continuous_docs/continuous-docs-cli.sh list-monitored

# Add new document to monitoring
./scripts/cli-pipeline/continuous_docs/continuous-docs-cli.sh add-monitor
```

## Backend Architecture

### Server Component
- **Port**: 3008 (continuous-docs-server.cjs)
- **Endpoints**:
  - `POST /api/cli-command` - Execute CLI commands from UI
  - `PATCH /api/continuous-docs/:path/frequency` - Update review frequency
  - `GET /api/continuous-docs` - Get all tracked documents

### Database Table
- **Table**: `doc_continuous_monitoring`
- **Key Fields**:
  - `review_frequency_days` - How often to review (1, 7, 14, 30, 90)
  - `next_review_date` - When next review is due
  - `last_updated` - When content was last updated
  - `last_checked` - When system last checked for changes
  - `priority` - high/medium/low
  - `status` - active/needs-review/updating/deprecated

## Usage Workflow

1. **View Status**: Open AI page to see all living docs and their review status
2. **Adjust Frequency**: Click frequency selector to change review cycle
3. **Manual Check**: Click 🕐 button to check if a document needs updates
4. **Manual Update**: Click ▶️ button to update a document immediately
5. **Bulk Operations**: Use global buttons to check/update all documents

## Visual Indicators

- **Orange Background**: Document is overdue for review
- **Blue Background**: Currently selected document
- **Status Icons**:
  - 🔴 High priority
  - 🟡 Medium priority
  - 🟢 Low priority
- **Spinner Icons**: Command is currently running

## Future Enhancements

The system is designed to support:
- Automated document regeneration based on source changes
- Git integration for automatic commits
- Scheduled background checks
- Template-based document generation
- Dependency tracking between documents

## Troubleshooting

If commands fail to execute:
1. Ensure continuous-docs-server is running on port 3008
2. Check that CLI scripts have execute permissions
3. Verify database connection in .env.development
4. Check browser console for API errors

Last updated: June 10, 2025