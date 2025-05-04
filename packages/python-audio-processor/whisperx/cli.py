"""
Command-line interface for WhisperX.
"""

import os
import sys
import argparse
from typing import List, Optional
import time

from .transcribe import transcribe, transcribe_remote
from .summarize import summarize, summarize_remote
from .utils import setup_modal


def summary_cmd(args: Optional[List[str]] = None) -> None:
    """CLI entrypoint for the summary command"""
    parser = argparse.ArgumentParser(
        description="Generate a quick summary of an audio file using Whisper"
    )
    
    parser.add_argument(
        "audio_path", 
        help="Path to the audio file"
    )
    parser.add_argument(
        "--model", 
        default="tiny",
        choices=["tiny", "base", "small", "medium", "large"],
        help="Whisper model size (smaller is faster, larger is more accurate)"
    )
    parser.add_argument(
        "--output-dir", 
        default="summaries",
        help="Directory to save the summary"
    )
    parser.add_argument(
        "--length", 
        type=int, 
        default=250,
        help="Maximum length of summary in words"
    )
    parser.add_argument(
        "--modal", 
        action="store_true",
        help="Use Modal for remote GPU processing"
    )
    parser.add_argument(
        "--setup-modal", 
        action="store_true",
        help="Setup Modal for first-time use"
    )
    
    args = parser.parse_args(args)
    
    if args.setup_modal:
        setup_modal()
        return
    
    if not os.path.exists(args.audio_path):
        print(f"❌ Error: Audio file not found: {args.audio_path}")
        sys.exit(1)
    
    try:
        start_time = time.time()
        
        if args.modal:
            print(f"🚀 Generating summary with Modal for: {args.audio_path}")
            summary = summarize_remote(
                audio_path=args.audio_path,
                model_name=args.model,
                output_dir=args.output_dir,
                max_length=args.length,
                save_output=True
            )
        else:
            print(f"🎯 Generating summary locally for: {args.audio_path}")
            summary = summarize(
                audio_path=args.audio_path,
                model_name=args.model,
                output_dir=args.output_dir,
                max_length=args.length,
                save_output=True
            )
        
        total_time = time.time() - start_time
        print(f"⏱️ Total time: {total_time:.2f}s")
        print("\n--- Summary ---")
        print(summary[:500] + ("..." if len(summary) > 500 else ""))
        print("---------------\n")
        
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        sys.exit(1)


def transcribe_cmd(args: Optional[List[str]] = None) -> None:
    """CLI entrypoint for the transcribe command"""
    parser = argparse.ArgumentParser(
        description="Transcribe an audio file using Whisper"
    )
    
    parser.add_argument(
        "audio_path", 
        help="Path to the audio file"
    )
    parser.add_argument(
        "--model", 
        default="medium",
        choices=["tiny", "base", "small", "medium", "large"],
        help="Whisper model size (smaller is faster, larger is more accurate)"
    )
    parser.add_argument(
        "--output-dir", 
        default="transcripts",
        help="Directory to save the transcript"
    )
    parser.add_argument(
        "--modal", 
        action="store_true",
        help="Use Modal for remote GPU processing"
    )
    parser.add_argument(
        "--setup-modal", 
        action="store_true",
        help="Setup Modal for first-time use"
    )
    
    args = parser.parse_args(args)
    
    if args.setup_modal:
        setup_modal()
        return
    
    if not os.path.exists(args.audio_path):
        print(f"❌ Error: Audio file not found: {args.audio_path}")
        sys.exit(1)
    
    try:
        start_time = time.time()
        
        if args.modal:
            print(f"🚀 Transcribing with Modal: {args.audio_path}")
            result = transcribe_remote(
                audio_path=args.audio_path,
                model_name=args.model,
                output_dir=args.output_dir,
                save_output=True
            )
        else:
            print(f"🎯 Transcribing locally: {args.audio_path}")
            result = transcribe(
                audio_path=args.audio_path,
                model_name=args.model,
                output_dir=args.output_dir,
                save_output=True
            )
        
        total_time = time.time() - start_time
        duration = result.get("metadata", {}).get("duration", 0)
        speedup = duration / total_time if total_time > 0 else 0
        
        print(f"⏱️ Total time: {total_time:.2f}s")
        print(f"📊 Audio duration: {duration:.2f}s")
        print(f"📊 Speed: {speedup:.2f}x realtime")
        
        # Print a preview of the transcript
        text = result.get("text", "")
        print("\n--- Transcript Preview ---")
        print(text[:500] + ("..." if len(text) > 500 else ""))
        print("------------------------\n")
        
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        sys.exit(1)


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python -m whisperx.cli [summary|transcribe] [options]")
        sys.exit(1)
    
    command = sys.argv[1]
    args = sys.argv[2:]
    
    if command == "summary":
        summary_cmd(args)
    elif command == "transcribe":
        transcribe_cmd(args)
    else:
        print(f"Unknown command: {command}")
        print("Available commands: summary, transcribe")
        sys.exit(1)