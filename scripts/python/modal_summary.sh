#!/bin/bash

# Script to generate a summary of an audio file using Modal and WhisperX
# Usage: ./modal_summary.sh <audio_file> [output_dir] [options]
#
# Options:
#   --model=NAME   Whisper model to use (tiny, base, small, medium, large) - default: small
#   --length=N     Maximum summary length in words - default: 500
#

set -e

# Store script directory
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Parse arguments
AUDIO_FILE=""
OUTPUT_DIR="$REPO_ROOT/file_types/summaries"
MODEL="small"
LENGTH="500"

# Process arguments
for arg in "$@"; do
    if [[ "$arg" == "--model="* ]]; then
        MODEL="${arg#*=}"
    elif [[ "$arg" == "--length="* ]]; then
        LENGTH="${arg#*=}"
    elif [[ -z "$AUDIO_FILE" && "$arg" != --* ]]; then
        AUDIO_FILE="$arg"
    elif [[ "$arg" != --* ]]; then
        OUTPUT_DIR="$arg"
    fi
done

# If no audio file provided, use default
if [[ -z "$AUDIO_FILE" ]]; then
    AUDIO_FILE="$REPO_ROOT/file_types/m4a/INGESTED_2024_04_17_Navaux_1m.m4a"
fi

# Make audio path absolute
if [[ "$AUDIO_FILE" != /* ]]; then
    AUDIO_FILE="$(pwd)/$AUDIO_FILE"
fi

# Validate input
if [ ! -f "$AUDIO_FILE" ]; then
    echo "❌ Error: Audio file not found: $AUDIO_FILE"
    echo "Usage: ./modal_summary.sh audio_file.m4a [output_dir] [options]"
    exit 1
fi

# Ensure output directory exists
mkdir -p "$OUTPUT_DIR"

echo "🎧 Processing audio file: $AUDIO_FILE"
echo "📝 Output will be saved to: $OUTPUT_DIR"
echo "🔍 Using model: $MODEL (max length: $LENGTH words)"

# Check for dependencies using uv if available
if command -v uv &>/dev/null; then
    echo "📦 Installing dependencies with uv..."
    cd "$REPO_ROOT/packages/python-audio-processor" && uv pip install -e .
else
    # Use pip as fallback
    echo "📦 Installing dependencies with pip..."
    cd "$REPO_ROOT/packages/python-audio-processor" && pip install -e .
fi

# Check for Modal installation
if ! python -c "import modal" &>/dev/null; then
    echo "📦 Installing Modal..."
    pip install modal
fi

# Ensure Modal token is set up
if ! modal status &>/dev/null; then
    echo "🔑 Setting up Modal token (this will open a browser)..."
    modal token new
fi

# Run the Python script
echo "🚀 Starting WhisperX summarization via Modal..."
python "$SCRIPT_DIR/modal_summary.py" "$AUDIO_FILE" \
    --output-dir "$OUTPUT_DIR" \
    --model "$MODEL" \
    --length "$LENGTH"

echo "✅ Process complete!"