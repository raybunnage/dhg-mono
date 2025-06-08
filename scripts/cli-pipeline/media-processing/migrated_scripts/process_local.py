#!/usr/bin/env python3
"""
Process audio locally without Modal.
This is a fallback when Modal is having issues.
"""

import os
import sys
import argparse
import time
import subprocess
from pathlib import Path

def process_audio_local(audio_path, output_path):
    """Process audio file locally using ffmpeg to extract text"""
    try:
        # Get file info
        print(f"🎵 Processing audio file: {audio_path}")
        
        # Create a simple output with the filename and duration
        output_text = f"Local processing of {os.path.basename(audio_path)}\n\n"
        
        # Get audio duration using ffmpeg
        cmd = [
            "ffmpeg", "-i", audio_path, 
            "-f", "null", "-"
        ]
        
        result = subprocess.run(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        
        # Extract duration from ffmpeg output
        duration = "unknown"
        for line in result.stderr.split('\n'):
            if "Duration" in line:
                duration = line.split("Duration: ")[1].split(",")[0]
                break
        
        output_text += f"Duration: {duration}\n\n"
        output_text += "This is a placeholder transcription since Modal processing failed.\n"
        output_text += "For actual transcription, you would need to run this with Modal or another transcription service.\n"
        
        # Add a timestamp
        output_text += f"\nProcessed locally at {time.strftime('%Y-%m-%d %H:%M:%S')}"
        
        # Write to output file
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        with open(output_path, 'w') as f:
            f.write(output_text)
        
        print(f"✅ Output saved to {output_path}")
        return True
    
    except Exception as e:
        print(f"❌ Error processing audio: {str(e)}")
        return False

def main():
    parser = argparse.ArgumentParser(
        description="Process audio locally as a fallback when Modal is unavailable"
    )
    parser.add_argument(
        "audio_path", 
        help="Path to the audio file"
    )
    parser.add_argument(
        "--output-dir", 
        default="summaries",
        help="Directory to save the output"
    )
    
    args = parser.parse_args()
    
    # Check if input file exists
    if not os.path.exists(args.audio_path):
        print(f"❌ Error: Audio file not found: {args.audio_path}")
        sys.exit(1)
    
    # Create output path
    input_path = Path(args.audio_path)
    output_dir = args.output_dir
    filename = f"{input_path.stem}.txt"
    output_path = os.path.join(output_dir, filename)
    
    start_time = time.time()
    success = process_audio_local(args.audio_path, output_path)
    
    if success:
        elapsed_time = time.time() - start_time
        print(f"⏱️ Processing time: {elapsed_time:.2f} seconds")
        print("✅ Done!")
    else:
        print("❌ Failed to process audio file")
        sys.exit(1)

if __name__ == "__main__":
    main()