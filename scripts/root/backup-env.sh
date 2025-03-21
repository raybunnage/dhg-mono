#!/bin/bash

# Get the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/../.." && pwd )"

# Create backup directory with timestamp
BACKUP_DIR="$PROJECT_ROOT/.backups/env/$(date +%Y-%m-%d)"
mkdir -p "$BACKUP_DIR"

# Timestamp for backup files
TIMESTAMP=$(date +%Y-%m-%d-%H%M%S)

# Backup root env files
for file in .env .env.example .env.development .env.production; do
    if [ -f "$PROJECT_ROOT/$file" ]; then
        cp "$PROJECT_ROOT/$file" "$BACKUP_DIR/${file}.${TIMESTAMP}.backup"
        echo "Backed up $file"
    fi
done

# Backup app-specific env files
if [ -f "$PROJECT_ROOT/apps/dhg-improve-experts/.env.development" ]; then
    cp "$PROJECT_ROOT/apps/dhg-improve-experts/.env.development" "$BACKUP_DIR/dhg-improve-experts.env.development.${TIMESTAMP}.backup"
    echo "Backed up apps/dhg-improve-experts/.env.development"
fi

echo "Backup completed to $BACKUP_DIR" 