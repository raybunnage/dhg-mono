#!/bin/bash

# Get the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/../.." && pwd )"

# Stop any running dev servers (you'll need to do this manually)
echo "Please ensure all dev servers are stopped"

# Clear Vite cache
rm -rf "$PROJECT_ROOT/node_modules/.vite"
rm -rf "$PROJECT_ROOT/.vite"
rm -rf "$PROJECT_ROOT/dist"

# Clear module cache
rm -rf "$PROJECT_ROOT/node_modules/.cache"
cd "$PROJECT_ROOT" && pnpm store prune

# Reinstall dependencies
cd "$PROJECT_ROOT" && pnpm install

echo "Cache cleared! You can now restart your dev server" 