#!/bin/bash

# restore-archives.sh - Restore archived directories from backup
# This script restores .archive* directories from a tar backup

set -e  # Exit on any error

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Archive Restore Tool ===${NC}"

# Set backup directory
BACKUP_DIR="${HOME}/dhg-mono-archive-backups"

# Check if backup directory exists
if [ ! -d "$BACKUP_DIR" ]; then
    echo -e "${RED}Error: Backup directory not found at $BACKUP_DIR${NC}"
    exit 1
fi

# List available backups
echo -e "\n${YELLOW}Available backups:${NC}"
ls -lht "$BACKUP_DIR"/*.tar.gz 2>/dev/null | head -10 || {
    echo -e "${RED}No backup files found in $BACKUP_DIR${NC}"
    exit 1
}

# Get backup file from argument or ask user
if [ -n "$1" ]; then
    BACKUP_FILE="$1"
else
    echo -e "\n${YELLOW}Enter the backup filename to restore (or full path):${NC}"
    read -r BACKUP_FILE
fi

# If only filename provided, prepend backup directory
if [[ ! "$BACKUP_FILE" =~ ^/ ]]; then
    BACKUP_FILE="$BACKUP_DIR/$BACKUP_FILE"
fi

# Verify backup file exists
if [ ! -f "$BACKUP_FILE" ]; then
    echo -e "${RED}Error: Backup file not found: $BACKUP_FILE${NC}"
    exit 1
fi

echo -e "\n${YELLOW}Backup file details:${NC}"
ls -lh "$BACKUP_FILE"

# Ask for confirmation
echo -e "\n${YELLOW}This will extract archive directories from the backup.${NC}"
echo -e "${YELLOW}Existing .archive* directories will NOT be overwritten.${NC}"
echo -n "Continue? (y/N): "
read -r CONFIRM

if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
    echo "Restore cancelled."
    exit 0
fi

# Create temporary directory for extraction
TEMP_DIR=$(mktemp -d)
echo -e "\n${YELLOW}Extracting to temporary directory...${NC}"

# Extract the backup
tar -xzf "$BACKUP_FILE" -C "$TEMP_DIR"

# Show what was extracted
echo -e "\n${GREEN}Extracted archive directories:${NC}"
find "$TEMP_DIR" -type d -name ".archive*" | head -20

# Ask where to restore
echo -e "\n${YELLOW}Where would you like to restore the archives?${NC}"
echo "1. Current directory (merge with existing)"
echo "2. New directory (specify path)"
echo "3. Cancel"
echo -n "Choice (1-3): "
read -r CHOICE

case $CHOICE in
    1)
        RESTORE_DIR="."
        ;;
    2)
        echo -n "Enter target directory path: "
        read -r RESTORE_DIR
        mkdir -p "$RESTORE_DIR"
        ;;
    *)
        echo "Restore cancelled."
        rm -rf "$TEMP_DIR"
        exit 0
        ;;
esac

# Restore the archives
echo -e "\n${YELLOW}Restoring archives to $RESTORE_DIR...${NC}"

# Use rsync to merge without overwriting existing files
rsync -av --ignore-existing "$TEMP_DIR/" "$RESTORE_DIR/"

# Clean up
rm -rf "$TEMP_DIR"

echo -e "\n${GREEN}✅ Restore completed successfully!${NC}"
echo -e "Archives restored to: ${RESTORE_DIR}"

# Show restored directories
echo -e "\n${BLUE}Restored archive directories:${NC}"
find "$RESTORE_DIR" -type d -name ".archive*" 2>/dev/null | head -10