"""Application context dimension - where/how knowledge is applied."""

from typing import Any, Dict, List
from .base_dimension import BaseDimension, DimensionDefinition, DimensionValue


class ApplicationContextDimension(BaseDimension):
    """Where and how the knowledge is applied."""
    
    CONTEXTS = {
        "clinical-practice": {
            "name": "Clinical Practice",
            "description": "Direct patient care and treatment",
            "keywords": ["patient", "treatment", "clinical", "therapy", "diagnosis", 
                        "management", "care", "practice", "intervention", "protocol"]
        },
        "research": {
            "name": "Research",
            "description": "Scientific investigation and discovery",
            "keywords": ["research", "study", "investigation", "experiment", "analysis",
                        "methodology", "data", "findings", "hypothesis", "evidence"]
        },
        "education": {
            "name": "Education",
            "description": "Teaching and training",
            "keywords": ["education", "teaching", "training", "learning", "curriculum",
                        "student", "course", "tutorial", "workshop", "seminar"]
        },
        "laboratory": {
            "name": "Laboratory",
            "description": "Lab techniques and procedures",
            "keywords": ["laboratory", "lab", "assay", "technique", "procedure",
                        "sample", "test", "measurement", "analysis", "protocol"]
        },
        "public-health": {
            "name": "Public Health",
            "description": "Population health and policy",
            "keywords": ["public health", "population", "epidemiology", "prevention",
                        "screening", "policy", "community", "outbreak", "surveillance"]
        },
        "industry": {
            "name": "Industry/Commercial",
            "description": "Commercial applications and development",
            "keywords": ["industry", "commercial", "product", "development", "manufacturing",
                        "regulatory", "FDA", "approval", "market", "business"]
        }
    }
    
    def get_definition(self) -> DimensionDefinition:
        return DimensionDefinition(
            name="application_context",
            description="Where and how the knowledge is applied",
            type="categorical",
            required=True,
            multiple=True,
            options=list(self.CONTEXTS.keys()),
            validation_rules={
                "min_selections": 1,
                "max_selections": 3
            }
        )
    
    def validate_value(self, value: Any) -> bool:
        """Validate application context value."""
        if isinstance(value, str):
            return value in self.CONTEXTS
        elif isinstance(value, list):
            return all(v in self.CONTEXTS for v in value)
        return False
    
    def suggest_value(self, text: str, context: Dict[str, Any]) -> List[DimensionValue]:
        """Suggest application contexts based on text analysis."""
        text_lower = text.lower()
        suggestions = []
        context_scores = {}
        
        # Score each context based on keyword matches
        for context_id, context_info in self.CONTEXTS.items():
            score = 0
            matched_keywords = []
            
            for keyword in context_info["keywords"]:
                if keyword in text_lower:
                    # Weight multi-word keywords higher
                    weight = len(keyword.split()) * 1.5
                    score += weight
                    matched_keywords.append(keyword)
                    
            if score > 0:
                context_scores[context_id] = {
                    "score": score,
                    "keywords": matched_keywords
                }
        
        # Additional pattern matching for specific contexts
        if "patient" in text_lower or "treatment" in text_lower:
            if "clinical-practice" in context_scores:
                context_scores["clinical-practice"]["score"] *= 1.5
        
        if "study" in text_lower or "research" in text_lower:
            if "research" in context_scores:
                context_scores["research"]["score"] *= 1.5
                
        # Sort by score
        sorted_contexts = sorted(
            context_scores.items(), 
            key=lambda x: x[1]["score"], 
            reverse=True
        )
        
        # Create suggestions for top contexts
        for context_id, score_info in sorted_contexts[:3]:
            # Calculate confidence
            max_score = sorted_contexts[0][1]["score"] if sorted_contexts else 1
            confidence = min(score_info["score"] / max_score * 0.8, 0.9)
            
            suggestions.append(DimensionValue(
                value=context_id,
                confidence=confidence,
                source="nlp",
                metadata={
                    "name": self.CONTEXTS[context_id]["name"],
                    "score": score_info["score"],
                    "matched_keywords": score_info["keywords"]
                }
            ))
        
        # If no strong matches, suggest based on presentation type
        if not suggestions and context:
            if context.get("presenter_title"):
                title_lower = context["presenter_title"].lower()
                if "md" in title_lower or "physician" in title_lower:
                    suggestions.append(DimensionValue(
                        value="clinical-practice",
                        confidence=0.5,
                        source="rule",
                        metadata={"reason": "presenter_credentials"}
                    ))
                elif "phd" in title_lower or "researcher" in title_lower:
                    suggestions.append(DimensionValue(
                        value="research",
                        confidence=0.5,
                        source="rule",
                        metadata={"reason": "presenter_credentials"}
                    ))
        
        return suggestions
    
    def get_display_value(self, value: Any) -> str:
        """Get human-readable display value."""
        if isinstance(value, str):
            return self.CONTEXTS.get(value, {}).get("name", value)
        elif isinstance(value, list):
            names = [self.CONTEXTS.get(v, {}).get("name", v) for v in value]
            return ", ".join(names)
        return str(value)
    
    def get_context_info(self, context_id: str) -> Dict[str, Any]:
        """Get detailed information about a context."""
        return self.CONTEXTS.get(context_id, {})
    
    def calculate_similarity(self, value1: Any, value2: Any) -> float:
        """Calculate similarity between contexts."""
        # Convert to sets for comparison
        set1 = {value1} if isinstance(value1, str) else set(value1)
        set2 = {value2} if isinstance(value2, str) else set(value2)
        
        # Jaccard similarity
        intersection = set1 & set2
        union = set1 | set2
        
        return len(intersection) / len(union) if union else 0.0
