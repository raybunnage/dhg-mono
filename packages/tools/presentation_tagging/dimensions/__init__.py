"""All dimension implementations."""

from .base_dimension import BaseDimension, DimensionDefinition, DimensionValue
from .topic_dimension import TopicDimension
from .complexity_dimension import ComplexityDimension
from .application_context_dimension import ApplicationContextDimension
from .approach_type_dimension import ApproachTypeDimension
from .evidence_level_dimension import EvidenceLevelDimension
from .patient_population_dimension import PatientPopulationDimension
from .temporal_relevance_dimension import TemporalRelevanceDimension
from .learning_modality_dimension import LearningModalityDimension

# Registry of all dimensions
DIMENSION_REGISTRY = {
    "topics": TopicDimension,
    "complexity": ComplexityDimension,
    "application_context": ApplicationContextDimension,
    "approach_type": ApproachTypeDimension,
    "evidence_level": EvidenceLevelDimension,
    "patient_population": PatientPopulationDimension,
    "temporal_relevance": TemporalRelevanceDimension,
    "learning_modality": LearningModalityDimension
}

def get_dimension(name: str) -> BaseDimension:
    """Get dimension instance by name."""
    dimension_class = DIMENSION_REGISTRY.get(name)
    if not dimension_class:
        raise ValueError(f"Unknown dimension: {name}")
    return dimension_class()

def get_all_dimensions() -> dict:
    """Get all dimension instances."""
    return {name: cls() for name, cls in DIMENSION_REGISTRY.items()}

__all__ = [
    "BaseDimension",
    "DimensionDefinition", 
    "DimensionValue",
    "TopicDimension",
    "ComplexityDimension",
    "ApplicationContextDimension",
    "ApproachTypeDimension",
    "EvidenceLevelDimension",
    "PatientPopulationDimension",
    "TemporalRelevanceDimension",
    "LearningModalityDimension",
    "DIMENSION_REGISTRY",
    "get_dimension",
    "get_all_dimensions"
]
