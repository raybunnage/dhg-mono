# Modal Audio Processing Integration Guide

This document provides a comprehensive guide for integrating Modal cloud computing with our audio processing workflow. It covers the setup, connection, and execution of audio transcription and analysis tasks using Modal's GPU resources.

## Overview

Modal provides cloud-based GPU resources that can be used to accelerate audio processing tasks. This guide documents how we successfully integrated Modal with our audio processing pipeline to:

1. Connect to Modal's cloud infrastructure
2. Upload audio files for processing
3. Execute GPU-accelerated tasks (transcription and analysis)
4. Retrieve results and handle errors gracefully

## Reference Implementation

We have two successful reference implementations:

1. **Quick Audio Transcript**: Simple transcription using the tiny Whisper model
   - Script: `packages/python-audio-processor/scripts/quick_audio_transcript.py`

2. **Parallel Audio Processing**: Advanced implementation using multiple T4 GPUs and medium Whisper model
   - Script: `packages/python-audio-processor/scripts/parallel_transcript.py`

## Connection and Authentication

### Modal Connection Requirements

To successfully connect to Modal:

1. **Modal Package**: Ensure Modal package (v0.73+) is installed
   ```bash
   pip install modal==0.73.128  # Or latest version
   ```

2. **Authentication Token**: Each user needs to create and configure a Modal token
   ```bash
   modal token new
   ```
   This opens a browser window to complete authentication.

3. **Connection Testing**: Before processing, verify Modal connection
   ```python
   import modal
   
   def check_modal_connection():
       """Verify that we can connect to Modal"""
       try:
           with modal.App().run():
               print("Successfully connected to Modal!")
               return True
       except Exception as e:
           print(f"Could not connect to Modal: {str(e)}")
           return False
   ```

## Audio Processing Workflow

The successful integration follows this pattern:

### 1. Application Definition

```python
# Create a Modal app
app = modal.App("audio-processor")

# Define container image with required dependencies
image = (
    modal.Image.debian_slim()
    .apt_install(["ffmpeg"])
    .pip_install("numpy", "torch", "torchaudio", "openai-whisper")
)

# Define the processing function with GPU requirements
@app.function(gpu="T4", timeout=60, image=image)
def process_audio(audio_data: bytes) -> dict:
    # Function implementation
    pass
```

### 2. Uploading Audio Data

The key insight is to send the audio data as bytes rather than a file path:

```python
# Read the audio file as bytes
with open(audio_path, 'rb') as f:
    audio_data = f.read()

# Send data to Modal
with app.run():
    result = process_audio.remote(audio_data=audio_data)
```

### 3. Processing in Modal Container

Within the Modal container:

```python
# Save data to a temporary file
with tempfile.NamedTemporaryFile(suffix=".m4a", delete=False) as temp_file:
    temp_file.write(audio_data)
    temp_path = temp_file.name

try:
    # Process the file
    # ...
finally:
    # Clean up temporary file
    if os.path.exists(temp_path):
        os.unlink(temp_path)
```

### 4. Error Handling

Robust error handling is essential:

```python
try:
    with app.run():
        result = process_audio.remote(audio_data=audio_data)
except KeyboardInterrupt:
    print("Process interrupted by user. Exiting...")
    sys.exit(1)
except Exception as e:
    logger.exception("Error during Modal execution")
    print(f"Error connecting to Modal: {str(e)}")
    print("Try running 'modal token new' to refresh your token")
    sys.exit(1)
```

## Performance Optimization

### Parallel Processing

For larger files, we can use parallel processing with multiple GPUs:

```python
@app.function(
    gpu="T4", 
    timeout=120,
    image=image,
    max_containers=3  # Allows up to 3 parallel containers
)
def process_segment(audio_data: bytes, segment_id: int) -> dict:
    # Process the segment
    pass

# Launch multiple segments in parallel
futures = []
for segment_data, segment_id in segments:
    future = process_segment.remote(audio_data=segment_data, segment_id=segment_id)
    futures.append((segment_id, future))

# Collect results
results = []
for segment_id, future in futures:
    result = future
    results.append(result)
```

### Volume Caching

For models that need to be downloaded, use Modal volumes to cache them:

```python
# Create a volume to cache model weights
volume = modal.Volume.from_name("whisper-models-vol", create_if_missing=True)

@app.function(
    gpu="T4", 
    image=image,
    volumes={"/root/.cache/whisper": volume}
)
def process_with_cached_model(audio_data: bytes) -> dict:
    # The model will be downloaded once and cached for future runs
    pass
```

## Troubleshooting

### Common Issues and Solutions

1. **Connection Errors**:
   - **Solution**: Refresh token with `modal token new`

2. **Function Not Found**:
   - **Error**: `'App' object has no attribute 'function_name'`
   - **Solution**: Ensure function is defined and decorated with `@app.function`

3. **Timeout Issues**:
   - **Error**: `Input aborted - reached maximum of 8 internal reschedules`
   - **Solution**: 
     - Reduce model size (e.g., use "tiny" instead of "medium")
     - Increase timeout parameter in function decorator
     - Split processing into smaller chunks

4. **GPU Availability**:
   - If GPUs are not available, the task will queue until one becomes available
   - You can check GPU availability in the Modal dashboard

## Shell Script Integration

The `run_text_extraction.sh` script demonstrates how to integrate Modal with shell scripts:

```bash
#!/bin/bash
# Ensure we use the correct Python with Modal installed
which_python=$(which python)

# Check Modal connection first
$which_python path/to/script.py --check

# Process the audio file if connection is successful
$which_python path/to/script.py $VERBOSE $OUTPUT_PATH "$AUDIO_FILE"

# Handle exit codes
if [ $? -eq 0 ]; then
    echo "Processing completed successfully!"
else
    echo "Processing failed. See error messages above."
    # Provide helpful suggestions
    echo "Try running 'modal token new' to refresh your token"
fi
```

## Best Practices

1. **Always Check Connection**: Verify Modal connection before starting processing
2. **Use Bytes for Data Transfer**: Send file data as bytes rather than paths
3. **Handle Temporary Files**: Always clean up temporary files in finally blocks
4. **Set Appropriate Timeouts**: Match function timeout to expected processing time
5. **Provide Detailed Logs**: Log GPU info, processing times, and other metrics
6. **Use Volumes for Caching**: Cache models and other large files in Modal volumes
7. **Handle Errors Gracefully**: Provide clear error messages and recovery steps
8. **Control Costs**: Use timeout limits to prevent runaway costs

## Example: Minimal Working Example

Here's a minimal example that demonstrates the core working pattern:

```python
import modal

app = modal.App("simple-audio")
image = modal.Image.debian_slim().apt_install(["ffmpeg"]).pip_install("numpy", "torch", "torchaudio")

@app.function(gpu="T4", timeout=60, image=image)
def process_audio(audio_data: bytes) -> str:
    import tempfile, torch
    
    # Save to temp file
    with tempfile.NamedTemporaryFile(suffix=".m4a", delete=False) as temp_file:
        temp_file.write(audio_data)
        temp_path = temp_file.name
    
    try:
        # Process file here
        return f"Processed audio: {len(audio_data)} bytes on {torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'CPU'}"
    finally:
        import os
        if os.path.exists(temp_path):
            os.unlink(temp_path)

# Use the function
with open("audio.m4a", "rb") as f:
    audio_data = f.read()

with app.run():
    result = process_audio.remote(audio_data=audio_data)
print(result)
```

## Conclusion

By following these patterns, you can reliably connect to Modal, process audio files using GPU acceleration, and handle results and errors appropriately. The key insights are to properly initialize the Modal app, send data as bytes, process with GPU acceleration, and handle errors gracefully.

For future Modal integrations, start from these reference implementations and adapt them to your specific needs.