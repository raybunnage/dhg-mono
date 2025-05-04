#!/bin/bash

# Create test files
mkdir -p .backups/env/2024-02-16
touch .backups/env/2024-02-16/.env.2024-02-16-123456.backup
touch .backups/env/2024-02-16/dhg-improve-experts.env.development.2024-02-16-123456.backup
touch apps/dhg-improve-experts/.env.development.backup

# Check if files would be tracked
echo "Testing git status for backup files..."
git status -u .backups/
git status -u apps/dhg-improve-experts/

# Clean up test files
rm -rf .backups/env/2024-02-16
rm apps/dhg-improve-experts/.env.development.backup

echo "If no backup files were shown as untracked, the gitignore patterns are working correctly."
