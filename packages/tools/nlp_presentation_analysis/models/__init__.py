"""Data models for presentation analysis."""

from dataclasses import dataclass
from typing import List, Dict, Any, Optional
from datetime import datetime

@dataclass
class Presentation:
    """Presentation data model."""
    id: str
    title: str
    summary: Optional[str] = None
    transcript_text: Optional[str] = None
    created_at: Optional[datetime] = None
    metadata: Optional[Dict[str, Any]] = None
    
    def __post_init__(self):
        """Convert string dates to datetime."""
        if isinstance(self.created_at, str):
            self.created_at = datetime.fromisoformat(self.created_at.replace('Z', '+00:00'))
            
    def get_full_text(self) -> str:
        """Get combined text for analysis."""
        parts = []
        
        if self.title:
            parts.append(f"Title: {self.title}")
            
        if self.summary:
            parts.append(f"Summary: {self.summary}")
            
        if self.transcript_text:
            parts.append(f"Transcript: {self.transcript_text}")
            
        return "\n\n".join(parts)
    
    def get_analysis_text(self) -> str:
        """Get text optimized for analysis."""
        # Prioritize summary and transcript
        if self.summary and self.transcript_text:
            return f"{self.summary}\n\n{self.transcript_text[:5000]}"  # Limit transcript length
        elif self.transcript_text:
            return self.transcript_text[:8000]
        elif self.summary:
            return self.summary
        else:
            return self.title


@dataclass
class AnalysisResult:
    """Container for analysis results."""
    presentation_id: str
    entities: Optional[Dict[str, Any]] = None
    keywords: Optional[Dict[str, Any]] = None
    embeddings: Optional[List[float]] = None
    metadata: Optional[Dict[str, Any]] = None
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            'presentation_id': self.presentation_id,
            'entities': self.entities,
            'keywords': self.keywords,
            'embeddings': self.embeddings,
            'metadata': self.metadata
        }


@dataclass
class Entity:
    """Entity data model."""
    text: str
    type: str
    start: int
    end: int
    confidence: float = 1.0
    metadata: Optional[Dict[str, Any]] = None


@dataclass
class Keyword:
    """Keyword data model."""
    text: str
    score: float
    method: str
    metadata: Optional[Dict[str, Any]] = None


@dataclass
class TopicCluster:
    """Topic cluster data model."""
    id: str
    name: str
    keywords: List[str]
    presentation_ids: List[str]
    centroid_embedding: Optional[List[float]] = None
    metadata: Optional[Dict[str, Any]] = None
