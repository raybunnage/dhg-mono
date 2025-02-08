#!/bin/bash

# Backup environment configurations
# Usage: ./scripts/deployment/backup-env-configs.sh <app-name>

APP_NAME=$1
BACKUP_DIR="config-backups/environments"

if [ -z "$APP_NAME" ]; then
  echo "Usage: ./scripts/deployment/backup-env-configs.sh <app-name>"
  exit 1
fi

# Create backup directory
mkdir -p "$BACKUP_DIR/$APP_NAME"

# Backup environment files
cp "apps/$APP_NAME/.env.development" "$BACKUP_DIR/$APP_NAME/"
cp "apps/$APP_NAME/.env.production" "$BACKUP_DIR/$APP_NAME/"
cp "apps/$APP_NAME/netlify.toml" "$BACKUP_DIR/$APP_NAME/"

echo "Environment configs backed up to $BACKUP_DIR/$APP_NAME" 