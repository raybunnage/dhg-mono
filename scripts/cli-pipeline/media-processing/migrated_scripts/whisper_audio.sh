#!/bin/bash

# Script to generate a summary of an audio file using WhisperX via Modal
# Usage: ./whisper_audio.sh <audio_file> [output_dir] [--model model_name]

set -e

# Store original directory and script directory
ORIGINAL_DIR="$(pwd)"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Parse arguments
AUDIO_FILE=""
OUTPUT_DIR="/Users/raybunnage/Documents/github/dhg-mono/file_types/summaries"
MODEL="small"

# Process arguments
for arg in "$@"; do
    if [[ "$arg" == "--model="* ]]; then
        MODEL="${arg#*=}"
    elif [[ -z "$AUDIO_FILE" && "$arg" != --* ]]; then
        AUDIO_FILE="$arg"
    elif [[ "$arg" != --* ]]; then
        OUTPUT_DIR="$arg"
    fi
done

# If no audio file provided, use default
if [[ -z "$AUDIO_FILE" ]]; then
    AUDIO_FILE="/Users/raybunnage/Documents/github/dhg-mono/file_types/m4a/INGESTED_2024_04_17_Navaux_1m.m4a"
fi

# Validate input
if [ ! -f "$AUDIO_FILE" ]; then
    echo "❌ Error: Audio file not found: $AUDIO_FILE"
    echo "Usage: ./whisper_audio.sh audio_file.m4a [output_dir] [--model=model_name]"
    exit 1
fi

# Make audio file path absolute
if [[ "$AUDIO_FILE" != /* ]]; then
    AUDIO_FILE="$(pwd)/$AUDIO_FILE"
fi

# Create output directory if it doesn't exist
mkdir -p "$OUTPUT_DIR"

echo "🎧 Processing audio file: $AUDIO_FILE"
echo "📝 Output will be saved to: $OUTPUT_DIR"
echo "🔍 Using model: $MODEL"

# Check for Modal installation
if ! pip show modal &>/dev/null; then
    echo "📦 Installing Modal..."
    pip install modal
fi

# Ensure Modal token is set up
if ! modal status &>/dev/null; then
    echo "🔑 Setting up Modal token (this will open a browser)..."
    modal token new
fi

# Execute the Python script
echo "🚀 Starting WhisperX transcription via Modal..."
python "$SCRIPT_DIR/whisper_audio.py" "$AUDIO_FILE" --output-dir "$OUTPUT_DIR" --model "$MODEL"

# Check result
BASENAME=$(basename -- "$AUDIO_FILE" | sed 's/\.[^.]*$//')
SUMMARY_FILE="$OUTPUT_DIR/${BASENAME}.txt"

if [ -f "$SUMMARY_FILE" ]; then
    echo "✅ Transcription and summary complete!"
    echo "📄 Summary content (first 500 chars):"
    echo "===================="
    head -c 500 "$SUMMARY_FILE"
    echo ""
    echo "===================="
else
    echo "❌ Summary file was not created: $SUMMARY_FILE"
    exit 1
fi

echo "✅ Process complete!"