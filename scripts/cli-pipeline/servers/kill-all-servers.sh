#!/usr/bin/env bash

# Kill All Servers Script
# This script finds and kills all running development servers

echo "🛑 Killing all development servers..."

# Function to kill processes on a specific port
kill_port() {
  local port=$1
  local name=$2
  
  if lsof -ti:$port > /dev/null 2>&1; then
    echo "  Killing $name on port $port..."
    lsof -ti:$port | xargs kill -9 2>/dev/null || true
  else
    echo "  $name (port $port) - not running"
  fi
}

# Kill all known server ports
kill_port 3001 "Markdown Server"
kill_port 3002 "Script Server"
kill_port 3003 "Docs Archive Server"
kill_port 3004 "File Browser Server"
kill_port 3005 "Git Server"
kill_port 3006 "Web Audio Server"
kill_port 3007 "Local Audio Server"
kill_port 3008 "Living Docs Server"
kill_port 3009 "Git API Server"
kill_port 3010 "Worktree Switcher"
kill_port 3011 "Git History Server"
kill_port 3012 "Test Runner Server"

# Also kill by process name patterns
echo ""
echo "🔍 Checking for lingering node processes..."

# Kill specific server processes by name
pkill -f "simple-md-server.js" 2>/dev/null || true
pkill -f "simple-script-server.js" 2>/dev/null || true
pkill -f "docs-archive-server.js" 2>/dev/null || true
pkill -f "git-server.cjs" 2>/dev/null || true
pkill -f "living-docs-server.cjs" 2>/dev/null || true
pkill -f "continuous-docs-server.cjs" 2>/dev/null || true  # Old name
pkill -f "git-api-server.cjs" 2>/dev/null || true
pkill -f "server-enhanced.js" 2>/dev/null || true
pkill -f "server-selector.js" 2>/dev/null || true
pkill -f "worktree-switcher-server.js" 2>/dev/null || true
pkill -f "git-history-server.js" 2>/dev/null || true
pkill -f "test-runner-server.cjs" 2>/dev/null || true

# Kill start-all-servers processes
pkill -f "start-all-servers.js" 2>/dev/null || true
pkill -f "start-all-servers-dynamic.js" 2>/dev/null || true

echo ""
echo "✅ All servers have been killed"
echo ""
echo "To start servers again, run:"
echo "  pnpm servers"
echo ""
echo "To check if any servers are still running:"
echo "  lsof -i :3001-3012"