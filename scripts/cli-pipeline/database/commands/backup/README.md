# Database Backup Commands

This folder contains backup-related commands for the database CLI pipeline.

## Available Commands

### create-backup
Creates backups of configured tables with today's date in the `backup` schema.

```bash
./database-cli.sh backup create-backup [options]
```

Options:
- `-t, --tables <tables>` - Comma-separated list of tables to backup (overrides config)
- `--data-only` - Only backup data, not structure
- `--structure-only` - Only backup structure, not data
- `--dry-run` - Show what would be backed up without executing

### add-backup-table
Adds a table to the backup configuration.

```bash
./database-cli.sh backup add-backup-table <table> [options]
```

Options:
- `--position <position>` - Position to insert table ('start', 'end', or a number)
- `--force` - Add table even if it doesn't exist in database

### list-backup-config
Shows the current backup configuration.

```bash
./database-cli.sh backup list-backup-config [options]
```

Options:
- `--validate` - Validate that configured tables exist in database
- `--show-backups` - Show existing backups for each configured table

## Configuration

The backup commands use a `backup-config.json` file located at `scripts/cli-pipeline/database/backup-config.json` to determine which tables to backup by default.

Example configuration:
```json
{
  "tables": [
    "experts",
    "document_types",
    "expert_documents",
    "sources_google"
  ],
  "defaultOptions": {
    "includeStructure": true,
    "includeData": true,
    "includeIndexes": true,
    "includeConstraints": true
  }
}
```

## Implementation Notes

- All backup tables are created in the `backup` schema
- Backup table names follow the pattern: `backup.{original_table}_{YYYYMMDD}`
- Uses Supabase RPC `execute_sql` function to execute raw SQL commands
- Properly tracks command execution using the CommandTrackingService