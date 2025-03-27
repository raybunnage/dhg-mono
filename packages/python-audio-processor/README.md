# WhisperX Audio Processing

A shared Python library for audio processing using Modal and OpenAI's Whisper.

## Features

- Lightweight audio summarization
- Full audio transcription with timestamps
- Quick audio analysis for testing Modal integration
- GPU acceleration via Modal cloud
- CLI tools for easy usage

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

## Technical Details

- GPU Type: T4 (cost-effective at $0.80/hour)
- Timeout: 60 seconds for the test script, 120 seconds for summarization
- Models: Uses the "small" Whisper model by default, can be changed