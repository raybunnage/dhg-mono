#!/bin/bash

# Script to test the path resolution in start-md-server.sh without starting the server

# Source the script but override the port check and the server start
# This will run everything up to the port check and server start

# Create modified version of start-md-server.sh where we replace the node command
# with echo and skip port check

cat > /tmp/test-start-md.sh << 'EOF'
#!/bin/bash

# Get script directory (in viewers folder)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_SCRIPT="${SCRIPT_DIR}/simple-md-server.js"

# Check if the server script exists
if [ ! -f "${SERVER_SCRIPT}" ]; then
  echo "Error: Cannot find simple-md-server.js at ${SERVER_SCRIPT}"
  exit 1
fi

# Skip port check to avoid errors
echo "Path test: The script directory is: ${SCRIPT_DIR}"
echo "Path test: The server script is: ${SERVER_SCRIPT}"
echo "Path test: File exists check passed successfully"

# Instead of starting the server, just show success
echo "Server would start with command: node --experimental-modules \"${SERVER_SCRIPT}\""
EOF

# Make the test script executable
chmod +x /tmp/test-start-md.sh

# Run the test script
/tmp/test-start-md.sh