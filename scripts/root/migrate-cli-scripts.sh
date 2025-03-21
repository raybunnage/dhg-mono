#!/bin/bash

# Create backup of both script directories
TIMESTAMP=$(date +%Y-%m-%d-%H%M%S)
mkdir -p .backups/scripts/$TIMESTAMP
cp -r packages/cli/scripts/ .backups/scripts/$TIMESTAMP/cli-scripts-backup
cp -r packages/scripts/ .backups/scripts/$TIMESTAMP/packages-scripts-backup

# Create comparison file
diff -r packages/cli/scripts/ packages/scripts/ > .backups/scripts/$TIMESTAMP/scripts-diff.txt

echo "Backup created at .backups/scripts/$TIMESTAMP"
echo "Diff file created at .backups/scripts/$TIMESTAMP/scripts-diff.txt" 