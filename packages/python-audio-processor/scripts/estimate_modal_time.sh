#!/bin/bash
# Wrapper script for estimating Modal processing time

# Get the directory of this script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Check if ffprobe is available
if ! command -v ffprobe &> /dev/null; then
    echo "Error: ffprobe is required but not found. Please install ffmpeg."
    echo "  macOS: brew install ffmpeg"
    echo "  Linux: apt-get install ffmpeg"
    exit 1
fi

# Show usage if no arguments provided
if [ "$#" -lt 1 ]; then
    echo "Usage: $0 <audio-file> [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --model MODEL     Specify the Whisper model to use (tiny, base, small, medium, large)"
    echo "                    Default: small"
    echo ""
    echo "  --gpus N          Specify number of GPUs for parallel processing (1, 2, 3)"
    echo "                    Default: 1"
    echo ""
    echo "  --gpu-type TYPE   Specify GPU type for cost/performance analysis (T4, A10G, A100)"
    echo "                    Default: T4"
    echo ""
    echo "Examples:"
    echo "  $0 audio.m4a"
    echo "  $0 audio.m4a --model medium"
    echo "  $0 audio.m4a --model medium --gpus 3"
    echo "  $0 audio.m4a --model medium --gpus 3 --gpu-type A10G"
    echo ""
    echo "Performance comparison:"
    echo "  $0 audio.m4a --model medium --gpus 3 --gpu-type T4"
    echo "  $0 audio.m4a --model medium --gpus 3 --gpu-type A10G"
    echo "  $0 audio.m4a --model medium --gpus 3 --gpu-type A100"
    exit 1
fi

# Run the Python script with provided parameters
python3 "$SCRIPT_DIR/estimate_processing_time.py" "$@"