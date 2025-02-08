#!/bin/bash

# Usage: Must be run from root directory
# Command: pnpm restore-configs <backup-name>
# Running without backup-name will list available backups

if [ -z "$1" ]; then
    echo "Error: Backup name required"
    echo "Available backups:"
    ls .backups/configs/
    exit 1
fi

BACKUP_DIR=".backups/configs/$1"

if [ ! -d "$BACKUP_DIR" ]; then
    echo "Error: Backup '$1' not found in file_types/config-backups/"
    echo "Available backups:"
    ls .backups/configs/
    exit 1
fi

# Restore root config files
echo "Restoring root configuration files..."
cp "$BACKUP_DIR/netlify.toml" ./ 2>/dev/null || echo "No root netlify.toml to restore"
cp "$BACKUP_DIR/package.json" ./ 2>/dev/null || echo "No root package.json to restore"
cp "$BACKUP_DIR/pnpm-lock.yaml" ./ 2>/dev/null || echo "No pnpm-lock.yaml to restore"
cp "$BACKUP_DIR/pnpm-workspace.yaml" ./ 2>/dev/null || echo "No pnpm-workspace.yaml to restore"
cp "$BACKUP_DIR/turbo.json" ./ 2>/dev/null || echo "No turbo.json to restore"
cp "$BACKUP_DIR/vite.config."* ./ 2>/dev/null || echo "No root vite config files to restore"
cp "$BACKUP_DIR/vite.config.base.js" ./ 2>/dev/null || echo "No root vite base config to restore"
cp "$BACKUP_DIR/.env"* ./ 2>/dev/null || echo "No root .env files to restore"

# Restore app-specific config files
for APP_BACKUP in "$BACKUP_DIR/apps"/*; do
    if [ -d "$APP_BACKUP" ]; then
        APP_NAME=$(basename "$APP_BACKUP")
        echo "Restoring configuration for $APP_NAME..."
        
        # Restore app config files
        cp "$APP_BACKUP/netlify.toml" "apps/$APP_NAME/" 2>/dev/null || echo "No netlify.toml to restore for $APP_NAME"
        cp "$APP_BACKUP/package.json" "apps/$APP_NAME/" 2>/dev/null || echo "No package.json to restore for $APP_NAME"
        cp "$APP_BACKUP/vite.config."* "apps/$APP_NAME/" 2>/dev/null || echo "No vite config files to restore for $APP_NAME"
        cp "$APP_BACKUP/.env"* "apps/$APP_NAME/" 2>/dev/null || echo "No .env files to restore for $APP_NAME"
    fi
done

echo "Restore completed from $BACKUP_DIR" 