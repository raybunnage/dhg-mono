import whisper
import torch
import os
from datetime import datetime
import json
from tqdm import tqdm

def get_optimal_device():
    """Determine the best available device for Apple Silicon"""
    if torch.backends.mps.is_available():
        print("🚀 Using Apple Silicon GPU!")
        return "mps"
    else:
        print("⚠️ Falling back to CPU")
        return "cpu"

def process_audio(audio_path, output_dir="transcripts"):
    """Process audio using original Whisper with Apple Silicon support"""
    print(f"🎯 Processing: {audio_path}")
    
    os.makedirs(output_dir, exist_ok=True)
    
    # Get optimal device
    device = get_optimal_device()
    
    # Load model
    print("⌛ Loading model (this may take a minute)...")
    model = whisper.load_model("medium").to(device)
    print("✅ Model loaded, starting transcription...")
    
    # Transcribe
    result = model.transcribe(
        audio_path,
        language="en",
        verbose=True,  # Show progress
        fp16=False  # Use float32 for better compatibility
    )
    
    # Process segments
    transcript_data = {
        "segments": result["segments"],
        "metadata": {
            "file": os.path.basename(audio_path),
            "date": datetime.now().isoformat(),
            "duration": result["segments"][-1]["end"] if result["segments"] else 0
        }
    }
    
    # Save outputs
    base_name = os.path.splitext(os.path.basename(audio_path))[0]
    json_path = os.path.join(output_dir, f"{base_name}.json")
    txt_path = os.path.join(output_dir, f"{base_name}.txt")
    
    with open(json_path, 'w') as f:
        json.dump(transcript_data, f, indent=2)
    
    with open(txt_path, 'w') as f:
        f.write(result["text"])
    
    print(f"✅ Saved to: {json_path} and {txt_path}")
    return {
        "text": result["text"],
        "segments": result["segments"],
        "language": result["language"]
    }

if __name__ == "__main__":
    process_audio("temp_audio.m4a") 