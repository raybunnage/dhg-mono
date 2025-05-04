#!/usr/bin/env python3
"""
Simple Modal Test Script - Quick Audio Processing Round Trip

This script demonstrates a simple round trip to Modal for audio processing.
It uploads a file to Modal, processes it with a T4 GPU, and returns 
a simple result within 60 seconds.

Uses Modal API v0.73+
"""

import os
import sys
import time
import json
import logging
import argparse
from pathlib import Path
from typing import Dict, Any, List, Optional

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("modal-test")

# Try to import Modal
try:
    import modal
    logger.info(f"Modal version: {modal.__version__}")
    logger.info(f"Modal path: {modal.__file__}")
except ImportError:
    logger.error("Modal not installed. Please install with: pip install modal")
    print("❌ Error: Modal not installed. Please install with: pip install modal")
    sys.exit(1)

# Define the Modal app
app = modal.App("audio-processor-test")

# Define a container image with just the essentials
image = (
    modal.Image.debian_slim()
    .apt_install(["ffmpeg"])
    .pip_install("numpy", "torch", "torchaudio")
)

@app.function(gpu="T4", timeout=60, image=image)
def quick_audio_analysis(audio_data: bytes) -> Dict[str, Any]:
    """
    Perform a quick audio analysis using Modal.
    This function will run on a T4 GPU in the cloud.
    """
    import tempfile
    import time
    import json
    import numpy as np
    import torch
    import torchaudio
    
    print("Starting audio analysis on Modal...")
    start_time = time.time()
    
    # Create a temporary file to store the audio data
    with tempfile.NamedTemporaryFile(suffix=".m4a", delete=False) as temp_file:
        temp_file.write(audio_data)
        temp_path = temp_file.name
    
    try:
        print(f"Audio data received ({len(audio_data) / 1024:.2f} KB)")
        
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
        
        # Load the audio file with torchaudio
        print("Loading audio file...")
        waveform, sample_rate = torchaudio.load(temp_path)
        
        print(f"Audio loaded: {waveform.shape} at {sample_rate}Hz")
        
        # Get some basic audio properties
        duration = waveform.shape[1] / sample_rate
        channels = waveform.shape[0]
        
        print(f"Duration: {duration:.2f} seconds, Channels: {channels}")
        
        # Calculate some basic audio features
        # Mean and std of the waveform
        mean_values = waveform.mean(dim=1).tolist()
        std_values = waveform.std(dim=1).tolist()
        
        # Get information about the GPU being used
        gpu_info = {}
        if torch.cuda.is_available():
            gpu_info = {
                "device_name": torch.cuda.get_device_name(0),
                "device_capability": ".".join(map(str, torch.cuda.get_device_capability(0))),
                "total_memory": f"{torch.cuda.get_device_properties(0).total_memory / (1024**3):.2f} GB"
            }
        else:
            gpu_info = {"status": "No GPU detected"}
        
        # Simple frequency analysis
        if waveform.shape[1] > 0:
            print("Performing frequency analysis...")
            # Convert to mono if stereo
            if waveform.shape[0] > 1:
                waveform_mono = torch.mean(waveform, dim=0, keepdim=True)
            else:
                waveform_mono = waveform
                
            # Simple FFT for frequency analysis
            n_fft = 2048
            window = torch.hann_window(n_fft)
            stft = torch.stft(
                waveform_mono[0], 
                n_fft=n_fft, 
                hop_length=n_fft//4, 
                window=window, 
                return_complex=True
            )
            magnitudes = torch.abs(stft)
            
            # Get frequency bins
            freq_bins = torch.fft.rfftfreq(n_fft, 1/sample_rate)
            
            # Find dominant frequencies
            mean_magnitudes = torch.mean(magnitudes, dim=1)
            top_k = 5
            top_magnitudes, top_indices = torch.topk(mean_magnitudes, k=min(top_k, len(mean_magnitudes)))
            
            dominant_freqs = []
            for i, idx in enumerate(top_indices):
                freq = freq_bins[idx].item()
                magnitude = top_magnitudes[i].item()
                dominant_freqs.append({
                    "frequency_hz": freq,
                    "magnitude": magnitude,
                })
                
            print(f"Found {len(dominant_freqs)} dominant frequencies")
        else:
            dominant_freqs = []
            print("Audio too short for frequency analysis")
        
        # Prepare the result
        print("Analysis complete, preparing results...")
        result = {
            "metadata": {
                "processing_time": time.time() - start_time,
                "gpu_used": torch.cuda.is_available(),
                "gpu_info": gpu_info,
            },
            "audio_properties": {
                "duration": duration,
                "sample_rate": sample_rate,
                "channels": channels,
            },
            "basic_features": {
                "mean_values": mean_values,
                "std_values": std_values,
            },
            "frequency_analysis": {
                "dominant_frequencies": dominant_freqs
            }
        }
        
        print(f"Analysis completed in {time.time() - start_time:.2f} seconds")
        return result
    
    finally:
        # Clean up the temporary file
        if os.path.exists(temp_path):
            os.unlink(temp_path)

def setup_modal():
    """Display Modal setup instructions"""
    print("\n" + "="*80)
    print("Modal Setup Instructions")
    print("="*80)
    print("\n1. If you haven't already, run 'modal token new' to authenticate.")
    print("2. Follow the instructions to create a Modal account.")
    print("3. This will open a browser to complete authentication.")
    print("\nOnce setup is complete, you can use Modal for audio processing.")
    print("="*80 + "\n")

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
    parser = argparse.ArgumentParser(
        description="Quick Audio Processing Round Trip with Modal"
    )
    parser.add_argument(
        "audio_path", 
        help="Path to the audio file (M4A format recommended)",
        nargs="?",  # Make audio_path optional
        default=None
    )
    parser.add_argument(
        "--setup", 
        action="store_true",
        help="Run Modal setup only"
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
    
    args = parser.parse_args()
    
    # Make sure audio_path is required unless --setup or --check is specified
    if args.audio_path is None and not (args.setup or args.check):
        parser.error("audio_path is required unless --setup or --check is specified")
    
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
    
    if args.setup:
        setup_modal()
        return
        
    if args.check:
        check_modal_connection()
        return
    
    audio_path = args.audio_path
    if not os.path.exists(audio_path):
        print(f"❌ Error: Audio file not found: {audio_path}")
        sys.exit(1)
    
    # First check Modal connection
    if not check_modal_connection():
        print("⚠️ Modal connection check failed. Proceeding anyway, but this may fail.")
    
    print(f"🎯 Processing {audio_path} with Modal...")
    logger.debug(f"Audio path: {os.path.abspath(audio_path)}")
    
    try:
        # Read the audio file as bytes
        with open(audio_path, 'rb') as f:
            audio_data = f.read()
        
        file_size_mb = len(audio_data) / (1024*1024)
        print(f"📤 Uploading audio file ({file_size_mb:.2f} MB) to Modal...")
        logger.debug(f"Audio file size: {len(audio_data)} bytes")
        
        # Start timing
        start_time = time.time()
        
        # Connect to Modal and run the function
        print("🚀 Connecting to Modal cloud service...")
        logger.debug("Initializing Modal app run")
        
        try:
            # Use the app directly, not through context
            with app.run():
                print("\n🔄 Connected to Modal, running audio analysis on T4 GPU...")
                logger.debug("Modal connection established, starting remote execution")
                
                # Call the remote function
                print("⏳ Starting remote execution (this may take a moment)...")
                result = quick_audio_analysis.remote(audio_data=audio_data)
                logger.debug("Remote execution completed")
        except KeyboardInterrupt:
            print("\n⚠️ Process interrupted by user. Exiting...")
            sys.exit(1)
        except Exception as e:
            logger.exception("Error during Modal execution")
            print(f"\n❌ Error connecting to Modal: {str(e)}")
            print("Try running 'modal token new' to refresh your token")
            sys.exit(1)
        
        # Processing complete
        print("✅ Processing complete, retrieving results...")
        
        # Calculate total time
        total_time = time.time() - start_time
        
        # Extract results
        processing_time = result.get("metadata", {}).get("processing_time", 0)
        gpu_used = result.get("metadata", {}).get("gpu_used", False)
        gpu_info = result.get("metadata", {}).get("gpu_info", {})
        duration = result.get("audio_properties", {}).get("duration", 0)
        
        # Print a nicely formatted result
        print("\n" + "="*80)
        print("Audio Analysis Results:")
        print("-"*80)
        print(f"Audio Duration: {duration:.2f} seconds ({duration/60:.2f} minutes)")
        print(f"Sample Rate: {result.get('audio_properties', {}).get('sample_rate', 0)} Hz")
        print(f"Channels: {result.get('audio_properties', {}).get('channels', 0)}")
        
        # Print frequency analysis if available
        if "frequency_analysis" in result and "dominant_frequencies" in result["frequency_analysis"]:
            freqs = result["frequency_analysis"]["dominant_frequencies"]
            if freqs:
                print("\nDominant Frequencies:")
                for i, freq_data in enumerate(freqs[:3]):  # Show top 3
                    print(f"  {i+1}. {freq_data['frequency_hz']:.1f} Hz (magnitude: {freq_data['magnitude']:.2f})")
        
        print("-"*80)
        print("Performance:")
        print(f"GPU Used: {gpu_used}")
        if gpu_used and gpu_info:
            if isinstance(gpu_info, dict) and "device_name" in gpu_info:
                print(f"GPU Model: {gpu_info.get('device_name', 'Unknown')}")
                if "total_memory" in gpu_info:
                    print(f"GPU Memory: {gpu_info.get('total_memory')}")
        print(f"Processing Time: {processing_time:.2f} seconds")
        print(f"Total Round Trip: {total_time:.2f} seconds")
        print("="*80 + "\n")
        
        # Save results to a JSON file
        output_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "results")
        os.makedirs(output_dir, exist_ok=True)
        
        base_name = os.path.splitext(os.path.basename(audio_path))[0]
        result_path = os.path.join(output_dir, f"{base_name}_analysis.json")
        
        with open(result_path, 'w') as f:
            json.dump(result, f, indent=2)
        
        print(f"✅ Results saved to: {result_path}")
        
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