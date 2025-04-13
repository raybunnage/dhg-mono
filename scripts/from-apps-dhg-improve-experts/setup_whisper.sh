#!/bin/bash

# Check if uv is installed, if not, install it
if ! command -v uv &> /dev/null; then
    echo "Installing uv..."
    curl -LsSf https://astral.sh/uv/install.sh | sh
fi

# Create Python virtual environment
python3 -m venv .venv

# Activate virtual environment
source .venv/bin/activate

# Install dependencies using uv
uv pip install faster-whisper

# Show installed version
python -c "from faster_whisper import WhisperModel; print('Faster Whisper installed successfully')"

echo "Setup complete! You can now run:"
echo "python process_audio.py \"path/to/your/audio.m4a\"" 