#!/bin/bash

# Usage: Must be run from root directory
# Command: pnpm list-backups [date]
# Date format: YYYY-MM-DD or YYYY/MM/DD

BACKUP_DIR=".backups/configs"
SEARCH_DATE=$1

if [ ! -d "$BACKUP_DIR" ]; then
    echo "No backups found"
    exit 0
fi

function list_backups() {
    local search_path=$1
    for backup in "$search_path"/*; do
        if [ -f "$backup/metadata.json" ]; then
            echo "Name: $(basename "$backup")"
            echo "Details:"
            cat "$backup/metadata.json" | jq -r '. | 
                "  Timestamp: \(.timestamp)",
                "  Date: \(.date)",
                "  Active App: \(.activeApp // "none")",
                "  Description: \(.description // "no description")"
            '
            echo "-----------------"
        fi
    done
}

echo "Available backups:"
echo "-----------------"

if [ -z "$SEARCH_DATE" ]; then
    # List all backups
    find "$BACKUP_DIR" -type f -name "metadata.json" -exec dirname {} \; | while read backup; do
        list_backups "$backup"
    done
else
    # Convert date format if needed
    FORMATTED_DATE=$(echo "$SEARCH_DATE" | tr -d '-')
    YEAR=${FORMATTED_DATE:0:4}
    MONTH=${FORMATTED_DATE:4:2}
    DAY=${FORMATTED_DATE:6:2}
    
    SEARCH_PATH="$BACKUP_DIR/$YEAR/$MONTH/$DAY"
    
    if [ -d "$SEARCH_PATH" ]; then
        list_backups "$SEARCH_PATH"
    else
        echo "No backups found for date $SEARCH_DATE"
    fi
fi 