#!/bin/bash

echo "🚀 Starting Vite Environment Fix Proxy Server..."
echo ""
echo "This server allows you to fix Vite environment issues directly from your browser!"
echo "Leave this terminal window open while using the fix page."
echo ""

# Start the proxy server
ts-node scripts/cli-pipeline/utilities/vite-fix-proxy-server.ts