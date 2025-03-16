#!/bin/bash

# Create backup directory with timestamp
BACKUP_DIR=".backups/env/$(date +%Y-%m-%d)"
mkdir -p "$BACKUP_DIR"

# Timestamp for backup files
TIMESTAMP=$(date +%Y-%m-%d-%H%M%S)

# Backup root env files
for file in .env .env.example .env.development .env.production; do
    if [ -f "$file" ]; then
        cp "$file" "$BACKUP_DIR/${file}.${TIMESTAMP}.backup"
        echo "Backed up $file"
    fi
done

# Backup app-specific env files
if [ -f "apps/dhg-improve-experts/.env.development" ]; then
    cp apps/dhg-improve-experts/.env.development "$BACKUP_DIR/dhg-improve-experts.env.development.${TIMESTAMP}.backup"
    echo "Backed up apps/dhg-improve-experts/.env.development"
fi

echo "Backup completed to $BACKUP_DIR" 