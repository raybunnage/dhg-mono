#!/bin/bash
# check-claude-api-key.sh - Utility script to check and set up Claude API key

# Define colors for better readability
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get the script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"

echo -e "${BLUE}=== Claude API Key Configuration Check ===${NC}"
echo "This script will help diagnose and fix Claude API key issues."

# Check for Claude API key in environment variables
echo -e "\n${YELLOW}Checking for Claude API key in current environment...${NC}"
if [ -n "$CLAUDE_API_KEY" ]; then
  MASK_KEY="${CLAUDE_API_KEY:0:5}...${CLAUDE_API_KEY: -3}"
  echo -e "${GREEN}✓ CLAUDE_API_KEY is set${NC} (value: $MASK_KEY, length: ${#CLAUDE_API_KEY})"
else
  echo -e "${RED}✗ CLAUDE_API_KEY is not set${NC}"
fi

if [ -n "$CLI_CLAUDE_API_KEY" ]; then
  MASK_KEY="${CLI_CLAUDE_API_KEY:0:5}...${CLI_CLAUDE_API_KEY: -3}"
  echo -e "${GREEN}✓ CLI_CLAUDE_API_KEY is set${NC} (value: $MASK_KEY, length: ${#CLI_CLAUDE_API_KEY})"
else
  echo -e "${RED}✗ CLI_CLAUDE_API_KEY is not set${NC}"
fi

if [ -n "$ANTHROPIC_API_KEY" ]; then
  MASK_KEY="${ANTHROPIC_API_KEY:0:5}...${ANTHROPIC_API_KEY: -3}"
  echo -e "${GREEN}✓ ANTHROPIC_API_KEY is set${NC} (value: $MASK_KEY, length: ${#ANTHROPIC_API_KEY})"
else
  echo -e "${RED}✗ ANTHROPIC_API_KEY is not set${NC}"
fi

if [ -n "$VITE_ANTHROPIC_API_KEY" ]; then
  MASK_KEY="${VITE_ANTHROPIC_API_KEY:0:5}...${VITE_ANTHROPIC_API_KEY: -3}"
  echo -e "${GREEN}✓ VITE_ANTHROPIC_API_KEY is set${NC} (value: $MASK_KEY, length: ${#VITE_ANTHROPIC_API_KEY})"
else
  echo -e "${RED}✗ VITE_ANTHROPIC_API_KEY is not set${NC}"
fi

# Check for Claude API key in environment files
echo -e "\n${YELLOW}Checking environment files for Claude API key...${NC}"

ENV_FILES=(
  "${ROOT_DIR}/.env"
  "${ROOT_DIR}/.env.development"
  "${ROOT_DIR}/.env.local"
)

for env_file in "${ENV_FILES[@]}"; do
  if [ -f "$env_file" ]; then
    echo -e "${BLUE}Checking $env_file...${NC}"
    
    if grep -q "CLAUDE_API_KEY=" "$env_file"; then
      echo -e "${GREEN}✓ CLAUDE_API_KEY found in $env_file${NC}"
    fi
    
    if grep -q "CLI_CLAUDE_API_KEY=" "$env_file"; then
      echo -e "${GREEN}✓ CLI_CLAUDE_API_KEY found in $env_file${NC}"
    fi
    
    if grep -q "ANTHROPIC_API_KEY=" "$env_file"; then
      echo -e "${GREEN}✓ ANTHROPIC_API_KEY found in $env_file${NC}"
    fi
    
    if grep -q "VITE_ANTHROPIC_API_KEY=" "$env_file"; then
      echo -e "${GREEN}✓ VITE_ANTHROPIC_API_KEY found in $env_file${NC}"
    fi
  else
    echo -e "${RED}✗ File not found: $env_file${NC}"
  fi
done

# Check if ts-node is available
echo -e "\n${YELLOW}Checking if ts-node is installed...${NC}"
if command -v ts-node &> /dev/null; then
  echo -e "${GREEN}✓ ts-node is installed${NC}"
  
  # Run the TypeScript test script with environment variables
  echo -e "\n${YELLOW}Running TypeScript test script...${NC}"
  
  # Make all environment variables available to the test script
  if [ -n "$CLAUDE_API_KEY" ]; then
    export CLAUDE_API_KEY="$CLAUDE_API_KEY"
  elif [ -n "$ANTHROPIC_API_KEY" ]; then
    echo "Setting CLAUDE_API_KEY from ANTHROPIC_API_KEY..."
    export CLAUDE_API_KEY="$ANTHROPIC_API_KEY"
  elif [ -n "$CLI_CLAUDE_API_KEY" ]; then
    echo "Setting CLAUDE_API_KEY from CLI_CLAUDE_API_KEY..."
    export CLAUDE_API_KEY="$CLI_CLAUDE_API_KEY"
  elif [ -n "$VITE_ANTHROPIC_API_KEY" ]; then
    echo "Setting CLAUDE_API_KEY from VITE_ANTHROPIC_API_KEY..."
    export CLAUDE_API_KEY="$VITE_ANTHROPIC_API_KEY"
  fi
  
  cd "${ROOT_DIR}"
  ts-node "${SCRIPT_DIR}/test-script-analyzer.ts"
else
  echo -e "${RED}✗ ts-node is not installed${NC}"
  echo "Please install ts-node with: npm install -g ts-node typescript"
fi

# Provide guidance on setting up the API key
echo -e "\n${BLUE}=== Setup Guidance ===${NC}"
echo "To fix Claude API key issues, you need to do one of the following:"
echo ""
echo "1. Set the environment variable for your current session:"
echo "   export CLAUDE_API_KEY=your_api_key_here"
echo ""
echo "2. Add the API key to your .env.local file (preferred for development):"
echo "   echo 'CLAUDE_API_KEY=your_api_key_here' >> ${ROOT_DIR}/.env.local"
echo ""
echo "3. Use a different environment variable name that's already set:"
echo "   - CLI_CLAUDE_API_KEY"
echo "   - ANTHROPIC_API_KEY"
echo "   - VITE_ANTHROPIC_API_KEY"
echo ""
echo -e "${YELLOW}Make sure your API key is correct and has the proper permissions.${NC}"

# Exit with status based on whether we found a usable key
if [ -n "$CLAUDE_API_KEY" ] || [ -n "$CLI_CLAUDE_API_KEY" ] || [ -n "$ANTHROPIC_API_KEY" ] || [ -n "$VITE_ANTHROPIC_API_KEY" ]; then
  echo -e "\n${GREEN}✓ At least one API key is set up. The script analyzer should be able to use it.${NC}"
  exit 0
else
  echo -e "\n${RED}✗ No API key found. Please set up an API key as described above.${NC}"
  exit 1
fi