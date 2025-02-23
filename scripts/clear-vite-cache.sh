#!/bin/bash

# Stop any running dev servers (you'll need to do this manually)
echo "Please ensure all dev servers are stopped"

# Clear Vite cache
rm -rf node_modules/.vite
rm -rf .vite
rm -rf dist

# Clear module cache
rm -rf node_modules/.cache
pnpm store prune

# Reinstall dependencies
pnpm install

echo "Cache cleared! You can now restart your dev server" 