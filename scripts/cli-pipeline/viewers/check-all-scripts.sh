#!/bin/bash

# Script to check path resolution for all start scripts

echo "Testing path resolution for all server start scripts..."

# Check archive server
echo -e "\n=========== START ARCHIVE SERVER ============"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ARCHIVE_SCRIPT="${SCRIPT_DIR}/docs-archive-server.js"
echo "docs-archive-server.js path: ${ARCHIVE_SCRIPT}"
if [ -f "${ARCHIVE_SCRIPT}" ]; then
  echo "✅ docs-archive-server.js exists"
else
  echo "❌ docs-archive-server.js not found"
fi

# Check script server
echo -e "\n=========== START SCRIPT SERVER ============"
SCRIPT_SERVER="${SCRIPT_DIR}/simple-script-server.js"
echo "simple-script-server.js path: ${SCRIPT_SERVER}"
if [ -f "${SCRIPT_SERVER}" ]; then
  echo "✅ simple-script-server.js exists"
else
  echo "❌ simple-script-server.js not found"
fi

# Check markdown server
echo -e "\n=========== START MARKDOWN SERVER ============"
MD_SERVER="${SCRIPT_DIR}/simple-md-server.js"
echo "simple-md-server.js path: ${MD_SERVER}"
if [ -f "${MD_SERVER}" ]; then
  echo "✅ simple-md-server.js exists"
else
  echo "❌ simple-md-server.js not found"
fi

echo -e "\n✅ All path checks complete!"