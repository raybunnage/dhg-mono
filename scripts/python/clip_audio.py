#!/usr/bin/env python3
"""
Clip an audio file to the first X minutes.

This script uses ffmpeg to extract a portion of an audio file.
It's useful for reducing file size before sending to cloud services.
"""

import os
import sys
import argparse
import subprocess
import time
from pathlib import Path


def clip_audio(input_path, output_path, duration_seconds=600):
    """
    Clip an audio file to the specified duration using ffmpeg.
    
    Args:
        input_path: Path to the input audio file
        output_path: Path to save the clipped audio file
        duration_seconds: Duration in seconds to clip (default: 600 seconds = 10 minutes)
    
    Returns:
        bool: True if successful, False otherwise
    """
    try:
        # Ensure the output directory exists
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        
        # Run ffmpeg to clip the audio
        cmd = [
            "ffmpeg",
            "-i", input_path,
            "-ss", "0",
            "-t", str(duration_seconds),
            "-c:a", "copy",  # Copy audio codec to avoid re-encoding
            "-y",  # Overwrite output file if it exists
            output_path
        ]
        
        print(f"Running: {' '.join(cmd)}")
        
        # Execute the command
        result = subprocess.run(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        
        # Check if the command was successful
        if result.returncode != 0:
            print(f"Error clipping audio: {result.stderr}")
            return False
        
        # Get original and new file sizes
        original_size = os.path.getsize(input_path)
        new_size = os.path.getsize(output_path)
        
        print(f"✅ Successfully clipped audio file:")
        print(f"  - Original file: {input_path} ({format_size(original_size)})")
        print(f"  - Clipped file: {output_path} ({format_size(new_size)})")
        print(f"  - Size reduction: {format_size(original_size - new_size)} ({(1 - new_size/original_size) * 100:.1f}%)")
        
        return True
    
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return False


def format_size(size_bytes):
    """Format file size in human-readable format"""
    if size_bytes < 1024:
        return f"{size_bytes} B"
    elif size_bytes < 1024 * 1024:
        return f"{size_bytes / 1024:.1f} KB"
    elif size_bytes < 1024 * 1024 * 1024:
        return f"{size_bytes / (1024 * 1024):.1f} MB"
    else:
        return f"{size_bytes / (1024 * 1024 * 1024):.1f} GB"


def main():
    parser = argparse.ArgumentParser(
        description="Clip an audio file to the first X minutes"
    )
    parser.add_argument(
        "input_file", 
        help="Path to the input audio file"
    )
    parser.add_argument(
        "--output-file", "-o",
        help="Path to save the clipped audio file. If not specified, a file will be created in the same directory with a _clipped suffix."
    )
    parser.add_argument(
        "--minutes", "-m",
        type=float,
        default=10.0,
        help="Duration in minutes to clip (default: 10 minutes)"
    )
    
    args = parser.parse_args()
    
    # Check if input file exists
    if not os.path.exists(args.input_file):
        print(f"❌ Error: Input file not found: {args.input_file}")
        sys.exit(1)
    
    # Create output path if not specified
    if not args.output_file:
        input_path = Path(args.input_file)
        output_dir = input_path.parent
        # Use _Xm format where X is the number of minutes
        filename = f"{input_path.stem}_{int(args.minutes)}m{input_path.suffix}"
        output_path = output_dir / filename
    else:
        output_path = args.output_file
    
    # Convert minutes to seconds
    duration_seconds = int(args.minutes * 60)
    
    print(f"🎧 Clipping audio file: {args.input_file}")
    print(f"⏱️ Duration: {args.minutes} minutes ({duration_seconds} seconds)")
    print(f"📝 Output will be saved to: {output_path}")
    
    start_time = time.time()
    
    # Clip the audio
    success = clip_audio(args.input_file, str(output_path), duration_seconds)
    
    if success:
        elapsed_time = time.time() - start_time
        print(f"⏱️ Processing time: {elapsed_time:.2f} seconds")
        print("✅ Done!")
    else:
        print("❌ Failed to clip audio file")
        sys.exit(1)


if __name__ == "__main__":
    main()