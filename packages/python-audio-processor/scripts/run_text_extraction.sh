#!/bin/bash
# Script to extract text from an audio file using Modal with configurable settings
# All settings can be adjusted in audio_config.json or passed as command line arguments

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
REPO_ROOT="$( cd "$SCRIPT_DIR/../../.." && pwd )"
CONFIG_DIR="$( cd "$SCRIPT_DIR/.." && pwd )"
CONFIG_FILE="$CONFIG_DIR/audio_config.json"

# Get the default audio path from the config file
DEFAULT_AUDIO_PATH=$(grep -o '"default_audio_path": "[^"]*"' "$CONFIG_FILE" | cut -d'"' -f4)
if [ -n "$DEFAULT_AUDIO_PATH" ]; then
    AUDIO_FILE="$REPO_ROOT/$DEFAULT_AUDIO_PATH"
else
    AUDIO_FILE="$REPO_ROOT/file_types/m4a/INGESTED_2024_04_17_Navaux_10m.m4a"
fi

# Create the results directory if it doesn't exist
RESULTS_DIR="$CONFIG_DIR/results"
mkdir -p "$RESULTS_DIR"

# Process command line arguments
VERBOSE=""
CHECK_ONLY=""
OUTPUT_PATH=""
PRESET=""
MODEL=""
GPU_TYPE=""
GPU_COUNT=""
SEGMENTS=""
TIMEOUT=""

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  key="$1"
  case $key in
    --check)
      CHECK_ONLY="--check"
      shift
      ;;
    --verbose|-v)
      VERBOSE="--verbose"
      shift
      ;;
    --output=*|-o=*)
      OUTPUT_PATH="--output=${key#*=}"
      shift
      ;;
    --output|-o)
      OUTPUT_PATH="--output=$2"
      shift
      shift
      ;;
    --preset=*)
      PRESET="--preset=${key#*=}"
      shift
      ;;
    --preset)
      PRESET="--preset=$2"
      shift
      shift
      ;;
    --model=*)
      MODEL="--model=${key#*=}"
      shift
      ;;
    --model)
      MODEL="--model=$2"
      shift
      shift
      ;;
    --gpu-type=*)
      GPU_TYPE="--gpu-type=${key#*=}"
      shift
      ;;
    --gpu-type)
      GPU_TYPE="--gpu-type=$2"
      shift
      shift
      ;;
    --gpu-count=*)
      GPU_COUNT="--gpu-count=${key#*=}"
      shift
      ;;
    --gpu-count)
      GPU_COUNT="--gpu-count=$2"
      shift
      shift
      ;;
    --segments=*|-s=*)
      SEGMENTS="--segments=${key#*=}"
      shift
      ;;
    --segments|-s)
      SEGMENTS="--segments=$2"
      shift
      shift
      ;;
    --timeout=*)
      TIMEOUT="--timeout=${key#*=}"
      shift
      ;;
    --timeout)
      TIMEOUT="--timeout=$2"
      shift
      shift
      ;;
    --file=*|-f=*)
      AUDIO_FILE="${key#*=}"
      shift
      ;;
    --file|-f)
      AUDIO_FILE="$2"
      shift
      shift
      ;;
    --short-file)
      # Get the short audio path from the config file
      SHORT_AUDIO_PATH=$(grep -o '"short_audio_path": "[^"]*"' "$CONFIG_FILE" | cut -d'"' -f4)
      if [ -n "$SHORT_AUDIO_PATH" ]; then
        AUDIO_FILE="$REPO_ROOT/$SHORT_AUDIO_PATH"
        # Also set the preset for short files
        PRESET="--preset=short_file"
      else
        echo "❌ Error: short_audio_path not found in config file"
        exit 1
      fi
      shift
      ;;
    --medium-file)
      # Get the medium audio path from the config file
      MEDIUM_AUDIO_PATH=$(grep -o '"medium_audio_path": "[^"]*"' "$CONFIG_FILE" | cut -d'"' -f4)
      if [ -n "$MEDIUM_AUDIO_PATH" ]; then
        AUDIO_FILE="$REPO_ROOT/$MEDIUM_AUDIO_PATH"
        # Also set the preset for medium files
        PRESET="--preset=medium_file"
      else
        echo "❌ Error: medium_audio_path not found in config file"
        exit 1
      fi
      shift
      ;;
    --help|-h)
      echo "Usage: $0 [OPTIONS]"
      echo ""
      echo "This script processes audio files using Modal and Whisper models."
      echo "All settings can be configured in audio_config.json or passed as arguments."
      echo ""
      echo "Options:"
      echo "  --verbose, -v                 Enable verbose logging"
      echo "  --check                       Only check Modal connection"
      echo "  --output PATH, -o PATH        Specify output path for transcript"
      echo "  --preset PRESET               Use a predefined config preset (fast, balanced, quality, short_file)"
      echo "  --model MODEL                 Whisper model to use (tiny, base, small, medium, large)"
      echo "  --gpu-type TYPE               GPU type to use (T4, A10G, A100)"
      echo "  --gpu-count COUNT             Number of GPUs to use in parallel"
      echo "  --segments N, -s N            Number of segments to split audio into"
      echo "  --timeout SECONDS             Timeout in seconds for each segment"
      echo "  --file PATH, -f PATH          Path to the audio file to process"
      echo "  --short-file                  Use the short_audio_path from config with short_file preset"
      echo "  --medium-file                 Use the medium_audio_path from config with medium_file preset"
      echo "  --help, -h                    Show this help message"
      echo ""
      echo "Examples:"
      echo "  $0                            # Use default settings from audio_config.json"
      echo "  $0 --preset=fast              # Use faster, lighter processing"
      echo "  $0 --preset=quality           # Use higher quality, slower processing"
      echo "  $0 --short-file               # Process the short (1m) audio file"
      echo "  $0 --medium-file              # Process the medium (5m) audio file"
      echo "  $0 --model=medium --gpu-count=3  # Custom configuration"
      echo ""
      exit 0
      ;;
    *)
      # Unknown option or positional argument (assumed to be audio file)
      if [ -f "$key" ]; then
        AUDIO_FILE="$key"
        shift
      else
        echo "Unknown option: $key"
        echo "Run '$0 --help' for usage information"
        exit 1
      fi
      ;;
  esac
done

# Make the script executable
chmod +x "$SCRIPT_DIR/extract_audio_text.py"

# If only checking connection
if [ -n "$CHECK_ONLY" ]; then
    echo "🔍 Checking Modal connection..."
    which_python=$(which python)
    echo "Using Python: $which_python"
    $which_python "$SCRIPT_DIR/extract_audio_text.py" --check $VERBOSE
    exit $?
fi

# Check if Modal is installed
check_modal_installation() {
    # Detect Python path
    which_python=$(which python)
    
    # Check if modal is installed
    if $which_python -m pip list | grep -q "modal"; then
        echo "✅ Modal is installed"
    else
        echo "❌ Modal is not installed"
        read -p "Would you like to install Modal now? (y/n) " -n 1 -r
        echo ""
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            echo "📦 Installing Modal..."
            $which_python -m pip install modal
            
            # Verify the installation was successful
            if $which_python -m pip list | grep -q "modal"; then
                echo "✅ Modal installed successfully!"
            else
                echo "❌ Failed to install Modal. Please install it manually and try again."
                exit 1
            fi
        else
            echo "❌ Modal is required to run this script. Exiting."
            exit 1
        fi
    fi
}

# Check Modal installation
check_modal_installation

# Check if the audio file exists
if [ ! -f "$AUDIO_FILE" ]; then
    echo "❌ Error: Audio file not found at $AUDIO_FILE"
    exit 1
fi

# Determine preset info from config file if preset was specified
if [[ "$PRESET" == *"--preset="* ]]; then
    PRESET_NAME=${PRESET#*=}
    PRESET_INFO=$(grep -A10 "\"$PRESET_NAME\"" "$CONFIG_FILE" | grep -v "}" | tr -d ',' | tr -d '"' | tr -d '{')
    echo "🔧 Using preset: $PRESET_NAME"
    echo "$PRESET_INFO" | grep -v ":" | while read -r line; do
        if [[ -n "$line" ]]; then
            echo "  - $line"
        fi
    done
    echo ""
fi

echo "🎛️ Audio Processing Configuration"
echo "🎵 Audio file: $AUDIO_FILE"
echo "📂 Results will be saved to: $RESULTS_DIR"

# Run the extraction script
which_python=$(which python)
echo "Using Python: $which_python"
echo "⏱️ Starting audio transcription with Modal..."

# Build command with all specified options
CMD="$which_python \"$SCRIPT_DIR/extract_audio_text.py\" $VERBOSE $CHECK_ONLY $OUTPUT_PATH $PRESET $MODEL $GPU_TYPE $GPU_COUNT $SEGMENTS $TIMEOUT \"$AUDIO_FILE\" 2>&1"

# Print the command for debugging
echo "DEBUG: Running command: $CMD"

# Run the command
eval $CMD

# Check if the extraction was successful
if [ $? -eq 0 ]; then
    echo "✅ Text extraction completed successfully!"
    echo "📝 Results saved to the results directory"
else
    echo "❌ Text extraction failed. See error messages above."
    
    # Offer helpful suggestions
    echo ""
    echo "Troubleshooting suggestions:"
    echo "1. Try running with --verbose for more detailed logs:"
    echo "   $0 --verbose"
    echo ""
    echo "2. Check your Modal connection:"
    echo "   $0 --check"
    echo ""
    echo "3. Check your Modal version:"
    echo "   pip show modal"
    echo ""
    echo "4. Try using a smaller model or more segments:"
    echo "   $0 --model=base --segments=6"
    echo ""
    echo "5. Refresh your Modal token:"
    echo "   modal token new"
    echo ""
    echo "6. Make sure Modal service is up:"
    echo "   Visit https://status.modal.com"
fi