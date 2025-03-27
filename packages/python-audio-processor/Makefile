.PHONY: install setup test summary transcribe clean

install:
	# Install the package in development mode
	pip install -e .

setup:
	# Set up Modal for first use
	python -m whisperx.cli setup-modal

summary:
	# Check if AUDIO_PATH is provided
	@if [ -z "$(AUDIO_PATH)" ]; then \
		echo "Error: AUDIO_PATH is required. Usage: make summary AUDIO_PATH=/path/to/audio.m4a"; \
		exit 1; \
	fi
	# Generate a summary of the audio file
	python scripts/process_m4a_summary.py "$(AUDIO_PATH)"

transcribe:
	# Check if AUDIO_PATH is provided
	@if [ -z "$(AUDIO_PATH)" ]; then \
		echo "Error: AUDIO_PATH is required. Usage: make transcribe AUDIO_PATH=/path/to/audio.m4a"; \
		exit 1; \
	fi
	# Generate a full transcript of the audio file
	python scripts/process_m4a_transcript.py "$(AUDIO_PATH)"

install-uv:
	# Install the package with uv
	uv pip install -e .

clean:
	# Clean up generated files
	rm -rf *.egg-info
	rm -rf dist
	rm -rf build
	rm -rf .models
	rm -rf __pycache__
	rm -rf whisperx/__pycache__