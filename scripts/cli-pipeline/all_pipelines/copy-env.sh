#!/bin/bash

# Copy .env.development files from dhg-mono to current worktree
# This script copies environment files from the main dhg-mono repository
# to the appropriate locations in the current worktree

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Source worktree path (dhg-mono)
SOURCE_REPO="/Users/raybunnage/Documents/github/dhg-mono"

# Current worktree path
CURRENT_REPO="/Users/raybunnage/Documents/github/dhg-mono-improve-audio"

# Check if source repo exists
if [ ! -d "$SOURCE_REPO" ]; then
    echo -e "${RED}Error: Source repository not found at $SOURCE_REPO${NC}"
    exit 1
fi

echo -e "${GREEN}Copying .env.development files from dhg-mono to current worktree...${NC}\n"

# Copy root .env.development
if [ -f "$SOURCE_REPO/.env.development" ]; then
    echo -e "${YELLOW}Copying root .env.development...${NC}"
    cp "$SOURCE_REPO/.env.development" "$CURRENT_REPO/.env.development"
    echo -e "${GREEN}✓ Copied to $CURRENT_REPO/.env.development${NC}"
else
    echo -e "${RED}✗ Root .env.development not found in source${NC}"
fi

echo ""

# Apps to check for .env.development files
APPS=(
    "dhg-a"
    "dhg-admin-code"
    "dhg-admin-google"
    "dhg-admin-suite"
    "dhg-audio"
    "dhg-b"
    "dhg-hub-lovable"
    "dhg-hub"
    "dhg-improve-experts"
)

# Copy app-specific .env.development files
for app in "${APPS[@]}"; do
    SOURCE_ENV="$SOURCE_REPO/apps/$app/.env.development"
    DEST_ENV="$CURRENT_REPO/apps/$app/.env.development"
    
    if [ -f "$SOURCE_ENV" ]; then
        echo -e "${YELLOW}Copying .env.development for $app...${NC}"
        # Create app directory if it doesn't exist
        mkdir -p "$CURRENT_REPO/apps/$app"
        cp "$SOURCE_ENV" "$DEST_ENV"
        echo -e "${GREEN}✓ Copied to apps/$app/.env.development${NC}"
    else
        echo -e "${RED}✗ No .env.development found for $app in source${NC}"
    fi
done

echo ""

# Also check for .service-account.json
if [ -f "$SOURCE_REPO/.service-account.json" ]; then
    echo -e "${YELLOW}Copying .service-account.json...${NC}"
    cp "$SOURCE_REPO/.service-account.json" "$CURRENT_REPO/.service-account.json"
    echo -e "${GREEN}✓ Copied .service-account.json (required for Google Drive access)${NC}"
else
    echo -e "${RED}✗ .service-account.json not found in source (required for Google Drive commands)${NC}"
fi

echo ""
echo -e "${GREEN}Environment file copy complete!${NC}"
echo ""
echo "Note: Make sure to review the copied files and update any environment-specific"
echo "values that might need to be different for this worktree."