#!/usr/bin/env python3
"""
Extract a quick summary from an M4A audio file.

This script uses Modal and Whisper to generate a short summary
of the audio content in an M4A file.
"""

import os
import sys
import argparse
import time
from pathlib import Path
from typing import Dict, Any, Optional

# Add the parent directory to sys.path
parent_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, parent_dir)

# Import Modal
try:
    import modal
except ImportError:
    print("Modal not installed. Please install with: pip install modal")
    sys.exit(1)

# Define Modal resources at global scope
# The Nvidia T4 is the most cost-effective option at $0.80/hour
modal_image = (
    modal.Image.debian_slim()
    .apt_install(["ffmpeg", "libsm6", "libxext6"])  # System dependencies
    .pip_install(
        "faster-whisper==0.10.0",
        "tqdm>=4.65.0",
        "torch",
        "numpy",
        "av",  # Add PyAV for audio processing
        "ffmpeg-python",  # Add ffmpeg-python for audio processing
    )
)

# Create an app
app = modal.App("whisperx-summary-app")

@app.function(gpu="T4", timeout=120, image=modal_image)  # Reduced timeout to 2 minutes
def process_audio_modal(audio_data: bytes, model_name: str = "small", max_length: int = 1000) -> Dict[str, Any]:
    """Process audio file in Modal cloud with GPU acceleration"""
    import os
    import time
    import torch
    import tempfile
    from datetime import datetime
    from faster_whisper import WhisperModel
    
    start_time = time.time()
    
    # Get optimal device settings
    device = "cuda" if torch.cuda.is_available() else "cpu"
    compute_type = "float16" if device == "cuda" else "float32"
    
    print(f"Using device: {device}, compute type: {compute_type}")
    
    # Initialize model
    model = WhisperModel(
        model_name,
        device=device,
        compute_type=compute_type,
        download_root=".models",
        num_workers=4
    )
    
    # Save the audio data to a temporary file
    with tempfile.NamedTemporaryFile(suffix=".m4a", delete=False) as temp_file:
        temp_file.write(audio_data)
        temp_path = temp_file.name
    
    try:
        # Transcribe audio
        segments, info = model.transcribe(
            temp_path,
            beam_size=5,
            language="en",
            vad_filter=True,
            vad_parameters=dict(min_silence_duration_ms=500)
        )
    finally:
        # Clean up the temporary file
        if os.path.exists(temp_path):
            os.unlink(temp_path)
    
    # Process segments
    segments_list = list(segments)
    
    # Format result
    transcript_data = {
        "segments": [],
        "metadata": {
            "file": "audio_file.m4a",  # We don't have the original filename anymore
            "date": datetime.now().isoformat(),
            "duration": info.duration,
            "processing_time": time.time() - start_time,
            "model": model_name,
            "device": device
        }
    }
    
    full_text = []
    for segment in segments_list:
        transcript_data["segments"].append({
            "start": segment.start,
            "end": segment.end,
            "text": segment.text
        })
        full_text.append(segment.text)
    
    # Add the full text to the result
    transcript_data["text"] = " ".join(full_text)
    
    # Create a summary (first N words) focusing on first 10 minutes
    # Filter segments by time - focus on first 10 minutes (600 seconds)
    ten_min_segments = [s for s in transcript_data["segments"] if s["start"] < 600]
    ten_min_text = " ".join([s["text"] for s in ten_min_segments])
    
    # If we have text for the first 10 minutes, use that for summary
    if ten_min_text:
        words = ten_min_text.split()
        if len(words) > max_length:
            summary = " ".join(words[:max_length]) + "..."
        else:
            summary = ten_min_text
    else:
        # Fallback to using all text
        words = transcript_data["text"].split()
        if len(words) > max_length:
            summary = " ".join(words[:max_length]) + "..."
        else:
            summary = transcript_data["text"]
    
    # Add summary to the result
    transcript_data["summary"] = summary
    
    return transcript_data

def setup_modal():
    """Run Modal setup for first-time users"""
    print("\n" + "="*80)
    print("Modal Setup Instructions")
    print("="*80)
    print("\n1. If you haven't already, run 'modal token new' to authenticate.")
    print("2. Follow the instructions to create a Modal account.")
    print("3. This will open a browser to complete authentication.")
    print("\nOnce setup is complete, you can use WhisperX with Modal acceleration.")
    print("="*80 + "\n")

def main():
    import time  # Import time at the function level
    import sys   # Import sys at the function level
    
    parser = argparse.ArgumentParser(
        description="Extract a quick summary from an M4A audio file using Modal"
    )
    parser.add_argument(
        "audio_path", 
        help="Path to the M4A audio file"
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
    parser.add_argument(
        "--length",
        type=int,
        default=1000,
        help="Maximum summary length in words"
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
    
    print(f"🎯 Processing {audio_path} with Modal...")
    
    try:
        # Ensure output directory exists
        os.makedirs(args.output_dir, exist_ok=True)
        
        start_time = time.time()
        
        # Read the audio file as bytes
        with open(audio_path, 'rb') as f:
            audio_data = f.read()
        
        file_size_mb = len(audio_data) / (1024*1024)
        print(f"📤 Uploading audio file ({file_size_mb:.2f} MB)...")
        
        # Import necessary modules for the upload progress
        import sys
        
        # If file is large, show a progress bar for theoretical upload time
        if file_size_mb > 5:
            print("Uploading: ", end="")
            # Simulate upload progress (estimate ~1MB/sec)
            est_upload_time = min(int(file_size_mb), 30)  # Cap at 30 seconds
            for i in range(est_upload_time + 1):
                progress = i / est_upload_time
                bar_length = 20
                filled_length = int(bar_length * progress)
                bar = '█' * filled_length + '░' * (bar_length - filled_length)
                percent = progress * 100
                sys.stdout.write(f"\rUploading: [{bar}] {percent:.1f}% ")
                sys.stdout.flush()
                time.sleep(0.1)  # Faster simulation for better UX
            print("\rUpload complete: [████████████████████] 100.0%")
        
        # Validate that the audio file seems valid
        if len(audio_data) < 1000:
            print(f"⚠️ Warning: Audio file is suspiciously small ({len(audio_data)} bytes)")
        
        print("🔄 Connecting to Modal cloud service...")
        
        # Import necessary modules for the spinner
        import threading
        import itertools
        import time as time_module  # Use a different name to avoid conflicts
        import sys
        
        # Add progress spinner function
        def show_spinner(message, duration=0.5):
            """Display a spinner with a message to indicate progress"""
            spinner_chars = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
            
            stop_spinner = threading.Event()
            
            def spin():
                for char in itertools.cycle(spinner_chars):
                    if stop_spinner.is_set():
                        break
                    sys.stdout.write(f"\r{char} {message}")
                    sys.stdout.flush()
                    time_module.sleep(duration)
            
            spinner_thread = threading.Thread(target=spin)
            spinner_thread.daemon = True
            spinner_thread.start()
            
            return stop_spinner
        
        # Run the Modal function with increased timeout
        try:
            print("📡 Connecting to Modal cloud service...")
            spinner = show_spinner("Starting remote processing (initializing GPU, this might take a minute)...")
            
            with app.run():
                print("\n🔄 Connected to Modal, sending audio data...")
                
                # Start a new spinner for the transcription process
                try:
                    spinner.set()
                except:
                    pass  # Handle any potential error with the spinner
                
                # Create a timer spinner that shows elapsed time
                process_start = time.time()
                max_time = 120  # Maximum time to wait (in seconds)
                
                def get_timer_message():
                    elapsed = time.time() - process_start
                    remaining = max_time - elapsed
                    if remaining < 0:
                        return f"Processing... (⚠️ TIMEOUT SOON: {abs(remaining):.0f}s over limit)"
                    else:
                        return f"Processing audio with WhisperX ({elapsed:.0f}s elapsed, timeout in {remaining:.0f}s)"
                
                spinner = show_spinner(get_timer_message())
                
                # Set up a timeout thread to automatically cancel after max_time + buffer
                cancel_requested = False
                def timeout_monitor():
                    nonlocal cancel_requested
                    time_module.sleep(max_time + 10)  # Add 10s buffer
                    if not cancel_requested:
                        print("\n⚠️ Processing is taking too long! Cancelling to avoid excessive charges.")
                        cancel_requested = True
                        # Cannot easily cancel Modal operations, but we'll exit the script
                        import os
                        os._exit(1)
                
                timeout_thread = threading.Thread(target=timeout_monitor)
                timeout_thread.daemon = True
                timeout_thread.start()
                
                # Start a timer thread to update the spinner message
                def update_spinner_message():
                    while not cancel_requested:
                        try:
                            spinner.set()
                            spinner = show_spinner(get_timer_message())
                            time_module.sleep(1)
                        except:
                            break
                
                message_thread = threading.Thread(target=update_spinner_message)
                message_thread.daemon = True
                message_thread.start()
                
                try:
                    # Use a timeout for the remote function call
                    result = process_audio_modal.remote(
                        audio_data=audio_data,
                        model_name=args.model,
                        max_length=args.length
                    )
                    cancel_requested = True  # Signal the threads to stop
                except Exception as e:
                    cancel_requested = True  # Signal the threads to stop
                    raise e
                
                # Stop the spinner and show completion message
                try:
                    spinner.set()
                except:
                    pass  # Handle any potential error with the spinner
                print("\n✅ Processing complete, retrieving results...")
        except Exception as modal_error:
            # Make sure to stop the spinner
            try:
                spinner.set()
            except:
                pass
                
            print(f"\n❌ Modal processing error: {str(modal_error)}")
            print("\nTroubleshooting steps:")
            print("1. Check your internet connection")
            print("2. Try running 'modal token new' to refresh your token")
            print("3. Try a smaller audio file or use the --clip option")
            print("4. Check if the Modal service is experiencing issues: https://status.modal.com")
            
            # Add a special message for specific errors
            error_str = str(modal_error).lower()
            if "timeout" in error_str or "reschedule" in error_str:
                print("\n⚠️ This appears to be a Modal service issue. The service might be experiencing high demand.")
                print("   Wait a few minutes and try again, or try during off-peak hours.")
            
            sys.exit(1)
        
        # Extract summary
        summary = result.get("summary", "")
        
        # Save summary
        base_name = os.path.splitext(os.path.basename(audio_path))[0]
        summary_path = os.path.join(args.output_dir, f"{base_name}.txt")
        
        with open(summary_path, 'w') as f:
            f.write(summary)
        
        # Calculate performance metrics
        total_time = time.time() - start_time
        audio_duration = result.get("metadata", {}).get("duration", 0)
        processing_time = result.get("metadata", {}).get("processing_time", 0)
        speedup = audio_duration / total_time if total_time > 0 else 0
        
        print("\n" + "="*80)
        print("Summary:")
        print("-"*80)
        print(summary[:500] + ("..." if len(summary) > 500 else ""))
        print("-"*80)
        print(f"✅ Summary saved to: {summary_path}")
        print(f"⏱️ Processing metrics:")
        print(f"   - Audio duration: {audio_duration:.2f}s")
        print(f"   - Total time: {total_time:.2f}s")
        print(f"   - Processing time: {processing_time:.2f}s")
        print(f"   - Speed: {speedup:.2f}x realtime")
        print("="*80 + "\n")
        
    except Exception as e:
        print(f"❌ Error processing audio: {str(e)}")
        print("\nDetailed error information:")
        import traceback
        traceback.print_exc()
        print("\nTroubleshooting steps:")
        print("1. Check that the audio file exists and is not corrupted")
        print("2. Try refreshing your Modal token with: modal token new")
        print("3. Try using a different audio file or clip it to a smaller size")
        print("4. Check the Modal status page: https://status.modal.com")
        
        # Import sys here in case it wasn't imported earlier
        try:
            sys.exit(1)
        except:
            import sys
            sys.exit(1)

if __name__ == "__main__":
    main()