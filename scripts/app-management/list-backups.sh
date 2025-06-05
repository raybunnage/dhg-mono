#!/bin/bash

# Usage: Must be run from root directory
# Command: pnpm list-backups [date]
# Date format: YYYY-MM-DD or YYYY/MM/DD

BACKUP_DIR=".backups/configs"
SEARCH_DATE=$1

function format_date() {
  date -d "$1" "+%Y-%m-%d %H:%M:%S" 2>/dev/null
}

function list_backups() {
  local year=$1
  local month=$2
  local day=$3

  echo "📂 $year/$month/$day:"
  echo "===================="
  
  for backup in "$BACKUP_DIR/$year/$month/$day"/*; do
    if [ -f "$backup/metadata.json" ]; then
      echo "📦 Backup: $(basename "$backup")"
      echo "   Details:"
      cat "$backup/metadata.json" | jq -r '. | 
        "   📅 Date: \(.date)",
        "   🕒 Time: \(.timestamp | sub("T"; " " ) | sub("Z"; ""))",
        "   📱 App: \(.activeApp // "none")",
        "   📝 Description: \(.description // "no description")"
      '
      # List key files in backup
      echo "   📑 Contains:"
      if [ -d "$backup/apps" ]; then
        for app_dir in "$backup/apps"/*; do
          if [ -d "$app_dir" ]; then
            echo "      - $(basename "$app_dir")/"
          fi
        done
      fi
      echo "-------------------"
    fi
  done
}

if [ ! -d "$BACKUP_DIR" ]; then
    echo "❌ No backups found"
    exit 0
fi

echo "🗄️  Available Backups:"
echo "===================="

if [ -z "$SEARCH_DATE" ]; then
    # List all backups organized by date
    for year in "$BACKUP_DIR"/*; do
        if [ -d "$year" ]; then
            for month in "$year"/*; do
                if [ -d "$month" ]; then
                    for day in "$month"/*; do
                        if [ -d "$day" ]; then
                            list_backups "$(basename "$year")" "$(basename "$month")" "$(basename "$day")"
                        fi
                    done
                fi
            done
        fi
    done
else
    # Convert date format if needed
    FORMATTED_DATE=$(echo "$SEARCH_DATE" | tr -d '-')
    YEAR=${FORMATTED_DATE:0:4}
    MONTH=${FORMATTED_DATE:4:2}
    DAY=${FORMATTED_DATE:6:2}
    
    if [ -d "$BACKUP_DIR/$YEAR/$MONTH/$DAY" ]; then
        list_backups "$YEAR" "$MONTH" "$DAY"
    else
        echo "❌ No backups found for date $SEARCH_DATE"
    fi
fi 