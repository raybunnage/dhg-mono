#!/bin/bash
# Script to show untyped scripts using the script-manager.sh function

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT_MANAGER="${SCRIPT_DIR}/script-manager.sh"

# Check if script-manager.sh exists
if [ ! -f "${SCRIPT_MANAGER}" ]; then
  echo "Error: Cannot find script-manager.sh at ${SCRIPT_MANAGER}"
  exit 1
fi

# Source the script-manager.sh to access its functions
source "${SCRIPT_MANAGER}"

# Run the show_untyped_scripts function
show_untyped_scripts

# Check exit code
if [ $? -ne 0 ]; then
  echo "Error showing untyped scripts"
  exit 1
fi