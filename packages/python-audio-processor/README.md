# WhisperX Audio Processing

A shared Python library for audio processing using Modal and OpenAI's Whisper.

## Features

- Lightweight audio summarization
- Full audio transcription with timestamps
- Quick audio analysis for testing Modal integration
- GPU acceleration via Modal cloud
- CLI tools for easy usage
- Processing time estimation to avoid timeout costs

## Installation

```bash
# From the repository root
cd packages/python-audio-processor
pip install -e .

# Install requirements directly if needed
pip install -r requirements.txt
```

## Quick Start - Modal Round Trip Test

To quickly test Modal integration with a 1-minute audio file:

```bash
# Run the test script directly
./scripts/test_modal_roundtrip.py /path/to/file_types/m4a/INGESTED_2024_04_17_Navaux_1m.m4a

# Or use the convenience script
./scripts/run_modal_test.sh
```

This will:
1. Upload the audio file to Modal
2. Process it with a T4 GPU
3. Return basic audio analysis data
4. Complete within 60 seconds to minimize costs

The results will be saved in the `results` directory.

## Standard Usage

### Get a quick summary of an audio file

```bash
whisperx-summary /path/to/audio.m4a
# Or use the script directly
./scripts/process_m4a_summary.py /path/to/audio.m4a
```

### Get a complete transcript with timestamps

```bash
whisperx-transcribe /path/to/audio.m4a
# Or use the script directly
./scripts/process_m4a_transcript.py /path/to/audio.m4a
```

### Use as a Python library

```python
from whisperx import transcribe, summarize

# Get a summary
summary = summarize("path/to/audio.m4a")
print(summary)

# Get a complete transcript
transcript = transcribe("path/to/audio.m4a")
print(transcript["text"])
```

## Configuration

By default, Modal is used for remote processing. You'll need to:

1. Install Modal: `pip install modal`
2. Configure Modal: `modal token new`

This will give you credentials for using Modal's cloud processing.

## Estimating Processing Time

To avoid timeouts and prevent unnecessary costs, you can use the estimator script:

```bash
# Basic usage
./scripts/estimate_modal_time.sh /path/to/audio.m4a

# Specify a different model size
./scripts/estimate_modal_time.sh /path/to/audio.m4a --model medium

# Estimate for parallel processing with multiple GPUs
./scripts/estimate_modal_time.sh /path/to/audio.m4a --model medium --gpus 3

# Compare performance across different GPU types
./scripts/estimate_modal_time.sh /path/to/audio.m4a --model medium --gpus 3 --gpu-type A10G
```

This will analyze your audio file and recommend appropriate timeout settings based on:

- Audio duration and quality
- File size and complexity
- Selected Whisper model (tiny, base, small, medium, large)
- Parallel processing capabilities (1-3 GPUs)
- GPU type performance and cost tradeoffs (T4, A10G, A100)

The tool provides comprehensive cost-performance analysis including:
- Processing time estimates for different configurations
- Cost calculations based on GPU type and processing time
- Recommendations for the most cost-efficient setup
- Code snippets showing the recommended Modal configuration

## Technical Details

### GPU Options and Cost/Performance

Modal offers various GPU types with different performance characteristics:

| GPU Type | Performance | Cost/Hour | Best For |
|----------|-------------|-----------|----------|
| T4       | 1.0x (base) | $0.60     | Cost-efficiency, smaller files |
| A10G     | ~2.5x faster| $1.20     | Balance of speed/cost, medium files |
| A100     | ~5x faster  | $3.50     | Fastest processing, very large files |

For typical audio files:
- T4 is the most cost-efficient option for most use cases
- A10G provides a good balance for medium and large models
- A100 is best when speed is critical and cost is secondary

### Models and Timeouts

- Models: "tiny", "base", "small", "medium", "large" (increasing accuracy but slower)
- Timeout: Use the estimator tool to determine appropriate timeouts based on your configuration
- Parallel Processing: Up to 3 GPUs recommended for files longer than 5 minutes