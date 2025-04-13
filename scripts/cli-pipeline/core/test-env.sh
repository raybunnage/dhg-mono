#!/bin/bash
# Test script to verify the environment variable loading

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo "==== CLI Pipeline Environment Test ===="
echo -e "${YELLOW}This script verifies that environment variables are loaded correctly.${NC}"
echo ""

# Load environment variables
echo -e "${YELLOW}Loading environment variables...${NC}"
source "$SCRIPT_DIR/load-env.sh" --verbose
echo ""

# Check CLI variables
echo -e "${YELLOW}Checking CLI variables:${NC}"
echo -e "CLI_ENVIRONMENT: ${GREEN}${CLI_ENVIRONMENT:-not set}${NC}"
echo -e "CLI_LOG_LEVEL: ${GREEN}${CLI_LOG_LEVEL:-not set}${NC}"
echo ""

# Check critical API variables
echo -e "${YELLOW}Checking critical API variables:${NC}"

# Claude API
if [[ -n "$CLI_CLAUDE_API_KEY" ]]; then
  echo -e "CLI_CLAUDE_API_KEY: ${GREEN}Set - First 5 chars: ${CLI_CLAUDE_API_KEY:0:5}...${NC}"
else
  echo -e "CLI_CLAUDE_API_KEY: ${RED}Not set${NC}"
fi

# OpenAI API
if [[ -n "$CLI_OPENAI_API_KEY" ]]; then
  echo -e "CLI_OPENAI_API_KEY: ${GREEN}Set - First 5 chars: ${CLI_OPENAI_API_KEY:0:5}...${NC}"
else
  echo -e "CLI_OPENAI_API_KEY: ${YELLOW}Not set${NC}"
fi

# Google API
if [[ -n "$CLI_GOOGLE_API_KEY" ]]; then
  echo -e "CLI_GOOGLE_API_KEY: ${GREEN}Set - First 5 chars: ${CLI_GOOGLE_API_KEY:0:5}...${NC}"
else
  echo -e "CLI_GOOGLE_API_KEY: ${YELLOW}Not set${NC}"
fi
echo ""

# Check Supabase variables
echo -e "${YELLOW}Checking Supabase variables:${NC}"
if [[ -n "$CLI_SUPABASE_URL" ]]; then
  echo -e "CLI_SUPABASE_URL: ${GREEN}Set - ${CLI_SUPABASE_URL}${NC}"
else
  echo -e "CLI_SUPABASE_URL: ${RED}Not set${NC}"
fi

if [[ -n "$CLI_SUPABASE_KEY" ]]; then
  echo -e "CLI_SUPABASE_KEY: ${GREEN}Set - First 5 chars: ${CLI_SUPABASE_KEY:0:5}...${NC}"
else
  echo -e "CLI_SUPABASE_KEY: ${RED}Not set${NC}"
fi
echo ""

# Show variable inheritance
echo -e "${YELLOW}Showing variable inheritance:${NC}"
echo -e "ANTHROPIC_API_KEY → CLI_CLAUDE_API_KEY: ${ANTHROPIC_API_KEY:0:5}... → ${CLI_CLAUDE_API_KEY:0:5}..."
echo -e "SUPABASE_URL → CLI_SUPABASE_URL: ${SUPABASE_URL} → ${CLI_SUPABASE_URL}"
echo -e "SUPABASE_SERVICE_ROLE_KEY → CLI_SUPABASE_KEY: ${SUPABASE_SERVICE_ROLE_KEY:0:5}... → ${CLI_SUPABASE_KEY:0:5}..."
echo ""

# Summary
echo -e "${YELLOW}Summary:${NC}"
if [[ -n "$CLI_CLAUDE_API_KEY" && -n "$CLI_SUPABASE_URL" && -n "$CLI_SUPABASE_KEY" ]]; then
  echo -e "${GREEN}✅ All required variables are set. CLI pipeline should work correctly.${NC}"
else
  echo -e "${RED}❌ Some required variables are missing. CLI pipeline may not work correctly.${NC}"
  echo "Please check your .env files and ensure they contain the required variables."
  echo "See /docs/project-structure/cli-pipeline-env.md for more information."
fi
echo ""

echo "==== Test Complete ===="