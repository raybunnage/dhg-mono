# Database Backup Strategy and Archival Procedures

## Overview

This document describes the backup strategy implemented for the DHG monorepo database. All backup tables have been moved to a dedicated `backup` schema to maintain a clean public schema and implement proper archival procedures.

## Backup Schema Structure

### Location
- **Schema**: `backup` - Dedicated schema for all database backups
- **Access**: Granted to postgres, anon, authenticated, and service_role users

### Key Components

1. **backup.backup_metadata** - Tracks all backups with:
   - Original table name
   - Backup table name
   - Backup date
   - Row count
   - Backup reason
   - Created by/at information

2. **backup.backup_inventory** - View showing all backups with size information

3. **backup.create_table_backup()** - Function to create new backups

## Creating New Backups

### Using the Backup Function

```sql
-- Create a backup with reason
SELECT backup.create_table_backup('table_name', 'Reason for backup');

-- Example: Backup experts table before major update
SELECT backup.create_table_backup('experts', 'Pre-v2.0 migration backup');
```

This function:
- Creates a timestamped backup table in the backup schema
- Records metadata in backup_metadata table
- Returns the backup table name

### Manual Backup (if needed)

```sql
-- Create backup table
CREATE TABLE backup.table_name_backup_YYYY_MM_DD AS 
SELECT * FROM public.table_name;

-- Record in metadata
INSERT INTO backup.backup_metadata 
(original_table_name, backup_table_name, backup_date, row_count, backup_reason)
VALUES 
('table_name', 'table_name_backup_YYYY_MM_DD', NOW(), 
 (SELECT COUNT(*) FROM backup.table_name_backup_YYYY_MM_DD), 
 'Manual backup reason');
```

## Viewing Backups

### Using Database CLI

```bash
# List all backup tables
./scripts/cli-pipeline/database/database-cli.sh list-backup-tables
```

### Using SQL

```sql
-- View all backups through public view (Supabase compatible)
SELECT * FROM public.backup_inventory_view
ORDER BY original_table_name, backup_date DESC;

-- Get list of backup tables
SELECT * FROM public.get_backup_tables();
```

## Archival Procedures

### 1. Regular Backup Schedule

**Before Major Updates**:
- Always create backups before schema changes
- Use descriptive backup reasons
- Document in migration files

**Monthly Archival**:
- Review backups older than 3 months
- Archive to cold storage if needed
- Remove very old backups after verification

### 2. Backup Retention Policy

| Backup Type | Retention Period | Action After Period |
|-------------|-----------------|-------------------|
| Pre-migration | 6 months | Review for archival |
| Daily snapshots | 7 days | Auto-delete |
| Weekly snapshots | 4 weeks | Auto-delete |
| Monthly archives | 12 months | Move to cold storage |
| Critical backups | Indefinite | Annual review |

### 3. Cleanup Procedures

```sql
-- Find old backups (example: older than 6 months)
SELECT * FROM backup.backup_inventory
WHERE backup_date < NOW() - INTERVAL '6 months'
ORDER BY backup_date;

-- Drop old backup table
DROP TABLE IF EXISTS backup.old_table_backup_2024_01_01;

-- Remove from metadata
DELETE FROM backup.backup_metadata
WHERE backup_table_name = 'old_table_backup_2024_01_01';
```

## Best Practices

1. **Always Document Backups**:
   - Use clear, descriptive reasons
   - Include ticket/issue numbers if applicable
   - Note who requested the backup

2. **Verify Before Deletion**:
   - Check backup integrity before removing
   - Ensure no active references
   - Confirm with team if unsure

3. **Use Point-in-Time Recovery**:
   - For disaster recovery, rely on Supabase's point-in-time recovery
   - Manual backups are for specific migration/update protection

4. **Monitor Backup Size**:
   ```sql
   -- Check total backup size
   SELECT 
     COUNT(*) as backup_count,
     pg_size_pretty(SUM(pg_total_relation_size('backup.' || backup_table_name))) as total_size
   FROM backup.backup_metadata;
   ```

## Migration History

- **2025-05-25**: Moved 22 backup tables from public schema to backup schema
- Created backup management infrastructure
- Established archival procedures

## Future Improvements

1. **Automated Cleanup**: Implement scheduled functions to clean old backups
2. **Compression**: Add option to compress old backups
3. **S3 Integration**: Archive very old backups to S3
4. **Automated Backups**: Schedule regular backup creation for critical tables

## Related Commands

```bash
# List backup tables
./scripts/cli-pipeline/database/database-cli.sh list-backup-tables

# Create new backup (via SQL)
psql -c "SELECT backup.create_table_backup('table_name', 'reason')"

# View backup inventory
./scripts/cli-pipeline/database/database-cli.sh table-records | grep backup
```