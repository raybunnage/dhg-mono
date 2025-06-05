#!/bin/bash

# Script to extract audio from mp4 files using ffmpeg
# Usage: ./extract_audio.sh <path_to_mp4_file> [output_directory]

set -e

# Check if ffmpeg is installed
if ! command -v ffmpeg &> /dev/null; then
    echo "Error: ffmpeg is not installed. Please install it first."
    exit 1
fi

# Default paths
MP4_FILE=$1
OUTPUT_DIR=${2:-"/Users/raybunnage/Documents/github/dhg-mono/file_types/m4a"}

# Verify input file exists
if [ ! -f "$MP4_FILE" ]; then
    echo "Error: Input file not found: $MP4_FILE"
    exit 1
fi

# Ensure output directory exists
mkdir -p "$OUTPUT_DIR"

# Extract filename without path and extension
FILENAME=$(basename -- "$MP4_FILE")
BASENAME="${FILENAME%.*}"

# Output file path
OUTPUT_FILE="$OUTPUT_DIR/$BASENAME.m4a"

echo "Extracting audio from: $MP4_FILE"
echo "Output will be saved to: $OUTPUT_FILE"

# Extract audio using ffmpeg
ffmpeg -i "$MP4_FILE" -vn -c:a aac -b:a 192k "$OUTPUT_FILE"

echo "Audio extraction complete!"
echo "Extracted audio file: $OUTPUT_FILE"