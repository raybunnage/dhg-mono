# Sources Google2 Schema Management

This document describes the schema management tools for the `sources_google2` table and how to use them to update or verify the database schema.

## Table Schema

The `sources_google2` table contains information about files and folders stored in Google Drive. Its schema includes the following key columns:

| Column Name | Data Type | Required | Description |
|-------------|-----------|----------|-------------|
| id | uuid | YES | Primary key |
| drive_id | text | YES | Google Drive file/folder ID |
| name | text | YES | File/folder name |
| mime_type | text | YES | MIME type |
| root_drive_id | text | YES | ID of the root folder |
| parent_folder_id | text | NO | ID of the parent folder |
| path | text | YES | Full path to the file/folder |
| path_array | text[] | NO | Path components as an array |
| path_depth | integer | NO | Depth in the folder structure |
| is_root | boolean | NO | Whether this is a root folder |
| is_deleted | boolean | NO | Whether the file/folder is deleted |
| metadata | jsonb | NO | Additional metadata |
| size | bigint | NO | File size in bytes |
| modified_time | timestamp with time zone | NO | Last modification time |
| web_view_link | text | NO | Web view link for the file |
| thumbnail_link | text | NO | Thumbnail link for the file |
| content_extracted | boolean | NO | Whether content has been extracted |
| extracted_content | jsonb | NO | Extracted content data |
| document_type_id | uuid | NO | Reference to document_types |
| expert_id | uuid | NO | Reference to experts |
| created_at | timestamp with time zone | YES | Creation timestamp |
| updated_at | timestamp with time zone | YES | Update timestamp |
| last_indexed | timestamp with time zone | NO | Last indexing timestamp |
| main_video_id | uuid | NO | Reference to related video |

## Schema Management Commands

### Check Schema Against JSON Definition

To verify the database schema matches the expected schema definition:

```bash
./scripts/cli-pipeline/google_sync/google-drive-cli.sh update-schema-from-json file_types/json/sources_google2-schema.json --verbose
```

This will compare the current database schema with the JSON definition and report any differences without making changes.

### Generate SQL Migration Script

To generate an SQL migration script that would update the schema:

```bash
./scripts/cli-pipeline/google_sync/google-drive-cli.sh update-schema-from-json file_types/json/sources_google2-schema.json --generate-sql
```

This will create an SQL file with the necessary ALTER TABLE statements to bring the database schema in line with the JSON definition.

### Execute Schema Updates

To apply schema changes directly to the database:

```bash
./scripts/cli-pipeline/google_sync/google-drive-cli.sh update-schema-from-json file_types/json/sources_google2-schema.json --execute --generate-sql
```

**WARNING**: This will modify the database schema directly. Always back up your database before executing schema changes.

## Workflow for Schema Updates

1. Export the current schema from Supabase UI or API
2. Make desired modifications to the schema JSON file
3. Run the check command to verify differences
4. Generate an SQL migration script
5. Review the script for correctness
6. Execute the script in a test environment
7. When satisfied, execute in production

## Related Sources Management Commands

The Google Drive CLI also includes commands for managing the data in the `sources_google2` table:

- `update-sources-from-json`: Update existing records from a JSON file
- `insert-missing-sources`: Insert records from JSON that don't exist in the database

These commands complement the schema management functionality by ensuring the data structure and content stay synchronized.