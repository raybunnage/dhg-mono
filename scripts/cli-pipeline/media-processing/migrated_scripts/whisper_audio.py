#!/usr/bin/env python3
"""
Process audio files with Whisper using Modal for GPU acceleration.
"""

import os
import sys
import argparse
import time
from pathlib import Path

# Add the audio processor package to the path
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), 
                              "packages/python-audio-processor"))

# Import the working Modal implementation
from whisperx import transcribe_remote

def process_audio(audio_path, output_dir="summaries", model="small"):
    """Process audio file using Modal and WhisperX"""
    if not os.path.exists(audio_path):
        print(f"❌ Error: Audio file not found: {audio_path}")
        return False
    
    print(f"🎯 Processing {audio_path} with WhisperX via Modal...")
    start_time = time.time()
    
    try:
        # Use the existing Modal implementation
        result = transcribe_remote(
            audio_path=audio_path,
            model_name=model,
            output_dir=output_dir,
            save_output=True
        )
        
        # Get the summary (first 1000 words)
        full_text = result.get("text", "")
        words = full_text.split()
        summary = " ".join(words[:1000]) if len(words) > 1000 else full_text
        
        # Create summary file
        base_name = os.path.splitext(os.path.basename(audio_path))[0]
        summary_path = os.path.join(output_dir, f"{base_name}.txt")
        
        with open(summary_path, 'w') as f:
            f.write(summary)
        
        # Statistics
        total_time = time.time() - start_time
        audio_duration = result.get("metadata", {}).get("duration", 0)
        processing_time = result.get("metadata", {}).get("processing_time", 0)
        speedup = audio_duration / total_time if total_time > 0 else 0
        
        print(f"⏱️ Processing complete in {total_time:.2f}s")
        print(f"✅ Summary saved to: {summary_path}")
        
        return True
    
    except Exception as e:
        print(f"❌ Error processing audio: {str(e)}")
        return False

def main():
    parser = argparse.ArgumentParser(
        description="Process audio with Whisper using Modal"
    )
    parser.add_argument(
        "audio_path", 
        help="Path to the audio file"
    )
    parser.add_argument(
        "--output-dir", 
        default="summaries",
        help="Directory to save the summary"
    )
    parser.add_argument(
        "--model",
        default="small",
        choices=["tiny", "base", "small", "medium", "large"],
        help="Whisper model size (default: small)"
    )
    
    args = parser.parse_args()
    
    # Create output directory if it doesn't exist
    os.makedirs(args.output_dir, exist_ok=True)
    
    # Process the audio
    success = process_audio(
        audio_path=args.audio_path,
        output_dir=args.output_dir,
        model=args.model
    )
    
    # Exit with appropriate code
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()