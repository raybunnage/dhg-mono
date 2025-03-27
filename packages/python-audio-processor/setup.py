from setuptools import setup, find_packages

setup(
    name="whisperx",
    version="0.1.0",
    packages=find_packages(),
    install_requires=[
        "modal>=0.55.4277",
        "faster-whisper>=0.10.0",
        "tqdm>=4.65.0",
        "torch>=2.0.0",
        "numpy>=1.20.0",
    ],
    entry_points={
        "console_scripts": [
            "whisperx-summary=whisperx.cli:summary_cmd",
            "whisperx-transcribe=whisperx.cli:transcribe_cmd",
        ],
    },
    python_requires=">=3.8",
)