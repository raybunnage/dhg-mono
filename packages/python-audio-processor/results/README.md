# Modal Audio Processing with A10G GPUs

This directory contains the results from processing audio files with Modal cloud computing using A10G GPUs and the Whisper medium model.

## Processing Configuration

The A10G-powered audio processing uses the following configuration:

- **GPU Type**: NVIDIA A10G (2.5x faster than T4)
- **Parallel GPUs**: 3 (for maximum throughput)
- **Whisper Model**: Medium (better accuracy than tiny/base models)
- **Modal Version**: 0.73.121 (specifically to avoid defects in 0.73.128)
- **Processing Method**: Parallel audio segment processing

## Output Files

For each processed audio file, the following outputs are generated:

- `{filename}_medium_parallel.txt`: The full transcript text
- `{filename}_medium_parallel.json`: Complete results with metadata, including:
  - Processing times per segment
  - GPU information
  - Performance metrics
  - All transcript segments with timestamps

## Performance Expectations

For a 10-minute audio file, you can expect:

- **Processing Time**: ~4 minutes (including overhead)
- **Speed**: ~15-20x realtime processing
- **Cost**: ~$0.24 for the entire file

## Running the Processing

To process audio files:

```bash
# From the repository root
cd packages/python-audio-processor/scripts

# Process the 10-minute audio file with default settings
./run_text_extraction.sh

# Check Modal connection only
./run_text_extraction.sh --check

# Enable verbose output
./run_text_extraction.sh --verbose

# Specify custom output path
./run_text_extraction.sh --output=/path/to/output.txt
```

## Troubleshooting

If you encounter issues:

1. **Modal Version**: Ensure you're using exactly version 0.73.121:
   ```bash
   pip install modal==0.73.121
   ```

2. **Connection Issues**: Refresh your Modal token:
   ```bash
   modal token new
   ```

3. **GPUs Unavailable**: Check Modal dashboard for GPU availability