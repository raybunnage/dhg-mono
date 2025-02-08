#!/bin/bash

# Usage: Must be run from root directory
# Command: pnpm backup-configs [backup-name] [active-app] [description]
# If no backup name provided, uses current date-time

BACKUP_NAME=${1:-$(date +%Y%m%d_%H%M%S)}
ACTIVE_APP=$2
DESCRIPTION=$3
DATE_PATH=$(date +%Y/%m/%d)
BACKUP_DIR=".backups/configs/$DATE_PATH/$BACKUP_NAME"

# Create backup directory
mkdir -p "$BACKUP_DIR"
mkdir -p "$BACKUP_DIR/apps"

# Save metadata
cat > "$BACKUP_DIR/metadata.json" << EOF
{
  "timestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "date": "$(date +%Y-%m-%d)",
  "name": "$BACKUP_NAME",
  "activeApp": "$ACTIVE_APP",
  "description": "$DESCRIPTION"
}
EOF

echo "Creating backup '$BACKUP_NAME'"
[ ! -z "$ACTIVE_APP" ] && echo "Active app: $ACTIVE_APP"
[ ! -z "$DESCRIPTION" ] && echo "Description: $DESCRIPTION"

# Backup root config files
echo "Backing up root configuration files..."
cp netlify.toml "$BACKUP_DIR/" 2>/dev/null || echo "No root netlify.toml found"
cp package.json "$BACKUP_DIR/" 2>/dev/null || echo "No root package.json found"
cp pnpm-lock.yaml "$BACKUP_DIR/" 2>/dev/null || echo "No pnpm-lock.yaml found"
cp pnpm-workspace.yaml "$BACKUP_DIR/" 2>/dev/null || echo "No pnpm-workspace.yaml found"
cp turbo.json "$BACKUP_DIR/" 2>/dev/null || echo "No turbo.json found"
cp vite.config.* "$BACKUP_DIR/" 2>/dev/null || echo "No root vite config files found"
cp vite.config.base.js "$BACKUP_DIR/" 2>/dev/null || echo "No root vite base config found"
cp .env* "$BACKUP_DIR/" 2>/dev/null || echo "No root .env files found"

# Backup app-specific config files
for APP_DIR in apps/*; do
    if [ -d "$APP_DIR" ]; then
        APP_NAME=$(basename "$APP_DIR")
        echo "Backing up configuration for $APP_NAME..."
        
        # Create app-specific backup directory
        mkdir -p "$BACKUP_DIR/apps/$APP_NAME"
        
        # Backup app config files
        cp "$APP_DIR/netlify.toml" "$BACKUP_DIR/apps/$APP_NAME/" 2>/dev/null || echo "No netlify.toml found for $APP_NAME"
        cp "$APP_DIR/package.json" "$BACKUP_DIR/apps/$APP_NAME/" 2>/dev/null || echo "No package.json found for $APP_NAME"
        # Handle Vite config files more explicitly
        if [ -f "$APP_DIR/vite.config.js" ]; then
            echo "Found vite.config.js in $APP_DIR, copying..."
            cp "$APP_DIR/vite.config.js" "$BACKUP_DIR/apps/$APP_NAME/"
            echo "Copied vite.config.js to $BACKUP_DIR/apps/$APP_NAME/"
        fi
        if [ -f "$APP_DIR/vite.config.ts" ]; then
            cp "$APP_DIR/vite.config.ts" "$BACKUP_DIR/apps/$APP_NAME/"
        fi
        cp "$APP_DIR/.env"* "$BACKUP_DIR/apps/$APP_NAME/" 2>/dev/null || echo "No .env files found for $APP_NAME"
    fi
done

echo "Backup completed in $BACKUP_DIR" 