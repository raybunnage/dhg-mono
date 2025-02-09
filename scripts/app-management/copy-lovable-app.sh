#!/bin/bash

# Usage: ./scripts/app-management/copy-lovable-app.sh /path/to/source/app new-app-name

SOURCE_DIR=$1
APP_NAME=$2
TARGET_DIR="apps/dhg-$APP_NAME"

if [ -z "$SOURCE_DIR" ] || [ -z "$APP_NAME" ]; then
  echo "Usage: ./copy-lovable-app.sh <source-directory> <app-name>"
  echo "Example: ./copy-lovable-app.sh ../healing-hubster-network lovable"
  exit 1
fi

# Create app directory in target location
mkdir -p "$TARGET_DIR"

# Copy source files and configs
(
  # First verify we can access the source directory
  if [ ! -d "$SOURCE_DIR" ]; then
    echo "Error: Source directory $SOURCE_DIR not found"
    exit 1
  fi

  cd "$SOURCE_DIR" || exit 1
  
  # Debug output
  echo "Copying files from $SOURCE_DIR to $TARGET_DIR"
  echo "Current directory: $(pwd)"

  # Copy all git-tracked files
  git ls-files | while read -r file; do
    echo "Copying $file"
    # Create target directory if it doesn't exist
    mkdir -p "../dhg-mono/$TARGET_DIR/$(dirname "$file")"
    # Copy the file
    cp "$file" "../dhg-mono/$TARGET_DIR/$file"
  done

  # Also copy important config files that might be git-ignored
  for config_file in .env* vite.config.* netlify.toml package.json tsconfig.json; do
    if [ -f "$config_file" ]; then
      echo "Copying config file: $config_file"
      cp "$config_file" "../dhg-mono/$TARGET_DIR/"
    fi
  done
)

# Update package.json with new app name
if [ -f "$TARGET_DIR/package.json" ]; then
  sed -i '' "s/\"name\": \".*\"/\"name\": \"dhg-$APP_NAME\"/" "$TARGET_DIR/package.json"
fi

echo "Created new app dhg-$APP_NAME in monorepo"
echo "Next steps:"
echo "1. cd $TARGET_DIR"
echo "2. Review and update configs for monorepo"
echo "3. pnpm install"
echo "4. pnpm dev" 