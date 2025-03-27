"""
Utility functions for WhisperX.
"""

import os
import sys
import json
import torch
from pathlib import Path
from typing import Dict, Any, Optional, Tuple

def get_optimal_device() -> Tuple[str, str]:
    """
    Determine the best available device and compute type for local processing.
    
    Returns:
        Tuple[str, str]: Device (cuda/cpu) and compute type (float16/float32)
    """
    if torch.cuda.is_available():
        print("🚀 CUDA GPU available!")
        device = "cuda"
        compute_type = "float16"  # Modern NVIDIA GPUs handle this well
    else:
        print("⚠️ Using CPU (faster-whisper doesn't support Apple Silicon GPU yet)")
        device = "cpu"
        compute_type = "float32"
    
    print(f"📊 Using device: {device}, compute_type: {compute_type}")
    return device, compute_type

def save_transcript(transcript_data: Dict[str, Any], audio_path: str, output_dir: str = "transcripts") -> Tuple[str, str]:
    """
    Save transcript data to JSON and TXT files.
    
    Args:
        transcript_data: The transcript data
        audio_path: Path to the audio file
        output_dir: Directory to save the transcript
        
    Returns:
        Tuple[str, str]: Paths to the JSON and TXT files
    """
    os.makedirs(output_dir, exist_ok=True)
    
    # Process file paths
    base_name = os.path.splitext(os.path.basename(audio_path))[0]
    json_path = os.path.join(output_dir, f"{base_name}.json")
    txt_path = os.path.join(output_dir, f"{base_name}.txt")
    
    # Save JSON
    with open(json_path, 'w') as f:
        json.dump(transcript_data, f, indent=2)
    
    # Extract full text for TXT file
    if "segments" in transcript_data:
        full_text = [segment["text"] for segment in transcript_data["segments"]]
        with open(txt_path, 'w') as f:
            f.write('\n'.join(full_text))
    else:
        # Just save the text if no segments
        with open(txt_path, 'w') as f:
            f.write(transcript_data.get("text", ""))
    
    print(f"✅ Saved to: {json_path} and {txt_path}")
    return json_path, txt_path

def setup_modal() -> None:
    """
    Setup Modal for first-time users. This is a helper function
    that guides users through Modal setup.
    """
    try:
        import modal
        print("Modal is installed. Running setup instructions...")
        
        print("\n" + "="*80)
        print("Modal Setup Instructions")
        print("="*80)
        print("\n1. If you haven't already, run 'modal token new' to authenticate.")
        print("2. Follow the instructions to create a Modal account.")
        print("3. This will open a browser to complete authentication.")
        print("\nOnce setup is complete, you can use WhisperX with Modal acceleration.")
        print("="*80 + "\n")
    except ImportError:
        print("Modal is not installed. Installing it now...")
        if os.system("pip install modal") == 0:
            print("Modal installed successfully. Now run 'modal token new' to set up your account.")
        else:
            print("Failed to install Modal. Please install it manually with 'pip install modal'.")
            sys.exit(1)