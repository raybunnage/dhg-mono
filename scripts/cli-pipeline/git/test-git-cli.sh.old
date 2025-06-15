#!/bin/bash

echo "Testing Git CLI Commands"
echo "======================="
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "1. Testing help command:"
"$SCRIPT_DIR/git-cli.sh" help
echo ""

echo "2. Testing health check:"
"$SCRIPT_DIR/git-cli.sh" health-check
echo ""

echo "3. Testing list worktrees:"
"$SCRIPT_DIR/git-cli.sh" list-worktrees
echo ""

echo "4. Testing merge queue list:"
"$SCRIPT_DIR/git-cli.sh" merge-queue-list
echo ""

echo "Test complete!"