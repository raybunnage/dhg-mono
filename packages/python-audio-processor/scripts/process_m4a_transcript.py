#!/usr/bin/env python3
"""
Create a full transcript from an M4A audio file.

This script uses Modal and Whisper to generate a complete
transcript of the audio content in an M4A file with timestamps.
"""

import os
import sys
import argparse
import json
from pathlib import Path

# Add the parent directory to sys.path
parent_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, parent_dir)

from whisperx import transcribe_remote, setup_modal

def main():
    parser = argparse.ArgumentParser(
        description="Create a full transcript from an M4A audio file"
    )
    parser.add_argument(
        "audio_path", 
        help="Path to the M4A audio file"
    )
    parser.add_argument(
        "--output-dir", 
        default="transcripts",
        help="Directory to save the transcript"
    )
    parser.add_argument(
        "--model", 
        default="medium",
        choices=["tiny", "base", "small", "medium", "large"],
        help="Whisper model to use (larger = more accurate but slower)"
    )
    parser.add_argument(
        "--setup", 
        action="store_true",
        help="Run Modal setup"
    )
    
    args = parser.parse_args()
    
    if args.setup:
        setup_modal()
        return
    
    audio_path = args.audio_path
    if not os.path.exists(audio_path):
        print(f"❌ Error: Audio file not found: {audio_path}")
        sys.exit(1)
    
    print(f"🎯 Transcribing {audio_path} with Modal...")
    
    try:
        # Get the full transcript with timestamps
        result = transcribe_remote(
            audio_path=audio_path,
            model_name=args.model,
            output_dir=args.output_dir,
            save_output=True
        )
        
        # Calculate some statistics
        duration = result.get("metadata", {}).get("duration", 0)
        segment_count = len(result.get("segments", []))
        processing_time = result.get("metadata", {}).get("processing_time", 0)
        
        print("\n" + "="*80)
        print("Transcript Statistics:")
        print("-"*80)
        print(f"Audio Duration: {duration:.2f} seconds ({duration/60:.2f} minutes)")
        print(f"Segments: {segment_count}")
        print(f"Processing Time: {processing_time:.2f} seconds")
        print(f"Speed: {duration/processing_time:.2f}x realtime")
        print("="*80 + "\n")
        
        # Print a preview
        print("Transcript Preview:")
        print("-"*80)
        text = result.get("text", "")
        print(text[:500] + ("..." if len(text) > 500 else ""))
        print("-"*80 + "\n")
        
        base_name = Path(audio_path).stem
        print(f"✅ Complete transcript saved to:")
        print(f"   - JSON: {args.output_dir}/{base_name}.json")
        print(f"   - Text: {args.output_dir}/{base_name}.txt")
        
    except Exception as e:
        print(f"❌ Error processing audio: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main()