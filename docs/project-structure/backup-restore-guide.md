# Backup and Restore System Guide

## Overview
The backup system helps manage configuration files across the monorepo, making it safe to experiment with changes and switch between branches.

## Quick Reference

### Creating Backups
```bash
# Run from root directory only

# Basic backup (timestamp as name)
pnpm backup-configs

# Named backup
pnpm backup-configs my-backup

# Full context backup (recommended)
pnpm backup-configs my-backup dhg-a "Description of changes"

# Example:
pnpm backup-configs pre-ssr dhg-a "Clean config before adding SSR support"
```

### Listing Backups
```bash
# List all backups
pnpm list-backups

# List today's backups
pnpm list-backups $(date +%Y-%m-%d)

# List specific date
pnpm list-backups 2024-02-07
```

### Restoring Backups
```bash
# List available backups first
pnpm list-backups

# Restore specific backup
pnpm restore-configs backup-name
```

## What Gets Backed Up

### Root Level
- package.json
- pnpm-lock.yaml
- pnpm-workspace.yaml
- turbo.json
- netlify.toml
- vite.config.* files
- .env files

### For Each App
- package.json
- netlify.toml
- vite.config.* files
- .env files

## Backup Storage Structure
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
                        └── app-specific-configs
```

## Common Workflows

### Before Major Changes
```bash
# 1. Create backup
pnpm backup-configs pre-change dhg-a "Clean state before X changes"

# 2. Make changes...

# 3. If something goes wrong
pnpm list-backups
pnpm restore-configs pre-change
```

### Before Switching Branches
```bash
# 1. Backup current state
pnpm backup-configs main-stable dhg-a "Working configuration on main"

# 2. Switch branches
git checkout development

# 3. If needed, restore main config
pnpm restore-configs main-stable
```

### Regular Checkpoints
```bash
# Morning backup
pnpm backup-configs morning-checkpoint dhg-a "Working state start of day"

# Before end of day
pnpm backup-configs eod-checkpoint dhg-a "End of day working state"
```

## Best Practices

1. **Descriptive Names**
   - Use meaningful backup names
   - Include the purpose in the description
   - Specify which app you're working on

2. **Regular Backups**
   - Before major configuration changes
   - Before switching branches
   - At key development milestones
   - End of day if making progress

3. **Backup Organization**
   - Backups are organized by date automatically
   - Use the list command to find specific backups
   - Clean up old backups periodically

4. **Restore Verification**
   - List backups before restoring
   - Verify the timestamp and description
   - Make sure you're restoring the right version

## Troubleshooting

### Common Issues
1. **Command Not Found**
   ```bash
   # Make scripts executable
   chmod +x scripts/app-management/*.sh
   ```

2. **Backup Directory Missing**
   ```bash
   # Create backup directory
   mkdir -p .backups/configs
   ```

3. **Wrong Directory**
   - Always run commands from root directory
   - Check current directory with `pwd`

### Backup Metadata
Each backup includes metadata:
- Timestamp
- Date
- Active App
- Description
- Backup Name

## Maintenance

1. **Viewing Backup Contents**
   ```bash
   # List files in a backup
   ls -R .backups/configs/YYYY/MM/DD/backup-name
   ```

2. **Cleaning Old Backups**
   - Backups are organized by date
   - Remove old date directories as needed
   - Keep important milestone backups

## Security Notes
- Backup directory (.backups) is git-ignored
- Environment files are included in backups
- Keep backups secure if they contain sensitive data 