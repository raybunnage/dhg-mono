#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if we're in the right directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ "$(basename "$(dirname "$SCRIPT_DIR")")" != "scripts" ]] || [[ "$(basename "$SCRIPT_DIR")" != "whisper" ]]; then
    echo -e "${RED}❌ Error: Must run this script from the scripts/whisper directory${NC}"
    echo -e "Current directory: $(pwd)"
    echo -e "Please run: cd /path/to/dhg-mono/scripts/whisper"
    exit 1
fi

# Check for Python 3.11
if ! command -v /opt/homebrew/bin/python3.11 &> /dev/null; then
    echo -e "${RED}❌ Python 3.11 not found${NC}"
    echo -e "Installing Python 3.11..."
    brew install python@3.11
fi

# Verify Python 3.11 version
PYTHON_VERSION=$(/opt/homebrew/bin/python3.11 --version)
echo -e "${GREEN}✅ Using $PYTHON_VERSION${NC}"

# Remove old virtual environment if it exists
if [ -d ".venv-whisper" ]; then
    echo -e "${YELLOW}🗑️  Removing old virtual environment...${NC}"
    rm -rf .venv-whisper
fi

# Create new virtual environment
echo -e "${GREEN}🔧 Creating new virtual environment...${NC}"
/opt/homebrew/bin/python3.11 -m venv .venv-whisper

# Activate virtual environment
echo -e "${GREEN}🔌 Activating virtual environment...${NC}"
source .venv-whisper/bin/activate

# Verify we're using Python 3.11 in the venv
VENV_PYTHON_VERSION=$(python --version)
if [[ $VENV_PYTHON_VERSION != *"3.11"* ]]; then
    echo -e "${RED}❌ Wrong Python version in virtual environment: $VENV_PYTHON_VERSION${NC}"
    echo "Expected Python 3.11.x"
    exit 1
fi

# Install uv
echo -e "${GREEN}📦 Installing uv...${NC}"
curl -LsSf https://astral.sh/uv/install.sh | sh

# Install dependencies
echo -e "${GREEN}📚 Installing Python packages...${NC}"
uv pip install faster-whisper tqdm python-dotenv supabase

# Create .env file if it doesn't exist
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}📝 Creating .env file...${NC}"
    echo "SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_key" > .env
    echo -e "${YELLOW}⚠️  Please edit .env with your Supabase credentials${NC}"
fi

# Add to .gitignore if needed
if ! grep -q ".venv-whisper" ../../.gitignore 2>/dev/null; then
    echo -e "${GREEN}📝 Adding .venv-whisper to .gitignore...${NC}"
    echo "
# Python virtual environment
scripts/whisper/.venv-whisper/" >> ../../.gitignore
fi

echo -e "
${GREEN}✅ Setup complete!${NC}

To use the whisper environment:
1. ${YELLOW}cd scripts/whisper${NC}
2. ${YELLOW}source .venv-whisper/bin/activate${NC}
3. ${YELLOW}python batch_process.py /path/to/audio/files --model medium${NC}

To deactivate when done:
${YELLOW}deactivate${NC}
" 