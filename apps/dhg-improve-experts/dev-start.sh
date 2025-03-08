#!/bin/bash

# This script starts both the Vite dev server and the Express server

# Make documentation update script executable
echo "Making documentation update script executable..."
chmod +x scripts/update-docs-database.sh

# Start Express server in background
echo "Starting Express server for API proxying..."
node server.js &
EXPRESS_PID=$!

# Start Vite dev server in foreground
echo "Starting Vite dev server..."
npx vite

# When Vite exits, kill Express server
kill $EXPRESS_PID