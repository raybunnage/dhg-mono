"""Text preprocessing utilities."""

import re
import unicodedata
from typing import List, Optional
import logging

logger = logging.getLogger(__name__)

def clean_text(text: str) -> str:
    """Clean text for NLP processing.
    
    Args:
        text: Raw text
        
    Returns:
        Cleaned text
    """
    if not text:
        return ""
        
    # Normalize unicode characters
    text = unicodedata.normalize('NFKD', text)
    
    # Remove control characters
    text = ''.join(char for char in text if unicodedata.category(char)[0] != 'C')
    
    # Replace multiple newlines with double newline
    text = re.sub(r'\n\s*\n', '\n\n', text)
    
    # Replace multiple spaces with single space
    text = re.sub(r'\s+', ' ', text)
    
    # Remove leading/trailing whitespace
    text = text.strip()
    
    return text


def remove_urls(text: str) -> str:
    """Remove URLs from text.
    
    Args:
        text: Text containing URLs
        
    Returns:
        Text without URLs
    """
    url_pattern = re.compile(
        r'http[s]?://(?:[a-zA-Z]|[0-9]|[$-_@.&+]|[!*\\(\\),]|(?:%[0-9a-fA-F][0-9a-fA-F]))+'
    )
    return url_pattern.sub('', text)


def remove_emails(text: str) -> str:
    """Remove email addresses from text.
    
    Args:
        text: Text containing emails
        
    Returns:
        Text without emails
    """
    email_pattern = re.compile(r'\S+@\S+')
    return email_pattern.sub('', text)


def extract_sentences(text: str, min_length: int = 10) -> List[str]:
    """Extract sentences from text.
    
    Args:
        text: Input text
        min_length: Minimum sentence length
        
    Returns:
        List of sentences
    """
    # Simple sentence splitter
    sentences = re.split(r'[.!?]+', text)
    
    # Clean and filter sentences
    cleaned_sentences = []
    for sent in sentences:
        sent = sent.strip()
        if len(sent) >= min_length:
            cleaned_sentences.append(sent)
            
    return cleaned_sentences


def chunk_text(text: str, chunk_size: int = 1000, overlap: int = 200) -> List[str]:
    """Split text into overlapping chunks.
    
    Args:
        text: Text to chunk
        chunk_size: Size of each chunk in characters
        overlap: Overlap between chunks
        
    Returns:
        List of text chunks
    """
    if not text:
        return []
        
    chunks = []
    start = 0
    text_length = len(text)
    
    while start < text_length:
        end = min(start + chunk_size, text_length)
        
        # Try to break at sentence boundary
        if end < text_length:
            # Look for sentence end markers
            for marker in ['. ', '! ', '? ', '\n\n']:
                last_marker = text[start:end].rfind(marker)
                if last_marker > chunk_size * 0.8:  # In last 20% of chunk
                    end = start + last_marker + len(marker)
                    break
                    
        chunk = text[start:end].strip()
        if chunk:
            chunks.append(chunk)
            
        # Move start position
        start = max(start + 1, end - overlap)
        
    return chunks


def extract_medical_abbreviations(text: str) -> List[str]:
    """Extract potential medical abbreviations.
    
    Args:
        text: Input text
        
    Returns:
        List of abbreviations
    """
    # Pattern for uppercase abbreviations (2-6 letters)
    abbrev_pattern = re.compile(r'\b[A-Z]{2,6}\b')
    
    abbreviations = abbrev_pattern.findall(text)
    
    # Filter common words
    common_words = {'THE', 'AND', 'FOR', 'ARE', 'NOT', 'YOU', 'ALL', 'USE', 'HER', 'HIS'}
    abbreviations = [abbr for abbr in abbreviations if abbr not in common_words]
    
    # Return unique abbreviations
    return list(set(abbreviations))


def normalize_medical_terms(text: str) -> str:
    """Normalize common medical term variations.
    
    Args:
        text: Input text
        
    Returns:
        Text with normalized medical terms
    """
    # Common medical term variations
    replacements = {
        r'\bvit\.?\s*d\b': 'vitamin D',
        r'\bvit\.?\s*b12\b': 'vitamin B12',
        r'\bvit\.?\s*c\b': 'vitamin C',
        r'\bmg\b': 'milligrams',
        r'\bml\b': 'milliliters',
        r'\bdr\.?\b': 'doctor',
        r'\bmeds?\b': 'medications',
        r'\bpt\b': 'patient',
        r'\bhx\b': 'history',
        r'\bdx\b': 'diagnosis',
        r'\btx\b': 'treatment',
        r'\brx\b': 'prescription'
    }
    
    normalized_text = text
    for pattern, replacement in replacements.items():
        normalized_text = re.sub(pattern, replacement, normalized_text, flags=re.IGNORECASE)
        
    return normalized_text


def extract_dosages(text: str) -> List[str]:
    """Extract medication dosages from text.
    
    Args:
        text: Input text
        
    Returns:
        List of dosage expressions
    """
    # Pattern for dosages (e.g., "50mg", "10 mg", "2.5 ml")
    dosage_pattern = re.compile(
        r'\b\d+\.?\d*\s*(?:mg|mcg|g|ml|l|iu|units?)\b',
        re.IGNORECASE
    )
    
    dosages = dosage_pattern.findall(text)
    return list(set(dosages))


def remove_speaker_labels(text: str) -> str:
    """Remove speaker labels from transcript.
    
    Args:
        text: Transcript text with speaker labels
        
    Returns:
        Text without speaker labels
    """
    # Remove patterns like "Speaker 1:", "Dr. Smith:", "[Speaker]:"
    speaker_pattern = re.compile(r'^[\[\(]?[A-Za-z\s\.\,]+[\]\)]?\s*:\s*', re.MULTILINE)
    return speaker_pattern.sub('', text)


def extract_timestamps(text: str) -> List[str]:
    """Extract timestamps from text.
    
    Args:
        text: Text with timestamps
        
    Returns:
        List of timestamps
    """
    # Pattern for timestamps like "00:15", "1:23:45", "[00:15]"
    timestamp_pattern = re.compile(
        r'[\[\(]?\d{1,2}:\d{2}(?::\d{2})?[\]\)]?'
    )
    
    timestamps = timestamp_pattern.findall(text)
    return timestamps


def prepare_for_embedding(text: str, max_length: int = 512) -> str:
    """Prepare text for embedding generation.
    
    Args:
        text: Input text
        max_length: Maximum text length
        
    Returns:
        Prepared text
    """
    # Clean the text
    text = clean_text(text)
    text = remove_urls(text)
    text = remove_emails(text)
    
    # Truncate if too long
    if len(text) > max_length:
        # Try to truncate at sentence boundary
        truncated = text[:max_length]
        last_period = truncated.rfind('.')
        if last_period > max_length * 0.8:
            text = truncated[:last_period + 1]
        else:
            text = truncated + '...'
            
    return text
