#!/bin/bash

# Script to start the local markdown server for development
# This allows direct file reading from disk
# No external dependencies required!

# Start the simple server
echo "Starting simple markdown file server on port 3001..."
echo "NOTE: Ignore any localhost:5174 connection errors in the browser console."
echo "      Those are related to Vite HMR, not the markdown server."
node simple-md-server.js

# If the server fails to start, show an error message
if [ $? -ne 0 ]; then
  echo "Error starting markdown server"
  echo "Try running 'node simple-md-server.js' directly to see the error"
  exit 1
fi