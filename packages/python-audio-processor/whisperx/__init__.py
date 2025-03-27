"""
WhisperX: Enhanced audio processing with Modal and Whisper.
"""

from .transcribe import transcribe, transcribe_remote
from .summarize import summarize, summarize_remote
from .utils import setup_modal

__version__ = "0.1.0"
__all__ = [
    "transcribe", 
    "transcribe_remote", 
    "summarize", 
    "summarize_remote", 
    "setup_modal"
]