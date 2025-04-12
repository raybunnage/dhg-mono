#!/bin/bash
# This script runs the migration process for sources_google to sources_google
# It includes safeguards and validation steps to ensure data integrity

set -e  # Exit on any error

# Configuration
SCRIPTS_DIR="$(dirname "$0")"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Sources Google Migration Tool${NC}"
echo "This script will migrate the sources_google table to an improved sources_google schema."
echo "The process has multiple phases with validation between each step."
echo ""

# Check if required environment variables are set
if [ -z "$VITE_SUPABASE_URL" ] || [ -z "$VITE_SUPABASE_SERVICE_ROLE_KEY" ]; then
  echo -e "${RED}Error: Required environment variables are not set${NC}"
  echo "Please set the following environment variables:"
  echo "  - VITE_SUPABASE_URL"
  echo "  - VITE_SUPABASE_SERVICE_ROLE_KEY"
  exit 1
fi

# Phase 1: Initial data migration
echo -e "${YELLOW}Phase 1: Performing initial data migration...${NC}"
echo "This phase will:"
echo "- Copy data from sources_google to sources_google"
echo "- Fix path structures and ensure no NULL root_drive_id values"
echo "- Ensure all Dynamic Healing Group files are properly identified"
read -p "Run Phase 1? (y/n): " RUN_PHASE1

if [ "$RUN_PHASE1" == "y" ]; then
  echo "Running Phase 1 via TypeScript CLI..."
  ts-node google-drive-manager.ts migrate-table --phase 1
else
  echo "Phase 1 skipped."
fi

# Phase 2: Enhanced traversal and main_video_id
echo -e "${YELLOW}Phase 2: Recursive traversal and main_video_id association...${NC}"
echo "This phase will:"
echo "- Add main_video_id associations for presentation files"
echo "- Further enhance path structures and relationships"
echo "- Ensure all videos have proper context"
read -p "Run Phase 2? (y/n): " RUN_PHASE2

if [ "$RUN_PHASE2" == "y" ]; then
  echo "Running Phase 2 via TypeScript CLI..."
  ts-node google-drive-manager.ts migrate-table --phase 2
else
  echo "Phase 2 skipped."
fi

# Validation
echo -e "${YELLOW}Running validation...${NC}"
echo "This will check:"
echo "- Data integrity between the original and new tables"
echo "- Path structure and root_drive_id consistency"
echo "- Main video association correctness"
read -p "Run validation? (y/n): " RUN_VALIDATION

if [ "$RUN_VALIDATION" == "y" ]; then
  echo "Running validation via TypeScript CLI..."
  ts-node google-drive-manager.ts migrate-table --validate-only
else
  echo "Validation skipped."
fi

# Finalization
echo -e "${YELLOW}Finalization...${NC}"
echo "This will:"
echo "- Rename sources_google to sources_google_deprecated"
echo "- Rename sources_google to sources_google"
echo "- Create a compatibility view for existing applications"
echo -e "${RED}WARNING: This step will affect running applications!${NC}"
read -p "Finalize the migration? (y/n): " FINALIZE

if [ "$FINALIZE" == "y" ]; then
  echo "Running finalization via TypeScript CLI..."
  ts-node google-drive-manager.ts migrate-table --finalize
else
  echo "Finalization skipped."
  echo "You can finalize later with:"
  echo "ts-node google-drive-manager.ts migrate-table --finalize"
fi

echo ""
echo -e "${GREEN}Migration process complete!${NC}"
exit 0