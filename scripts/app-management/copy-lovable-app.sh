#!/bin/bash

# Usage: ./scripts/app-management/copy-lovable-app.sh /path/to/lovable/app app-name

SOURCE_DIR=$1
APP_NAME=$2
TARGET_DIR="file_types/$APP_NAME"

# Create target directory
mkdir -p "$TARGET_DIR"

# Use git ls-files to copy only source-controlled files
cd "$SOURCE_DIR" && \
git ls-files | while read file; do
    # Create target directory for the file
    mkdir -p "../$TARGET_DIR/$(dirname "$file")"
    # Copy the file
    cp "$file" "../$TARGET_DIR/$file"
done

echo "Copied source-controlled files from $SOURCE_DIR to $TARGET_DIR" 