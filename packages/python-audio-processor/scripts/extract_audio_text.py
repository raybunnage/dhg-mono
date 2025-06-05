#!/usr/bin/env python3
"""
Audio Text Extraction - Advanced Audio Transcription with Modal

This script extracts text from an audio file using Modal and Whisper models.
It uploads a file to Modal, processes it with multiple GPUs in parallel,
and returns the transcription with high accuracy.

All parameters are configurable via audio_config.json
"""

import os
import sys
import time
import json
import logging
import argparse
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("modal-transcribe")

# Import Modal
try:
    import modal
    logger.info(f"Modal version: {modal.__version__}")
    logger.info(f"Modal path: {modal.__file__}")
except ImportError:
    logger.error("Modal not installed. Please install with: pip install modal")
    print("❌ Error: Modal not installed. Please install with: pip install modal")
    sys.exit(1)

# Load configuration
def load_config(preset=None, config_path=None):
    """Load configuration from JSON file with optional preset"""
    # Default config path is one directory up from the script
    if config_path is None:
        config_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "audio_config.json")
    
    try:
        with open(config_path, 'r') as f:
            config = json.load(f)
        
        # Start with default transcription settings
        settings = config["transcription"].copy()
        
        # Apply preset if specified
        if preset and preset in config["presets"]:
            preset_config = config["presets"][preset]
            settings.update(preset_config)
            logger.info(f"Applied preset: {preset}")
        
        return config, settings
    except Exception as e:
        logger.error(f"Error loading configuration: {str(e)}")
        print(f"❌ Error loading configuration: {str(e)}")
        sys.exit(1)

# Load the initial config (moved to main function to avoid issues)

# Define the Modal app
app = modal.App("parallel-audio-transcription")

# Define a container image with all required dependencies
image = (
    modal.Image.debian_slim()
    .apt_install(["ffmpeg"])
    .pip_install(
        "numpy",
        "torch",
        "torchaudio",
        "faster-whisper==0.10.0"
    )
)

# Create a volume to cache the models between runs
volume = modal.Volume.from_name("whisper-models-vol", create_if_missing=True)

# Function to create the appropriate app function based on current settings
def create_transcribe_function():
    """Dynamically create the transcribe_segment function based on current settings"""
    global transcribe_segment
    
    # Log the current configuration being used
    logger.info(f"Creating function with settings: {current_settings}")
    logger.info(f"GPU Type: {current_settings['gpu_type']}, Count: {current_settings['gpu_count']}")
    logger.info(f"Model: {current_settings['model']}, Timeout: {current_settings['timeout_seconds']}s")

    @app.function(
        gpu=current_settings['gpu_type'],
        timeout=current_settings['timeout_seconds'],
        image=image,
        volumes={"/root/.cache/whisper": volume},
        max_containers=current_settings['gpu_count']
    )
    def transcribe_segment(audio_data: bytes, segment_id: int = 0) -> Dict[str, Any]:
        """
        Transcribe an audio segment using the configured Whisper model.
        This function will run on a GPU in Modal's cloud.
        """
        import tempfile
        import time
        import json
        import numpy as np
        import torch
        import torchaudio
        from faster_whisper import WhisperModel
        
        print(f"Starting segment {segment_id} transcription on Modal...")
        start_time = time.time()
        
        # Create a temporary file to store the audio data
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as temp_file:
            temp_file.write(audio_data)
            temp_path = temp_file.name
        
        try:
            print(f"Audio segment {segment_id} received ({len(audio_data) / 1024:.2f} KB)")
            
            # Print environment info
            print(f"Python version: {sys.version}")
            print(f"PyTorch version: {torch.__version__}")
            
            # Check for GPU
            if torch.cuda.is_available():
                print(f"CUDA available: {torch.cuda.is_available()}")
                print(f"CUDA device: {torch.cuda.get_device_name(0)}")
                print(f"CUDA version: {torch.version.cuda}")
            else:
                print("CUDA not available")
            
            # Load the audio file with torchaudio to get basic info
            print("Loading audio file...")
            waveform, sample_rate = torchaudio.load(temp_path)
            
            duration = waveform.shape[1] / sample_rate
            print(f"Audio segment duration: {duration:.2f} seconds")
            
            # Initialize Whisper model
            print("Initializing Whisper model...")
            # Get optimal device settings
            device = "cuda" if torch.cuda.is_available() else "cpu"
            compute_type = "float16" if device == "cuda" else "float32"
            
            # Get the model size from configuration
            model_size = current_settings['model']
            model = WhisperModel(
                model_size,
                device=device,
                compute_type=compute_type,
                download_root="/root/.cache/whisper"  # Use the mounted volume
            )
            
            # Transcribe audio
            print(f"Transcribing audio segment {segment_id} with Whisper {model_size} model...")
            segments, info = model.transcribe(
                temp_path,
                beam_size=current_settings.get('beam_size', 5),
                language=current_settings.get('language', "en"),
                vad_filter=current_settings.get('use_vad', True),
                vad_parameters=current_settings.get('vad_parameters', dict(min_silence_duration_ms=500))
            )
            
            # Process segments
            segments_list = list(segments)
            print(f"Found {len(segments_list)} segments")
            
            # Extract text from segments
            transcript_text = ""
            segments_data = []
            
            for segment in segments_list:
                segments_data.append({
                    "start": segment.start,
                    "end": segment.end,
                    "text": segment.text
                })
                transcript_text += segment.text + " "
            
            # Get GPU information
            gpu_info = {}
            if torch.cuda.is_available():
                gpu_info = {
                    "device_name": torch.cuda.get_device_name(0),
                    "device_capability": ".".join(map(str, torch.cuda.get_device_capability(0))),
                    "total_memory": f"{torch.cuda.get_device_properties(0).total_memory / (1024**3):.2f} GB"
                }
            else:
                gpu_info = {"status": "No GPU detected"}
            
            # Prepare the result
            result = {
                "segment_id": segment_id,
                "metadata": {
                    "processing_time": time.time() - start_time,
                    "gpu_used": torch.cuda.is_available(),
                    "gpu_info": gpu_info,
                    "model": model_size,
                    "language": info.language,
                    "language_probability": info.language_probability
                },
                "audio_properties": {
                    "duration": duration,
                    "sample_rate": sample_rate,
                    "channels": waveform.shape[0],
                },
                "transcript": {
                    "text": transcript_text.strip(),
                    "segments": segments_data
                }
            }
            
            print(f"Segment {segment_id} transcription completed in {time.time() - start_time:.2f} seconds")
            return result
        
        finally:
            # Clean up the temporary file
            if os.path.exists(temp_path):
                os.unlink(temp_path)
                
    return transcribe_segment

def split_audio(audio_data: bytes, num_segments: int = 3) -> List[Tuple[bytes, int]]:
    """
    Split audio data into multiple segments for parallel processing.
    Returns a list of (audio_segment_data, segment_id) tuples.
    """
    import tempfile
    import subprocess
    
    print(f"Splitting audio into {num_segments} segments...")
    
    # Create a temp directory for the segments
    temp_dir = tempfile.mkdtemp()
    audio_path = os.path.join(temp_dir, "input.wav")
    
    try:
        # Save the input audio to a temporary file
        with open(audio_path, "wb") as f:
            f.write(audio_data)
        
        # Get audio duration using ffprobe
        duration_cmd = [
            "ffprobe", "-v", "error", "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1", audio_path
        ]
        duration = float(subprocess.check_output(duration_cmd).decode().strip())
        print(f"Audio duration: {duration:.2f} seconds")
        
        # Calculate segment length
        segment_length = duration / num_segments
        print(f"Each segment will be approximately {segment_length:.2f} seconds")
        
        segments = []
        for i in range(num_segments):
            start_time = i * segment_length
            output_path = os.path.join(temp_dir, f"segment_{i}.wav")
            
            # Use ffmpeg to extract segment
            cmd = [
                "ffmpeg", "-y", "-i", audio_path,
                "-ss", str(start_time),
                "-t", str(segment_length),
                "-c:a", "pcm_s16le",  # Use WAV format for compatibility
                output_path
            ]
            subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            
            # Read the segment
            with open(output_path, "rb") as f:
                segment_data = f.read()
            
            segments.append((segment_data, i))
            print(f"Segment {i}: {len(segment_data) / 1024:.2f} KB")
        
        return segments
    
    finally:
        # Clean up temporary files
        import shutil
        try:
            shutil.rmtree(temp_dir)
        except Exception as e:
            print(f"Warning: Could not clean up temporary directory: {e}")

def check_modal_connection():
    """Verify that we can connect to Modal"""
    print("🔍 Checking Modal connection...")
    
    try:
        # Simple connection test
        with modal.App().run():
            print("✅ Successfully connected to Modal!")
            return True
    except Exception as e:
        print(f"❌ Could not connect to Modal: {str(e)}")
        print("\nTroubleshooting steps:")
        print("1. Run 'modal token new' to refresh your token")
        print("2. Check your internet connection")
        print("3. Visit https://status.modal.com to check for service issues")
        return False

def main():
    # Load the initial config
    global current_settings
    config, current_settings = load_config()
    
    # Print the command-line arguments for debugging
    print(f"DEBUG: Script was called with arguments: {sys.argv}")
    
    parser = argparse.ArgumentParser(
        description="Extract text from audio file using Modal and Whisper with configurable settings"
    )
    parser.add_argument(
        "audio_path", 
        help="Path to the audio file (M4A format recommended)",
        nargs="?",  # Make audio_path optional
        default=None
    )
    parser.add_argument(
        "--verbose", "-v", 
        action="store_true",
        help="Enable verbose logging"
    )
    parser.add_argument(
        "--check", 
        action="store_true",
        help="Check Modal connection only"
    )
    parser.add_argument(
        "--output", "-o",
        help="Output path for the transcript (default: [input_filename]_transcript.txt)",
        default=None
    )
    parser.add_argument(
        "--segments", "-s",
        type=int,
        help=f"Number of segments to split the audio into (default: {current_settings['segments']})",
        default=None
    )
    parser.add_argument(
        "--preset",
        choices=list(config["presets"].keys()),
        help="Use a predefined configuration preset",
        default=None
    )
    parser.add_argument(
        "--model",
        choices=["tiny", "base", "small", "medium", "large"],
        help=f"Whisper model to use (default: {current_settings['model']})",
        default=None
    )
    parser.add_argument(
        "--gpu-type",
        choices=["T4", "A10G", "A100"],
        help=f"GPU type to use (default: {current_settings['gpu_type']})",
        default=None
    )
    parser.add_argument(
        "--gpu-count",
        type=int,
        help=f"Number of GPUs to use in parallel (default: {current_settings['gpu_count']})",
        default=None
    )
    parser.add_argument(
        "--timeout",
        type=int,
        help=f"Timeout in seconds (default: {current_settings['timeout_seconds']})",
        default=None
    )
    
    # Main execution with error handling
    try:
        # Parse arguments first
        args = parser.parse_args()
        logger.debug(f"Parsed arguments: {args}")
        
        # Make sure audio_path is required unless --check is specified
        if args.audio_path is None and not args.check:
            parser.error("audio_path is required unless --check is specified")
        
        # Set verbose logging if requested
        if args.verbose:
            logger.setLevel(logging.DEBUG)
            logger.debug("Verbose logging enabled")
            
            # Enable Modal debug logs
            modal_logger = logging.getLogger("modal")
            modal_logger.setLevel(logging.DEBUG)
            
            # Add a handler if none exists
            if not modal_logger.handlers:
                handler = logging.StreamHandler()
                handler.setFormatter(logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s'))
                modal_logger.addHandler(handler)
        
        # If a preset is specified, reload the configuration
        if args.preset:
            _, current_settings = load_config(preset=args.preset)
            print(f"Using preset: {args.preset}")
        
        # Override settings from command line arguments
        if args.segments is not None:
            current_settings['segments'] = args.segments
        if args.model is not None:
            current_settings['model'] = args.model
        if args.gpu_type is not None:
            current_settings['gpu_type'] = args.gpu_type
        if args.gpu_count is not None:
            current_settings['gpu_count'] = args.gpu_count
        if args.timeout is not None:
            current_settings['timeout_seconds'] = args.timeout
            
        # Log the final settings
        logger.info(f"Final settings: {current_settings}")
            
        # Check connection if requested
        if args.check:
            check_modal_connection()
            return
            
        # Dynamically create the transcribe function with current settings
        transcribe_segment = create_transcribe_function()
            
        # Process the audio file
        audio_path = args.audio_path
        if not os.path.exists(audio_path):
            print(f"❌ Error: Audio file not found: {audio_path}")
            sys.exit(1)
            
        # First check Modal connection
        if not check_modal_connection():
            print("⚠️ Modal connection check failed. Proceeding anyway, but this may fail.")
        
        print(f"🎯 Processing {audio_path} with Modal using parallel {current_settings['gpu_type']} GPUs...")
        logger.debug(f"Audio path: {os.path.abspath(audio_path)}")
        
        # Read the audio file as bytes
        with open(audio_path, 'rb') as f:
            audio_data = f.read()
        
        file_size_mb = len(audio_data) / (1024*1024)
        print(f"📤 Audio file size: {file_size_mb:.2f} MB")
        logger.debug(f"Audio file size: {len(audio_data)} bytes")
        
        # Start timing
        start_time = time.time()
        
        # Split the audio file into segments for parallel processing
        num_segments = current_settings['segments']
        segments = split_audio(audio_data, num_segments)
        print(f"🔪 Split audio into {len(segments)} segments for parallel processing")
        
        # Connect to Modal and run the function
        print("🚀 Connecting to Modal cloud service...")
        logger.debug("Initializing Modal app run")
        
        try:
            # Process segments in parallel
            with app.run():
                print(f"\n🔄 Connected to Modal, transcribing audio segments with {len(segments)} {current_settings['gpu_type']} GPUs...")
                logger.debug("Modal connection established, starting parallel transcription")
                
                # Launch transcription tasks in parallel
                futures = []
                for segment_data, segment_id in segments:
                    print(f"🚀 Launching segment {segment_id} ({len(segment_data) / 1024:.2f} KB)")
                    future = transcribe_segment.remote(audio_data=segment_data, segment_id=segment_id)
                    futures.append((segment_id, future))
                
                # Collect and process results
                print("⏳ Processing segments in parallel...")
                results = []
                for segment_id, future in futures:
                    print(f"⏳ Waiting for segment {segment_id}...")
                    result = future
                    results.append(result)
                    print(f"✅ Segment {segment_id} complete")
        except KeyboardInterrupt:
            print("\n⚠️ Process interrupted by user. Exiting...")
            sys.exit(1)
        except Exception as e:
            logger.exception("Error during Modal execution")
            print(f"\n❌ Error connecting to Modal: {str(e)}")
            print("Try running 'modal token new' to refresh your token")
            sys.exit(1)
        
        # Sort results by segment_id
        results.sort(key=lambda x: x["segment_id"])
        
        # Combine transcriptions
        full_transcript = " ".join(result["transcript"]["text"] for result in results)
        
        # Processing complete
        print("✅ Transcription complete, combining results...")
        
        # Calculate total time
        total_time = time.time() - start_time
        
        # Extract average processing time
        processing_times = [result.get("metadata", {}).get("processing_time", 0) for result in results]
        avg_processing_time = sum(processing_times) / len(processing_times)
        
        # Combine the full result
        combined_result = {
            "metadata": {
                "processing_times": processing_times,
                "avg_processing_time": avg_processing_time,
                "total_elapsed_time": total_time,
                "gpu_type": current_settings['gpu_type'],
                "model": current_settings['model'],
                "parallel_gpus": num_segments,
                "language": results[0].get("metadata", {}).get("language", "unknown"),
                "language_probability": results[0].get("metadata", {}).get("language_probability", 0)
            },
            "audio_properties": {
                "original_size_bytes": len(audio_data),
                "segments": num_segments
            },
            "transcript": {
                "text": full_transcript
            },
            "segment_results": results
        }
        
        # Determine output paths
        output_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "results")
        os.makedirs(output_dir, exist_ok=True)
        
        base_name = os.path.splitext(os.path.basename(audio_path))[0]
        
        if args.output:
            output_path = args.output
        else:
            output_path = os.path.join(output_dir, f"{base_name}_{current_settings['model']}_parallel.txt")
        
        # Save transcript to file
        with open(output_path, 'w') as f:
            f.write(full_transcript)
        
        # Save full JSON result
        json_path = os.path.join(output_dir, f"{base_name}_{current_settings['model']}_parallel.json") 
        with open(json_path, 'w') as f:
            json.dump(combined_result, f, indent=2)
        
        print(f"📊 Full results saved to: {json_path}")
        
        # Print a nicely formatted result
        print("\n" + "="*80)
        print(f"Parallel {current_settings['gpu_type']} Audio Transcription Results:")
        print("-"*80)
        print(f"Audio File: {os.path.basename(audio_path)}")
        print(f"File Size: {file_size_mb:.2f} MB")
        print(f"Segments: {num_segments}")
        print(f"Model: {current_settings['model']} (Whisper)")
        print(f"GPU: {current_settings['gpu_type']} ({num_segments} parallel)")
        print("-"*80)
        print("Transcript Preview:")
        print("-"*80)
        preview_length = min(500, len(full_transcript))
        print(full_transcript[:preview_length] + ("..." if len(full_transcript) > preview_length else ""))
        print("-"*80)
        print("Performance:")
        print(f"Processing Times: {', '.join(f'{t:.2f}s' for t in processing_times)}")
        print(f"Average Segment Time: {avg_processing_time:.2f} seconds")
        print(f"Total Round Trip: {total_time:.2f} seconds")
        audio_duration = sum(r.get("audio_properties", {}).get("duration", 0) for r in results)
        print(f"Audio Duration: ~{audio_duration:.2f} seconds")
        print(f"Speed: {audio_duration/avg_processing_time:.2f}x realtime")
        print("="*80 + "\n")
        
        print(f"✅ Transcript saved to: {output_path}")
        
    except Exception as e:
        logger.exception("Unexpected error")
        print(f"\n❌ Error processing audio: {str(e)}")
        import traceback
        traceback.print_exc()
        
        print("\nTroubleshooting steps:")
        print("1. Check your internet connection")
        print("2. Try running 'modal token new' to refresh your token")
        print("3. Check if Modal is experiencing issues: https://status.modal.com")
        sys.exit(1)

if __name__ == "__main__":
    main()