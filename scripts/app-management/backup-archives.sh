#!/bin/bash

# backup-archives.sh - Create a timestamped backup of all .archive* directories
# This script finds and backs up all archived content in the monorepo

set -e  # Exit on any error

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Archive Backup Tool ===${NC}"
echo "Creating backup of all .archive* directories..."

# Set backup directory and filename
BACKUP_DIR="${HOME}/dhg-mono-archive-backups"
BACKUP_DATE=$(date +%Y%m%d-%H%M%S)
BACKUP_NAME="dhg-mono-archives-${BACKUP_DATE}.tar.gz"
BACKUP_PATH="${BACKUP_DIR}/${BACKUP_NAME}"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Find all archive directories
echo -e "\n${YELLOW}Finding archive directories...${NC}"
ARCHIVE_DIRS=$(find . -type d -name ".archive*" 2>/dev/null | sort)
ARCHIVE_COUNT=$(echo "$ARCHIVE_DIRS" | wc -l | tr -d ' ')

echo -e "Found ${GREEN}${ARCHIVE_COUNT}${NC} archive directories:"
echo "$ARCHIVE_DIRS" | head -10
if [ $ARCHIVE_COUNT -gt 10 ]; then
    echo "... and $((ARCHIVE_COUNT - 10)) more"
fi

# Calculate total size
echo -e "\n${YELLOW}Calculating total size...${NC}"
TOTAL_SIZE=$(du -ch $(find . -type d -name ".archive*" 2>/dev/null) 2>/dev/null | tail -1 | cut -f1)
echo -e "Total archive size: ${GREEN}${TOTAL_SIZE}${NC}"

# Create the tar archive
echo -e "\n${YELLOW}Creating backup archive...${NC}"
echo "Destination: $BACKUP_PATH"

# Use find to generate file list and tar to create archive
# This approach handles spaces in filenames properly
find . -type d -name ".archive*" -print0 2>/dev/null | \
    tar -czf "$BACKUP_PATH" \
        --null -T - \
        --exclude="node_modules" \
        --exclude=".git" \
        2>/dev/null

# Verify the backup
if [ -f "$BACKUP_PATH" ]; then
    BACKUP_SIZE=$(du -h "$BACKUP_PATH" | cut -f1)
    echo -e "\n${GREEN}✅ Backup created successfully!${NC}"
    echo -e "File: ${BACKUP_NAME}"
    echo -e "Size: ${BACKUP_SIZE}"
    echo -e "Location: ${BACKUP_PATH}"
    
    # List recent backups
    echo -e "\n${BLUE}Recent backups:${NC}"
    ls -lht "$BACKUP_DIR" | head -6
else
    echo -e "\n${RED}❌ Error: Backup creation failed!${NC}"
    exit 1
fi

# Optional: Copy to additional locations
echo -e "\n${YELLOW}Additional backup options:${NC}"
echo "1. Copy to external drive:"
echo "   cp \"$BACKUP_PATH\" /Volumes/BackupDrive/"
echo ""
echo "2. Upload to Google Drive using rclone:"
echo "   rclone copy \"$BACKUP_PATH\" gdrive:dhg-mono-archives/"
echo ""
echo "3. Copy to another machine:"
echo "   scp \"$BACKUP_PATH\" user@backup-server:~/backups/"

echo -e "\n${GREEN}Done!${NC}"