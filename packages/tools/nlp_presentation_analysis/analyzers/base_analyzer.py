"""Base analyzer class for all NLP analyzers."""

from abc import ABC, abstractmethod
from typing import Dict, Any, Optional
import logging

class BaseAnalyzer(ABC):
    """Abstract base class for all analyzers."""
    
    def __init__(self, model_name: Optional[str] = None):
        """Initialize the analyzer.
        
        Args:
            model_name: Name of the model to use (if applicable)
        """
        self.model_name = model_name
        self.logger = logging.getLogger(self.__class__.__name__)
        self._setup()
    
    def _setup(self):
        """Setup method for subclasses to override."""
        pass
    
    @abstractmethod
    def analyze(self, text: str) -> Dict[str, Any]:
        """Analyze the given text.
        
        Args:
            text: Text to analyze
            
        Returns:
            Dictionary containing analysis results
        """
        pass
    
    def preprocess(self, text: str) -> str:
        """Preprocess text before analysis.
        
        Args:
            text: Raw text
            
        Returns:
            Preprocessed text
        """
        # Basic preprocessing - can be overridden by subclasses
        text = text.strip()
        # Replace multiple whitespaces with single space
        text = ' '.join(text.split())
        return text
    
    def validate_input(self, text: str) -> bool:
        """Validate input text.
        
        Args:
            text: Text to validate
            
        Returns:
            True if valid, False otherwise
        """
        if not text or not isinstance(text, str):
            self.logger.error("Invalid input: text must be a non-empty string")
            return False
        
        if len(text.strip()) < 10:
            self.logger.warning("Text too short for meaningful analysis")
            return False
            
        return True
