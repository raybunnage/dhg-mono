import time
import whisper
import torch
from faster_whisper import WhisperModel
import os

def benchmark_original_whisper(audio_path):
    """Benchmark original Whisper with Apple Silicon"""
    print("\n🔍 Testing Original Whisper with Apple Silicon:")
    
    start_time = time.time()
    
    # Load model
    print("⌛ Loading model...")
    model_load_start = time.time()
    model = whisper.load_model("medium").to("mps")
    model_load_time = time.time() - model_load_start
    print(f"✅ Model loaded in {model_load_time:.2f}s")
    
    # Transcribe
    print("🎯 Transcribing...")
    transcribe_start = time.time()
    result = model.transcribe(
        audio_path,
        language="en",
        fp16=False
    )
    transcribe_time = time.time() - transcribe_start
    
    total_time = time.time() - start_time
    return {
        "name": "Original Whisper (Apple Silicon)",
        "model_load_time": model_load_time,
        "transcribe_time": transcribe_time,
        "total_time": total_time,
        "text_length": len(result["text"])
    }

def benchmark_faster_whisper(audio_path):
    """Benchmark faster-whisper on CPU"""
    print("\n🔍 Testing faster-whisper on CPU:")
    
    start_time = time.time()
    
    # Load model
    print("⌛ Loading model...")
    model_load_start = time.time()
    model = WhisperModel(
        "medium",
        device="cpu",
        compute_type="float32",
        num_workers=4
    )
    model_load_time = time.time() - model_load_start
    print(f"✅ Model loaded in {model_load_time:.2f}s")
    
    # Transcribe
    print("🎯 Transcribing...")
    transcribe_start = time.time()
    result = model.transcribe(
        audio_path,
        language="en",
        beam_size=5
    )
    segments = list(result[0])
    text = " ".join(segment.text for segment in segments)
    transcribe_time = time.time() - transcribe_start
    
    total_time = time.time() - start_time
    return {
        "name": "faster-whisper (CPU)",
        "model_load_time": model_load_time,
        "transcribe_time": transcribe_time,
        "total_time": total_time,
        "text_length": len(text)
    }

def run_benchmark(audio_path):
    """Run benchmarks and compare results"""
    results = []
    
    # Run both benchmarks
    results.append(benchmark_original_whisper(audio_path))
    results.append(benchmark_faster_whisper(audio_path))
    
    # Print comparison
    print("\n📊 Benchmark Results:")
    print("-" * 50)
    for result in results:
        print(f"\n{result['name']}:")
        print(f"  Model Load Time: {result['model_load_time']:.2f}s")
        print(f"  Transcribe Time: {result['transcribe_time']:.2f}s")
        print(f"  Total Time: {result['total_time']:.2f}s")
        print(f"  Text Length: {result['text_length']} chars")
        print(f"  Speed: {result['text_length']/result['transcribe_time']:.2f} chars/sec")

if __name__ == "__main__":
    run_benchmark("temp_audio.m4a") 