#!/bin/bash

# Test script to understand the path resolution issue

# Print current directory
echo "Current working directory: $(pwd)"

# Run the start script with --dry-run to prevent actual server start
# Just modify it to echo paths instead of running

SCRIPT_DIR="/Users/raybunnage/Documents/github/dhg-mono/scripts/cli-pipeline/viewers"
TEMP_SCRIPT="${SCRIPT_DIR}/test-md-server-internal.sh"

# Create temporary script
cat > "$TEMP_SCRIPT" << 'EOF'
#!/bin/bash

# Get script directory 
CURRENT_DIR="$(pwd)"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_SCRIPT="${SCRIPT_DIR}/simple-md-server.js"

echo "---------------------------------------------"
echo "Current directory: $CURRENT_DIR"
echo "Script directory: $SCRIPT_DIR"
echo "Server script path: $SERVER_SCRIPT"

# Check if the server script exists
if [ -f "${SERVER_SCRIPT}" ]; then
  echo "✅ Server script file exists!"
else
  echo "❌ Server script file not found!"
fi
echo "---------------------------------------------"
EOF

chmod +x "$TEMP_SCRIPT"

# Run the test script directly 
cd "$SCRIPT_DIR" && "$TEMP_SCRIPT"

# Clean up
rm "$TEMP_SCRIPT"