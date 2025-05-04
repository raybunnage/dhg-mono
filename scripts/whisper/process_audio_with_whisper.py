import torch
import whisper
from tqdm import tqdm
import time
import threading
from datetime import datetime

class NonBlockingProgress:
    def __init__(self, desc="Processing"):
        self.desc = desc
        self.progress = None
        self.is_running = False
        
    def start(self, total_seconds):
        """Start progress bar with estimated duration"""
        self.progress = tqdm(
            total=100,
            desc=self.desc,
            bar_format='{desc}: {percentage:3.0f}%|{bar}| {n_fmt}/{total_fmt} [Time: {elapsed}<{remaining}]'
        )
        self.is_running = True
        
        def update_progress():
            start_time = time.time()
            while self.is_running:
                elapsed = time.time() - start_time
                progress = min(100, int((elapsed / total_seconds) * 100))
                self.progress.n = progress
                self.progress.refresh()
                time.sleep(0.1)  # Update every 0.1 seconds
                
        self.thread = threading.Thread(target=update_progress)
        self.thread.daemon = True
        self.thread.start()
    
    def stop(self):
        """Stop the progress bar"""
        self.is_running = False
        if self.progress:
            self.progress.n = 100
            self.progress.refresh()
            self.progress.close()

def process_audio_with_whisper(audio_path):
    """Process audio using Whisper with hybrid GPU/CPU approach"""
    progress = NonBlockingProgress("Transcribing audio")
    start_time = time.time()
    
    # Initial model loading and detection
    if torch.backends.mps.is_available():
        print("🚀 Using hybrid Apple Silicon GPU + CPU approach")
        gpu_device = "mps"
        cpu_device = "cpu"
    else:
        print("⚠️ Using CPU only")
        gpu_device = "cpu"
        cpu_device = "cpu"
    
    print("⌛ Loading Whisper model...")
    model = whisper.load_model("medium")
    
    # Get audio duration for progress estimation
    import soundfile as sf
    audio_info = sf.info(audio_path)
    estimated_time = audio_info.duration * 0.5  # Rough estimate: processing takes ~50% of audio duration
    
    # Move model to GPU for initial intensive processing
    if gpu_device == "mps":
        try:
            model = model.to(gpu_device)
            print("✅ Model ready on GPU")
        except Exception as e:
            print(f"⚠️ Couldn't move model to GPU: {e}")
            gpu_device = "cpu"
    
    try:
        # Start progress bar
        progress.start(estimated_time)
        
        # This is the most computationally intensive part
        mel = whisper.log_mel_spectrogram(audio_path)
        if gpu_device == "mps":
            mel = mel.to(gpu_device)
        mel = whisper.pad_or_trim(mel)
        
        # Main transcription
        result = model.transcribe(
            audio_path,
            language="en",
            verbose=False,  # Disable built-in progress output
            fp16=False,
            condition_on_previous_text=True,
            # Speed optimizations:
            beam_size=5,
            best_of=5,
            temperature=[0.0, 0.2, 0.4, 0.6, 0.8, 1.0],
        )
        
    except Exception as e:
        print(f"⚠️ GPU processing failed, falling back to CPU: {e}")
        gpu_device = "cpu"
        model = model.to(cpu_device)
        result = model.transcribe(
            audio_path,
            language="en",
            verbose=False,
            fp16=False,
            condition_on_previous_text=True
        )
    finally:
        # Stop progress bar
        progress.stop()
    
    # Show final stats
    total_time = time.time() - start_time
    print(f"\n✨ Transcription complete!")
    print(f"⏱️  Processing time: {total_time:.1f}s")
    print(f"🎯 Speed: {audio_info.duration/total_time:.1f}x realtime")
    
    return result 