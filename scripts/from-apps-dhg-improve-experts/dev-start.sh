#!/bin/bash

# This script starts both the Vite dev server and the Express server

# Make documentation update script executable
echo "Making documentation update script executable..."
chmod +x scripts/update-docs-database.sh

# Make sure node_modules is properly linked
echo "Checking node modules..."
if [ ! -d "node_modules" ] || [ ! -f "node_modules/.modules.yaml" ]; then
  echo "node_modules not found or incomplete, running npm install..."
  npm install
fi

# Start Express server in background
echo "Starting Express server for API proxying..."
node server.js &
EXPRESS_PID=$!

# Start Vite dev server in foreground
echo "Starting Vite dev server..."
npx vite

# When Vite exits, kill Express server
kill $EXPRESS_PID