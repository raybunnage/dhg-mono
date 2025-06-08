#!/bin/bash

# Start the Git API server on port 3009

echo "🚀 Starting Git API server on port 3009..."

cd "$(dirname "$0")/../apps/dhg-admin-code" || exit 1

# Kill any existing process on port 3009
lsof -ti:3009 | xargs kill -9 2>/dev/null || true

# Start the server
GIT_API_PORT=3009 node git-api-server.cjs