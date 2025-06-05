"""Base dimension class for all tagging dimensions."""

from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional, Union
from pydantic import BaseModel, Field, validator
import json


class DimensionValue(BaseModel):
    """Base model for dimension values."""
    value: Any
    confidence: float = Field(ge=0.0, le=1.0, default=1.0)
    source: str = Field(default="manual")  # manual, nlp, rule, ml
    metadata: Dict[str, Any] = Field(default_factory=dict)


class DimensionDefinition(BaseModel):
    """Definition of a tagging dimension."""
    name: str
    description: str
    type: str  # categorical, numeric, hierarchical, scale, boolean
    required: bool = True
    multiple: bool = False  # Can have multiple values
    options: Optional[List[Any]] = None
    range: Optional[Dict[str, Any]] = None
    validation_rules: Dict[str, Any] = Field(default_factory=dict)


class BaseDimension(ABC):
    """Abstract base class for tagging dimensions."""
    
    def __init__(self):
        self.definition = self.get_definition()
        
    @abstractmethod
    def get_definition(self) -> DimensionDefinition:
        """Return the dimension definition."""
        pass
    
    @abstractmethod
    def validate_value(self, value: Any) -> bool:
        """Validate a value for this dimension."""
        pass
    
    @abstractmethod
    def suggest_value(self, text: str, context: Dict[str, Any]) -> List[DimensionValue]:
        """Suggest values based on text analysis."""
        pass
    
    def normalize_value(self, value: Any) -> Any:
        """Normalize a value to standard format."""
        return value
    
    def get_display_value(self, value: Any) -> str:
        """Get human-readable display value."""
        return str(value)
    
    def get_search_terms(self, value: Any) -> List[str]:
        """Get search terms associated with a value."""
        return [str(value).lower()]
    
    def calculate_similarity(self, value1: Any, value2: Any) -> float:
        """Calculate similarity between two values (0-1)."""
        return 1.0 if value1 == value2 else 0.0
    
    def to_json(self, value: DimensionValue) -> str:
        """Convert dimension value to JSON."""
        return json.dumps(value.dict())
    
    def from_json(self, json_str: str) -> DimensionValue:
        """Create dimension value from JSON."""
        return DimensionValue(**json.loads(json_str))
    
    def get_statistics(self, values: List[Any]) -> Dict[str, Any]:
        """Calculate statistics for a list of values."""
        return {
            "count": len(values),
            "unique": len(set(values))
        }
