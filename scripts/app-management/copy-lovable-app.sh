#!/bin/bash

# Usage: ./scripts/app-management/copy-lovable-app.sh /path/to/source/app new-app-name

SOURCE_DIR=$1
APP_NAME=$2
TARGET_DIR="apps/dhg-$APP_NAME"

if [ -z "$SOURCE_DIR" ]; then
  echo "Usage: ./copy-lovable-app.sh <source-directory> <app-name>"
  echo "Example: ./copy-lovable-app.sh ../healing-hubster-network lovable"
  exit 1
fi

# Create app directory in target location
mkdir -p "$TARGET_DIR"

# Copy source files and configs
(
  cd "$SOURCE_DIR"
  # Copy all git-tracked files
  git ls-files | while read -r file; do
    # Create target directory if it doesn't exist
    mkdir -p "$(dirname "$TARGET_DIR/$file")"
    # Copy the file
    cp "$file" "$TARGET_DIR/$file"
  done

  # Also copy important config files that might be git-ignored
  for config_file in .env* vite.config.* netlify.toml package.json tsconfig.json; do
    if [ -f "$config_file" ]; then
      cp "$config_file" "$TARGET_DIR/"
    fi
  done
)

# Update package.json with new app name
sed -i '' "s/\"name\": \".*\"/\"name\": \"dhg-$APP_NAME\"/" "$TARGET_DIR/package.json"

echo "Created new app dhg-$APP_NAME in monorepo"
echo "Next steps:"
echo "1. cd $TARGET_DIR"
echo "2. Review and update configs for monorepo"
echo "3. pnpm install"
echo "4. pnpm dev" 