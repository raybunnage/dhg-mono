#!/bin/bash

# Fresh Dev Script - Clears cache and starts dev server with latest code
# Usage: ./scripts/dev-fresh.sh <app-name>
# Example: ./scripts/dev-fresh.sh dhg-audio

if [ -z "$1" ]; then
    echo "❌ Error: Please provide an app name"
    echo "Usage: $0 <app-name>"
    echo "Example: $0 dhg-audio"
    echo ""
    echo "Available apps:"
    ls -1 apps/ | grep -v "^\." | sed 's/^/  - /'
    exit 1
fi

APP_NAME=$1
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
# Navigate up three levels: all_pipelines -> cli-pipeline -> scripts -> root
MONOREPO_ROOT="$(dirname "$(dirname "$(dirname "$SCRIPT_DIR")")")"
APP_PATH="$MONOREPO_ROOT/apps/$APP_NAME"

if [ ! -d "$APP_PATH" ]; then
    echo "❌ Error: App '$APP_NAME' not found"
    exit 1
fi

echo "🚀 Starting fresh development server for $APP_NAME..."
echo ""

# First, clear the cache
"$SCRIPT_DIR/clear-app-cache.sh" "$APP_NAME"

# Navigate to app directory
cd "$APP_PATH"

# Start the dev server
echo "🔧 Starting development server..."
echo "   Press Ctrl+C to stop"
echo ""

# Set environment to ensure fresh builds
export VITE_CJS_IGNORE_WARNING=true
export NODE_ENV=development

# Start with fresh node modules resolution
pnpm dev --force