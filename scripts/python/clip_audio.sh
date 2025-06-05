#!/bin/bash

# Script to clip an audio file to the first X minutes using ffmpeg
# Usage: ./clip_audio.sh <path_to_audio_file> [output_path] [minutes]

set -e

# Default paths
AUDIO_FILE="$1"
OUTPUT_FILE="$2"
MINUTES="${3:-10}"

# Check if an audio file was provided
if [ -z "$AUDIO_FILE" ]; then
    echo "❌ Error: No audio file provided."
    echo "Usage: ./clip_audio.sh input_file.m4a output_file.m4a minutes"
    echo ""
    echo "Arguments:"
    echo "  input_file.m4a    Path to audio file to clip"
    echo "  output_file.m4a   (Optional) Path for clipped output file"
    echo "  minutes           (Optional) Duration in minutes (default: 10)"
    exit 1
fi

# Convert relative path to absolute path
if [[ "$AUDIO_FILE" != /* ]]; then
    AUDIO_FILE="$(pwd)/$AUDIO_FILE"
fi

# Verify input file exists
if [ ! -f "$AUDIO_FILE" ]; then
    echo "❌ Error: Input file not found: $AUDIO_FILE"
    exit 1
fi

# Build command
COMMAND="python $(dirname "$0")/clip_audio.py \"$AUDIO_FILE\""

# Add output file if provided
if [ -n "$OUTPUT_FILE" ]; then
    # Convert relative path to absolute path
    if [[ "$OUTPUT_FILE" != /* ]]; then
        OUTPUT_FILE="$(pwd)/$OUTPUT_FILE"
    fi
    COMMAND="$COMMAND --output-file \"$OUTPUT_FILE\""
fi

# Add minutes if not default
if [ "$MINUTES" != "10" ]; then
    COMMAND="$COMMAND --minutes $MINUTES"
fi

# Make the Python script executable
chmod +x "$(dirname "$0")/clip_audio.py"

# Execute the command
echo "🎬 Running audio clip command..."
eval $COMMAND