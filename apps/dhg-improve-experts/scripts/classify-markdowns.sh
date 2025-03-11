#!/bin/bash

# Simple wrapper script to run the Node.js classifier

GREEN='\033[0;32m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m' # No Color

echo -e "${BOLD}${BLUE}=== Running Markdown Classifier ===${NC}\n"

# Run the Node.js script
node $(dirname "$0")/classify-markdowns.js

echo -e "\n${BOLD}${GREEN}=== Markdown Classification Complete ===${NC}"