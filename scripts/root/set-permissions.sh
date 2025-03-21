#!/bin/bash

# Get the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/../.." && pwd )"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Setting script permissions...${NC}"

# Make all .sh files executable
find "$PROJECT_ROOT" -type f -name "*.sh" -exec chmod +x {} \;

# Make specific scripts executable
chmod +x "$PROJECT_ROOT/supabase/scripts/update-schema.sh"
chmod +x "$PROJECT_ROOT/scripts/root/set-permissions.sh"

echo -e "${GREEN}Script permissions updated successfully!${NC}" 