# Configuration Backup and Restore

## Initial Setup
First, create the backup directory and make scripts executable (run from root directory):
```bash
# Create backup directory
mkdir -p .backups/configs

# Make all scripts executable at once
chmod +x scripts/app-management/*.sh

# Or individually
chmod +x scripts/app-management/backup-configs.sh
chmod +x scripts/app-management/restore-configs.sh
```

## Backing Up Configurations

Before making significant changes or switching branches, you can backup all configuration files:

```bash
# Run from root directory only

# Basic backup with auto-generated name
pnpm backup-configs

# Backup with custom name
pnpm backup-configs my-backup-name

# Backup with active app context
pnpm backup-configs my-backup-name dhg-a

# Full backup with description
pnpm backup-configs my-backup-name dhg-a "Updated Vite config for SSR support"
```

This will backup:
- Root config files (package.json, turbo.json, etc.)
- App-specific configs
- Environment files
- Build configurations

## Listing Backups

View all backups with their details:

```bash
# Run from root directory only

# List all backups
pnpm list-backups

# List backups for a specific date
pnpm list-backups 2024-02-07
# or
pnpm list-backups 2024/02/07
```

Example output:
```
Available backups:
-----------------
Name: main-stable
Details:
  Timestamp: 2024-02-07T15:30:00Z
  Date: 2024-02-07
  Active App: dhg-a
  Description: Updated Vite config for SSR support
-----------------
```

## Restoring Configurations

To restore a previous backup:

```bash
# Run from root directory only
# List available backups
pnpm restore-configs

# Restore specific backup
pnpm restore-configs my-backup-name
```

## What Gets Backed Up

### Storage Location
All backups are stored in `.backups/configs/` at the root of the monorepo:
```
.backups/
└── configs/
    └── YYYY/
        └── MM/
            └── DD/
                └── backup-name/
                    ├── metadata.json
                    ├── package.json
                    └── apps/
                        └── app-configs...
```

This directory is git-ignored and should not be committed to source control.

### Root Level
- netlify.toml
- package.json
- pnpm-lock.yaml
- pnpm-workspace.yaml
- turbo.json
- vite.config.* (all vite config files)
- .env files

### For Each App
- netlify.toml
- package.json
- vite.config.* (all vite config files)
- .env files

## Best Practices
1. Always backup before:
   - Switching to a new branch
   - Making major configuration changes
   - Running migration scripts
2. Use descriptive backup names
3. Test restore functionality periodically
4. Keep your file_types/config-backups directory in .gitignore

## Command Location
These commands must ALWAYS be run from the root directory of the monorepo:
```bash
# ✅ Correct (from root)
cd /path/to/dhg-mono
pnpm backup-configs main-stable

# ❌ Incorrect (from app directory)
cd apps/dhg-a
pnpm backup-configs  # This will fail!
``` 