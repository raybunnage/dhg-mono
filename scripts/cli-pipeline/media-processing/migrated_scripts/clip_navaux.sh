#!/bin/bash

# Script to clip the Navaux audio file to a specified number of minutes
# Usage: ./clip_navaux.sh <minutes>

set -e

# Default paths and values
INPUT_FILE="/Users/raybunnage/Documents/github/dhg-mono/file_types/m4a/INGESTED_2024_04_17_Navaux.m4a"
MINUTES="${1:-10}"

# Print usage if --help is specified
if [[ "$1" == "--help" || "$1" == "-h" ]]; then
    echo "Usage: ./clip_navaux.sh <minutes>"
    echo ""
    echo "Arguments:"
    echo "  minutes    Duration in minutes to clip (default: 10)"
    echo ""
    echo "This script will create a clipped version of the Navaux audio file"
    echo "with a name format of INGESTED_2024_04_17_Navaux_Xm.m4a where X is"
    echo "the specified number of minutes."
    exit 0
fi

# Validate input is a number
if ! [[ "$MINUTES" =~ ^[0-9]+$ ]]; then
    echo "❌ Error: Minutes must be a positive integer number"
    echo "Usage: ./clip_navaux.sh <minutes>"
    exit 1
fi

# Calculate output filename
OUTPUT_DIR=$(dirname "$INPUT_FILE")
BASE_NAME=$(basename "$INPUT_FILE" .m4a)
OUTPUT_FILE="$OUTPUT_DIR/${BASE_NAME}_${MINUTES}m.m4a"

echo "✂️ Clipping Navaux audio file to ${MINUTES} minutes..."
echo "📝 Output will be saved to: $OUTPUT_FILE"

# Execute the clip_audio.sh script
"$(dirname "$0")/clip_audio.sh" "$INPUT_FILE" "$OUTPUT_FILE" "$MINUTES"

# Display results
echo ""
echo "🎬 Summary:"
echo "- Original file: $INPUT_FILE"
echo "- Clipped file (${MINUTES}m): $OUTPUT_FILE"
echo "- Clipped file size: $(du -h "$OUTPUT_FILE" | cut -f1)"

# Suggest next steps
echo ""
echo "🔍 Next steps:"
echo "1. Use the clipped file with modal_audio_summarize.sh:"
echo "   ./scripts/python/modal_audio_summarize.sh \"$OUTPUT_FILE\""
echo ""