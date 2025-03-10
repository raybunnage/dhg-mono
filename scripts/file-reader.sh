#!/bin/bash

# file-reader.sh - A script to read and display the contents of docs/markdown-report.md
# This script:
# 1. Checks if the file exists
# 2. Displays file metadata (size, permissions, last modified date)
# 3. Shows the total number of lines in the file
# 4. Displays the full content of the file with line numbers

# Define colors for better readability
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# Define the file path
REPO_ROOT="$(pwd)"
FILE_PATH="$REPO_ROOT/docs/markdown-report.md"

echo -e "${BOLD}${BLUE}=== Markdown Report File Reader ===${NC}\n"
echo -e "Repository root: ${CYAN}$REPO_ROOT${NC}"
echo -e "File path: ${CYAN}$FILE_PATH${NC}\n"

# Check if the file exists
if [[ -f "$FILE_PATH" ]]; then
    echo -e "${GREEN}✅ File exists${NC}\n"
    
    # Get file metadata
    echo -e "${BOLD}File Information:${NC}"
    FILE_SIZE=$(du -h "$FILE_PATH" | cut -f1)
    FILE_PERMISSIONS=$(ls -l "$FILE_PATH" | awk '{print $1}')
    FILE_MODIFIED=$(stat -f "%Sm" "$FILE_PATH" 2>/dev/null || stat -c "%y" "$FILE_PATH" 2>/dev/null)
    LINE_COUNT=$(wc -l < "$FILE_PATH")
    
    echo -e "Size: ${CYAN}$FILE_SIZE${NC}"
    echo -e "Permissions: ${CYAN}$FILE_PERMISSIONS${NC}"
    echo -e "Last modified: ${CYAN}$FILE_MODIFIED${NC}"
    echo -e "Line count: ${CYAN}$LINE_COUNT${NC}\n"
    
    # Display file content with line numbers
    echo -e "${BOLD}File Content:${NC}\n"
    echo -e "${YELLOW}----------------------------------------${NC}"
    
    # Use nl to add line numbers
    nl -ba "$FILE_PATH"
    
    echo -e "${YELLOW}----------------------------------------${NC}\n"
    
    echo -e "${GREEN}✅ Successfully read file${NC}"
else
    echo -e "${RED}❌ Error: File not found at $FILE_PATH${NC}\n"
    echo -e "Please check the following:"
    echo -e "1. The docs directory exists"
    echo -e "2. The markdown-report.md file has been created"
    echo -e "3. You are running this script from the repository root directory"
    
    # Check if docs directory exists
    if [[ ! -d "$REPO_ROOT/docs" ]]; then
        echo -e "\n${YELLOW}Note: The docs directory does not exist. Create it with:${NC}"
        echo -e "  mkdir -p $REPO_ROOT/docs"
    fi
    
    exit 1
fi

echo -e "\n${BOLD}${BLUE}=== End of File Reader ===${NC}" 