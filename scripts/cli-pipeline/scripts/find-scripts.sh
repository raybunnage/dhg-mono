#!/bin/bash
# find-scripts.sh - A direct find command to see what scripts we have in specific directories

# Path to the CLI pipeline directory
CLI_PIPELINE_DIR="/Users/raybunnage/Documents/github/dhg-mono/scripts/cli-pipeline"

# Use the same find command we're using in the TypeScript code
echo "Using exact same command as in TypeScript code:"
find "$CLI_PIPELINE_DIR" -type f \( -name "*.sh" -o -name "*.js" -o -name "*.ts" \) | grep -v "node_modules" | grep -v "\.archived" | grep -v "\.backup" | grep -v "\.test\." | grep -v "\.spec\." | grep -v "\.min\." | wc -l

# List all the actual files we're finding
echo ""
echo "Listing all found files:"
find "$CLI_PIPELINE_DIR" -type f \( -name "*.sh" -o -name "*.js" -o -name "*.ts" \) | grep -v "node_modules" | grep -v "\.archived" | grep -v "\.backup" | grep -v "\.test\." | grep -v "\.spec\." | grep -v "\.min\." | sort

# Count per directory 
echo ""
echo "Count of scripts by directory:"
find "$CLI_PIPELINE_DIR" -type f \( -name "*.sh" -o -name "*.js" -o -name "*.ts" \) | grep -v "node_modules" | grep -v "\.archived" | grep -v "\.backup" | grep -v "\.test\." | grep -v "\.spec\." | grep -v "\.min\." | sort | grep -o "^.*/[^/]*/" | sort | uniq -c | sort -nr

# List all directories in the cli-pipeline directory with script counts
echo ""
echo "Directories in CLI pipeline with script counts:"
DIRS=$(find "$CLI_PIPELINE_DIR" -type d -not -path "*/\.*" -not -path "*/node_modules*" | sort)

for DIR in $DIRS; do
  COUNT=$(find "$DIR" -maxdepth 1 -type f \( -name "*.sh" -o -name "*.js" -o -name "*.ts" \) | grep -v "\.test\." | grep -v "\.spec\." | grep -v "\.min\." | wc -l)
  if [ "$COUNT" -gt 0 ]; then
    echo "$DIR: $COUNT scripts"
  fi
done