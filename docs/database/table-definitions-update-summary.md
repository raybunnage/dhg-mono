# Table Definitions Update Summary

## Date: 2025-06-07

### Tables Added to sys_table_definitions

Successfully added definitions for tables that were missing from `sys_table_definitions`:

#### Worktree Tables (2)
- `worktree_definitions` - Git worktree definitions for managing multiple development branches
- `worktree_app_mappings` - Maps applications to their assigned git worktrees

#### Registry Tables (4)
- `registry_scripts` - Registry of all scripts in the codebase
- `registry_services` - Registry of shared services across the monorepo
- `registry_apps` - Registry of applications in the monorepo
- `registry_cli_pipelines` - Registry of CLI pipeline scripts

#### Service Dependency Tables (4)
- `service_dependencies` - Service dependency relationships
- `service_dependency_analysis_runs` - History of dependency analysis runs
- `service_exports` - Exported functions and classes from services
- `service_command_dependencies` - Maps CLI commands to their service dependencies

#### Import Tables from SQLite (13)
- `import_emails` - Imported email data from SQLite database
- `import_attachments` - Imported email attachments from SQLite database
- `import_email_contents` - Imported email content bodies from SQLite database
- `import_email_concepts` - Imported email concept mappings from SQLite database
- `import_urls` - Imported URLs extracted from emails in SQLite database
- `import_all_email_urls` - Imported comprehensive email-URL mappings from SQLite
- `import_web_concepts` - Imported web concept definitions from SQLite database
- `import_experts` - Imported expert profiles from SQLite database
- `import_expert_profile_aliases` - Imported expert name aliases from SQLite database
- `import_all_authors` - Imported author information from SQLite database
- `import_important_email_addresses` - Imported list of important email addresses from SQLite
- `import_rolled_up_emails` - Imported aggregated email threads from SQLite database
- `import_hncs_file_names` - Imported HNCS-related filenames from SQLite database

### New CLI Command

Added `update-definitions` command to the database CLI:
```bash
./scripts/cli-pipeline/database/database-cli.sh update-definitions
```

This command automatically:
1. Checks which tables are missing from sys_table_definitions
2. Adds appropriate descriptions and purposes for each table
3. Sets creation dates based on when the tables were introduced
4. Provides a summary of what was added

### Notes

- All import_ tables are from the SQLite database migration performed on 2024-06-04
- Registry and service tables were added as part of the service dependency mapping system on 2025-06-06
- Worktree tables were added for the worktree management system on 2025-01-06
- The command is idempotent - it only adds definitions for tables that don't already have them