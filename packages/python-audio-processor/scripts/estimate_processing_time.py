#!/usr/bin/env python3
"""
Estimate Modal processing time for audio files to avoid timeout costs.

This script analyzes an audio file and provides an estimate of how much time 
to allocate for Modal processing based on file characteristics and model complexity.
"""

import os
import sys
import argparse
import subprocess
import json
import math
from pathlib import Path


def get_audio_info(file_path):
    """Extract audio file duration and other metadata using ffprobe."""
    try:
        cmd = [
            "ffprobe",
            "-v", "error",
            "-show_format",
            "-show_streams",
            "-of", "json",
            file_path
        ]
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        info = json.loads(result.stdout)
        
        # Extract key information
        duration = float(info.get("format", {}).get("duration", 0))
        bit_rate = int(info.get("format", {}).get("bit_rate", 0))
        file_size = int(info.get("format", {}).get("size", 0))
        
        # Get audio stream info
        audio_streams = [s for s in info.get("streams", []) if s.get("codec_type") == "audio"]
        sample_rate = int(audio_streams[0].get("sample_rate", 0)) if audio_streams else 0
        channels = int(audio_streams[0].get("channels", 0)) if audio_streams else 0
        
        return {
            "duration": duration,
            "bit_rate": bit_rate,
            "file_size": file_size,
            "sample_rate": sample_rate,
            "channels": channels
        }
    except Exception as e:
        print(f"Error getting audio information: {str(e)}")
        sys.exit(1)


def estimate_processing_time(audio_info, model_size="tiny", parallel_gpus=1, gpu_type="T4"):
    """
    Estimate processing time based on audio characteristics and model size.
    
    Processing time factors:
    1. Audio duration
    2. Model complexity (tiny, base, small, medium, large)
    3. Overhead for Modal startup and data transfer
    4. Number of parallel GPUs (when using parallel processing)
    5. GPU type/performance (T4, A10G, A100, etc.)
    """
    duration = audio_info["duration"]
    
    # Base multipliers for different Whisper models
    model_multipliers = {
        "tiny": 0.3,    # Fastest model
        "base": 0.5,    # Still quite fast
        "small": 1.0,   # Reference point
        "medium": 2.0,  # More complex
        "large": 4.0    # Most complex
    }
    
    # GPU performance multipliers (relative speed compared to T4)
    # These are approximate based on general performance benchmarks
    gpu_performance = {
        "T4": 1.0,      # Reference point - NVIDIA T4
        "A10G": 2.5,    # NVIDIA A10G - ~2.5x faster than T4
        "A100": 5.0     # NVIDIA A100 - ~5x faster than T4
    }
    
    # GPU hourly costs (approximate)
    gpu_costs = {
        "T4": 0.60,     # $0.60/hour per GPU
        "A10G": 1.20,   # $1.20/hour per GPU
        "A100": 3.50    # $3.50/hour per GPU
    }
    
    # Ensure model size is valid
    if model_size not in model_multipliers:
        print(f"Warning: Unknown model '{model_size}', using 'small' as default")
        model_size = "small"
    
    # Ensure GPU type is valid
    if gpu_type not in gpu_performance:
        print(f"Warning: Unknown GPU type '{gpu_type}', using 'T4' as default")
        gpu_type = "T4"
    
    # Base estimate: duration * model complexity factor
    base_estimate = duration * model_multipliers[model_size]
    
    # Apply GPU performance multiplier (faster GPU = less time)
    base_estimate = base_estimate / gpu_performance[gpu_type]
    
    # Add overhead for Modal startup, data transfer, etc.
    modal_overhead = 15  # seconds, empirical minimum
    
    # Additional overhead for large files (> 50MB assumed as threshold)
    size_overhead = 0
    if audio_info["file_size"] > 50 * 1024 * 1024:  # > 50MB
        size_overhead = 10  # seconds
    
    # Additional time for high-quality audio (high sample rate or stereo)
    quality_overhead = 0
    if audio_info["sample_rate"] > 44100 or audio_info["channels"] > 1:
        quality_overhead = duration * 0.1  # 10% extra for high-quality audio
    
    # Calculate total single-GPU estimate
    total_seconds = base_estimate + modal_overhead + size_overhead + quality_overhead
    
    # If using parallel processing, calculate adjusted time
    if parallel_gpus > 1:
        # Each GPU processes a segment of the audio
        segment_duration = duration / parallel_gpus
        
        # Calculate segment processing time (with same model and GPU type)
        segment_time = (segment_duration * model_multipliers[model_size]) / gpu_performance[gpu_type]
        
        # Add overhead for each segment (model loading, etc.)
        segment_time += 15  # Overhead per segment
        
        # Small extra buffer for segment recombination
        recombination_overhead = 5
        
        # The longest segment determines the overall time
        # Add a coordination overhead (10%)
        total_seconds = segment_time * 1.1 + recombination_overhead
    
    # Add buffer for unexpected delays (20%)
    total_seconds *= 1.2
    
    # Round up to nearest minute for timeout setting
    timeout_minutes = math.ceil(total_seconds / 60)
    
    # Ensure minimum timeout of 1 minute
    timeout_minutes = max(1, timeout_minutes)
    
    # Calculate cost estimate
    hourly_rate = gpu_costs[gpu_type]
    cost_per_second = hourly_rate / 3600
    estimated_cost = cost_per_second * total_seconds * parallel_gpus
    
    # Calculate worst-case cost (if it hits timeout)
    worst_case_cost = cost_per_second * (timeout_minutes * 60) * parallel_gpus
    
    return {
        "raw_seconds": total_seconds,
        "timeout_minutes": timeout_minutes,
        "model_size": model_size,
        "parallel_gpus": parallel_gpus,
        "gpu_type": gpu_type,
        "estimated_cost": estimated_cost,
        "worst_case_cost": worst_case_cost,
        "hourly_rate": hourly_rate
    }


def print_estimate(file_path, estimate, audio_info):
    """Print a user-friendly estimate with recommendations."""
    duration_min = math.floor(audio_info["duration"] / 60)
    duration_sec = audio_info["duration"] % 60
    
    file_size_mb = audio_info["file_size"] / (1024 * 1024)
    
    print("\n===== Modal Processing Time Estimate =====")
    print(f"File: {os.path.basename(file_path)}")
    print(f"Duration: {duration_min} min {duration_sec:.1f} sec")
    print(f"File size: {file_size_mb:.2f} MB")
    print(f"Sample rate: {audio_info['sample_rate']} Hz")
    print(f"Channels: {audio_info['channels']}")
    
    # Print info for selected configuration
    gpu_type = estimate["gpu_type"]
    model_size = estimate["model_size"]
    gpus = estimate["parallel_gpus"]
    
    print(f"\nSelected configuration: {gpus}x {gpu_type} GPU(s), {model_size} model")
    print(f"  • Processing time: {estimate['raw_seconds']:.1f} sec → {estimate['timeout_minutes']} min timeout")
    print(f"  • Estimated cost: ${estimate['estimated_cost']:.4f} (${estimate['worst_case_cost']:.4f} if timeout hit)")
    
    # Compare GPU types if medium or large model is selected
    if model_size in ["small", "medium", "large"] and audio_info["duration"] > 300:
        print("\nGPU type comparison (3 GPUs in parallel):")
        
        # Calculate for different GPU types
        t4_est = estimate_processing_time(audio_info, model_size, 3, "T4")
        a10g_est = estimate_processing_time(audio_info, model_size, 3, "A10G")
        a100_est = estimate_processing_time(audio_info, model_size, 3, "A100")
        
        # Build comparison table
        print("  ┌────────┬────────────┬───────────┬──────────────┬────────────────┐")
        print("  │ GPU    │ Est. Time  │ Timeout   │ Est. Cost    │ Cost/Perf Ratio│")
        print("  ├────────┼────────────┼───────────┼──────────────┼────────────────┤")
        print(f"  │ T4     │ {t4_est['raw_seconds']:7.1f} sec │ {t4_est['timeout_minutes']:3} min   │ ${t4_est['estimated_cost']:7.4f}   │ {1.0:7.2f}        │")
        print(f"  │ A10G   │ {a10g_est['raw_seconds']:7.1f} sec │ {a10g_est['timeout_minutes']:3} min   │ ${a10g_est['estimated_cost']:7.4f}   │ {a10g_est['estimated_cost']/t4_est['estimated_cost']:7.2f}        │")
        print(f"  │ A100   │ {a100_est['raw_seconds']:7.1f} sec │ {a100_est['timeout_minutes']:3} min   │ ${a100_est['estimated_cost']:7.4f}   │ {a100_est['estimated_cost']/t4_est['estimated_cost']:7.2f}        │")
        print("  └────────┴────────────┴───────────┴──────────────┴────────────────┘")
        
        # Calculate cost-efficiency
        t4_cost_perf = t4_est['estimated_cost'] / t4_est['raw_seconds']
        a10g_cost_perf = a10g_est['estimated_cost'] / a10g_est['raw_seconds']
        a100_cost_perf = a100_est['estimated_cost'] / a100_est['raw_seconds']
        
        # Find the most cost-efficient option
        options = [
            ("T4", t4_cost_perf, t4_est['raw_seconds']),
            ("A10G", a10g_cost_perf, a10g_est['raw_seconds']),
            ("A100", a100_cost_perf, a100_est['raw_seconds'])
        ]
        
        # Sort by cost/performance (lower is better)
        options.sort(key=lambda x: x[1])
        best_cost_option = options[0][0]
        
        # Sort by absolute speed (lower is better)
        options.sort(key=lambda x: x[2])
        fastest_option = options[0][0]
        
        # Make recommendations
        print("\nGPU recommendations:")
        print(f"  • Most cost-efficient: {best_cost_option}")
        print(f"  • Fastest processing: {fastest_option}")
        
        # Special case recommendations
        if audio_info["duration"] > 600 and model_size in ["medium", "large"]:
            print(f"  • For {duration_min} min files with {model_size} model: A10G offers good balance")
        if audio_info["duration"] > 1200:  # > 20 minutes
            print(f"  • For very long files: A100 minimizes risk of timeouts")
    
    # Print recommendations for optimal settings
    print(f"\nRecommended timeout settings:")
    
    if gpus > 1:
        print(f"  timeout={estimate['timeout_minutes']*60}, max_containers={gpus}")
    else:
        print(f"  timeout={estimate['timeout_minutes']*60}")
    
    # Implementation recommendations
    if gpus > 1:
        print("\nImplementation: Use parallel_transcript.py with GPU type configuration:")
        print(f"  @app.function(gpu=\"{gpu_type}\", timeout={estimate['timeout_minutes']*60}, max_containers={gpus})")
    else:
        print("\nImplementation: Use quick_audio_transcript.py with GPU type configuration:")
        print(f"  @app.function(gpu=\"{gpu_type}\", timeout={estimate['timeout_minutes']*60})")
    
    print("=========================================")


def main():
    parser = argparse.ArgumentParser(description="Estimate Modal processing time for audio files")
    parser.add_argument("file_path", help="Path to the audio file")
    parser.add_argument("--model", choices=["tiny", "base", "small", "medium", "large"], 
                        default="small", help="Whisper model size (default: small)")
    parser.add_argument("--gpus", type=int, choices=[1, 2, 3], 
                        default=1, help="Number of GPUs for parallel processing (default: 1)")
    parser.add_argument("--gpu-type", choices=["T4", "A10G", "A100"], 
                        default="T4", help="GPU type/performance (default: T4)")
    args = parser.parse_args()
    
    # Validate file path
    if not os.path.exists(args.file_path):
        print(f"Error: File '{args.file_path}' not found")
        sys.exit(1)
    
    # Check file extension
    if not args.file_path.lower().endswith(('.mp3', '.mp4', '.m4a', '.wav')):
        print(f"Warning: File '{args.file_path}' may not be a supported audio format")
    
    # Get audio information
    audio_info = get_audio_info(args.file_path)
    
    # Estimate processing time
    estimate = estimate_processing_time(audio_info, args.model, args.gpus, args.gpu_type)
    
    # Print estimate
    print_estimate(args.file_path, estimate, audio_info)
    
    return 0


if __name__ == "__main__":
    sys.exit(main())