#!/bin/bash

# Master script to run all documentation organization scripts in order

# Set up colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Root directory of the monorepo
MONO_ROOT="/Users/raybunnage/Documents/github/dhg-mono"
APP_ROOT="$MONO_ROOT/apps/dhg-improve-experts"
SCRIPTS_DIR="$APP_ROOT/scripts/docs-organization"

# Make all scripts executable
chmod +x $SCRIPTS_DIR/*.sh

echo -e "${GREEN}Starting documentation organization process...${NC}"
echo

# Step 1: Generate a report of current state
echo -e "${BLUE}STEP 1: Generating documentation report...${NC}"
$SCRIPTS_DIR/generate-docs-report.sh
echo

# Step 2: Generate a tree view of docs
echo -e "${BLUE}STEP 2: Generating documentation tree...${NC}"
$SCRIPTS_DIR/tree-docs.sh
echo

# Step 3: Consolidate documentation
echo -e "${BLUE}STEP 3: Consolidating documentation...${NC}"
$SCRIPTS_DIR/consolidate-docs.sh
echo

# Step 4: Add frontmatter to docs
echo -e "${BLUE}STEP 4: Adding frontmatter to documentation...${NC}"
$SCRIPTS_DIR/add-frontmatter.sh
echo

# Step 5: Install gray-matter if needed (for docs-index.js)
echo -e "${BLUE}STEP 5: Installing dependencies for docs indexing...${NC}"
# Check if gray-matter is installed
if ! npm list gray-matter | grep -q "gray-matter"; then
  echo -e "${YELLOW}Installing gray-matter package...${NC}"
  npm install --save-dev gray-matter
fi
echo

# Step 6: Generate docs index
echo -e "${BLUE}STEP 6: Generating documentation index...${NC}"
node $SCRIPTS_DIR/docs-index.js
echo

# Step 7: Generate final report after changes
echo -e "${BLUE}STEP 7: Generating final documentation report...${NC}"
$SCRIPTS_DIR/generate-docs-report.sh
echo

# Step 8: Generate final tree
echo -e "${BLUE}STEP 8: Generating final documentation tree...${NC}"
$SCRIPTS_DIR/tree-docs.sh
echo

echo -e "${GREEN}Documentation organization process complete!${NC}"
echo
echo -e "${YELLOW}Next steps:${NC}"
echo -e "1. Review changes and remove any unwanted duplicates"
echo -e "2. Update references to moved documentation files"
echo -e "3. Configure your documentation dashboard to use the new docs-index.json file"