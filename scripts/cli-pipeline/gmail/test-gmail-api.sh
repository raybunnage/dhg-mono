#!/bin/bash

# Test Gmail API connection
# This script verifies that your Gmail API credentials are properly configured

set -e

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/../../.." && pwd )"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m'

echo -e "${GREEN}Gmail API Connection Test${NC}"
echo "========================="
echo ""

# Check for Python
if ! command -v python3 &> /dev/null; then
    echo "Error: Python 3 is required but not installed."
    exit 1
fi

# Run the test
cd "$PROJECT_ROOT"
python3 "$SCRIPT_DIR/test-gmail-api.py"