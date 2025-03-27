#!/bin/bash

# Script to generate a 3-paragraph summary of an audio file using Modal and Whisper
# Usage: ./summarize_audio.sh <path_to_audio_file> [output_directory]

set -e

# Default paths
AUDIO_FILE=$1
OUTPUT_DIR=${2:-"/Users/raybunnage/Documents/github/dhg-mono/file_types/summaries"}

# Check if an audio file was provided
if [ -z "$AUDIO_FILE" ]; then
    echo "Error: No audio file provided."
    echo "Usage: ./summarize_audio.sh <path_to_audio_file> [output_directory]"
    exit 1
fi

# Convert relative path to absolute path
if [[ "$AUDIO_FILE" != /* ]]; then
    AUDIO_FILE="$(pwd)/$AUDIO_FILE"
fi

# Verify input file exists
if [ ! -f "$AUDIO_FILE" ]; then
    echo "Error: Input file not found: $AUDIO_FILE"
    exit 1
fi

# Ensure output directory exists
mkdir -p "$OUTPUT_DIR"

# Get the base name of the audio file for output naming
BASENAME=$(basename -- "$AUDIO_FILE")
BASENAME="${BASENAME%.*}"

echo "🎧 Processing audio file: $AUDIO_FILE"
echo "📝 Output will be saved to: $OUTPUT_DIR"

# Go to the python audio processor directory
cd /Users/raybunnage/Documents/github/dhg-mono/packages/python-audio-processor

# Check for virtual environment and activate if exists
if [ -d ".venv" ]; then
    echo "🐍 Activating virtual environment..."
    source .venv/bin/activate
fi

# Run the summary command using Modal remote processing
# Use small model for better quality summaries while still being relatively fast
# Increase length to 500 words to get approximately 3 paragraphs
echo "🚀 Sending for processing..."

# Use tiny model for faster local processing
echo "🔍 Using local processing with tiny model..."
python -m whisperx.cli summary "$AUDIO_FILE" \
    --model tiny \
    --output-dir "$OUTPUT_DIR" \
    --length 500

# Check if the summary was created
SUMMARY_FILE="$OUTPUT_DIR/${BASENAME}_summary.txt"

if [ -f "$SUMMARY_FILE" ]; then
    echo "✅ Summary created successfully!"
    echo "📄 Summary file: $SUMMARY_FILE"
    
    # Format the summary into 3 paragraphs
    echo "🔄 Formatting summary into 3 paragraphs..."
    TEMP_FILE="$OUTPUT_DIR/${BASENAME}_temp.txt"
    
    # Read the summary file
    SUMMARY_TEXT=$(cat "$SUMMARY_FILE")
    
    # Use Python to format the text into 3 paragraphs
    python -c "
import textwrap
import sys

# Read the summary text
summary = '''$SUMMARY_TEXT'''

# Count words
words = summary.split()
word_count = len(words)

# Create 3 paragraphs of roughly equal length
para_length = word_count // 3
remainder = word_count % 3

# Adjust paragraph lengths to account for remainder
para_lengths = [para_length] * 3
for i in range(remainder):
    para_lengths[i] += 1

# Split the words into paragraphs
start = 0
paragraphs = []
for length in para_lengths:
    end = start + length
    if end > word_count:
        end = word_count
    para = ' '.join(words[start:end])
    paragraphs.append(para)
    start = end

# Format each paragraph with nice text wrapping
formatted_paras = []
for para in paragraphs:
    wrapped = textwrap.fill(para, width=80)
    formatted_paras.append(wrapped)

# Output the formatted text
print('\n\n'.join(formatted_paras))
" > "$TEMP_FILE"

    # Replace the original summary with the formatted one
    mv "$TEMP_FILE" "$SUMMARY_FILE"
    
    echo "✨ Summary formatted into 3 paragraphs"
    echo "📊 Summary content:"
    echo "========================================"
    cat "$SUMMARY_FILE"
    echo "========================================"
else
    echo "❌ Error: Summary file was not created!"
    exit 1
fi

# If we activated a virtual environment, deactivate it
if [ -n "$VIRTUAL_ENV" ]; then
    deactivate
fi

echo "✅ Process complete!"