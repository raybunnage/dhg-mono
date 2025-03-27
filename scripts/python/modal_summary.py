#!/usr/bin/env python3
"""
Create a summary from an audio file using Modal.
Uses the existing whisperx package.
"""

import os
import sys
import argparse
import time
from pathlib import Path

# Add the audio processor package to the path
repo_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
audio_processor_path = os.path.join(repo_root, "packages/python-audio-processor")
sys.path.insert(0, audio_processor_path)

# Import the existing whisperx package
try:
    from whisperx import summarize_remote
except ImportError:
    print(f"❌ Error: Could not import whisperx. Check that it exists at {audio_processor_path}")
    sys.exit(1)


def main():
    parser = argparse.ArgumentParser(
        description="Generate a summary from an audio file using Modal"
    )
    parser.add_argument(
        "audio_path", 
        help="Path to the audio file"
    )
    parser.add_argument(
        "--output-dir", 
        default=os.path.join(repo_root, "file_types/summaries"),
        help="Directory to save the summary"
    )
    parser.add_argument(
        "--model",
        default="small",
        choices=["tiny", "base", "small", "medium", "large"],
        help="Whisper model size (default: small)"
    )
    parser.add_argument(
        "--length",
        type=int,
        default=500,
        help="Maximum summary length in words"
    )
    
    args = parser.parse_args()
    
    # Create output directory if it doesn't exist
    os.makedirs(args.output_dir, exist_ok=True)
    
    # Validate input file
    audio_path = args.audio_path
    if not os.path.exists(audio_path):
        print(f"❌ Error: Audio file not found: {audio_path}")
        sys.exit(1)
    
    # Make path absolute
    if not os.path.isabs(audio_path):
        audio_path = os.path.abspath(audio_path)
    
    print(f"🎧 Processing audio file: {audio_path}")
    print(f"📝 Output will be saved to: {args.output_dir}")
    print(f"🔍 Using model: {args.model}")
    
    try:
        # Start timing
        start_time = time.time()
        
        # Use the existing summarize_remote function
        summary = summarize_remote(
            audio_path=audio_path,
            model_name=args.model,
            output_dir=args.output_dir,
            max_length=args.length,
            save_output=True
        )
        
        # Get summary file path
        base_name = os.path.splitext(os.path.basename(audio_path))[0]
        summary_path = os.path.join(args.output_dir, f"{base_name}_summary.txt")
        
        # Print a preview
        print("\n" + "="*80)
        print("Summary Preview:")
        print("-"*80)
        print(summary[:500] + ("..." if len(summary) > 500 else ""))
        print("-"*80)
        
        total_time = time.time() - start_time
        print(f"⏱️ Total processing time: {total_time:.2f} seconds")
        print(f"✅ Summary saved to: {summary_path}")
        
    except Exception as e:
        print(f"❌ Error processing audio: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()