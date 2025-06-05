"""Approach type dimension - theoretical vs practical focus."""

from typing import Any, Dict, List
from .base_dimension import BaseDimension, DimensionDefinition, DimensionValue


class ApproachTypeDimension(BaseDimension):
    """Balance between theoretical and practical content."""
    
    APPROACH_SPECTRUM = {
        "theoretical": {
            "value": 1,
            "name": "Highly Theoretical",
            "keywords": ["theory", "concept", "hypothesis", "mechanism", "principle",
                        "model", "framework", "fundamental", "abstract", "philosophical"]
        },
        "theory-leaning": {
            "value": 2,
            "name": "Theory-Leaning",
            "keywords": ["understanding", "explanation", "background", "foundation",
                        "rationale", "evidence", "research-based"]
        },
        "balanced": {
            "value": 3,
            "name": "Balanced",
            "keywords": ["application", "implementation", "practical considerations",
                        "case examples", "both theory and practice"]
        },
        "practice-leaning": {
            "value": 4,
            "name": "Practice-Leaning",
            "keywords": ["clinical", "hands-on", "practical tips", "how-to",
                        "guidelines", "protocols", "procedures"]
        },
        "practical": {
            "value": 5,
            "name": "Highly Practical",
            "keywords": ["step-by-step", "tutorial", "demonstration", "workshop",
                        "skills", "techniques", "tools", "immediate application"]
        }
    }
    
    def get_definition(self) -> DimensionDefinition:
        return DimensionDefinition(
            name="approach_type",
            description="Balance between theoretical and practical focus",
            type="scale",
            required=True,
            multiple=False,
            range={
                "min": 1,
                "max": 5,
                "labels": {k: v["name"] for k, v in self.APPROACH_SPECTRUM.items()}
            }
        )
    
    def validate_value(self, value: Any) -> bool:
        """Validate approach type value."""
        try:
            num_value = int(value)
            return 1 <= num_value <= 5
        except (TypeError, ValueError):
            return False
    
    def suggest_value(self, text: str, context: Dict[str, Any]) -> List[DimensionValue]:
        """Suggest approach type based on content analysis."""
        text_lower = text.lower()
        suggestions = []
        
        # Score each approach type
        approach_scores = {}
        
        for approach_key, approach_info in self.APPROACH_SPECTRUM.items():
            score = 0
            matched_keywords = []
            
            for keyword in approach_info["keywords"]:
                if keyword in text_lower:
                    score += len(keyword.split())  # Weight multi-word phrases
                    matched_keywords.append(keyword)
                    
            if score > 0:
                approach_scores[approach_key] = {
                    "score": score,
                    "keywords": matched_keywords,
                    "value": approach_info["value"]
                }
        
        # Additional heuristics
        practical_indicators = [
            "step 1", "step 2", "first,", "second,", "finally,",
            "protocol", "procedure", "checklist", "workflow"
        ]
        
        theoretical_indicators = [
            "hypothesis", "theory suggests", "conceptually", "in principle",
            "theoretical framework", "model predicts"
        ]
        
        practical_count = sum(1 for indicator in practical_indicators if indicator in text_lower)
        theoretical_count = sum(1 for indicator in theoretical_indicators if indicator in text_lower)
        
        # Adjust scores based on indicators
        if practical_count > theoretical_count:
            for key in ["practice-leaning", "practical"]:
                if key in approach_scores:
                    approach_scores[key]["score"] *= 1.5
        elif theoretical_count > practical_count:
            for key in ["theoretical", "theory-leaning"]:
                if key in approach_scores:
                    approach_scores[key]["score"] *= 1.5
        
        # Determine primary approach
        if approach_scores:
            best_approach = max(approach_scores.items(), key=lambda x: x[1]["score"])
            approach_key, score_info = best_approach
            
            suggestions.append(DimensionValue(
                value=score_info["value"],
                confidence=0.7,
                source="nlp",
                metadata={
                    "approach": approach_key,
                    "name": self.APPROACH_SPECTRUM[approach_key]["name"],
                    "matched_keywords": score_info["keywords"],
                    "practical_indicators": practical_count,
                    "theoretical_indicators": theoretical_count
                }
            ))
        else:
            # Default to balanced if no clear indicators
            suggestions.append(DimensionValue(
                value=3,
                confidence=0.4,
                source="nlp",
                metadata={
                    "approach": "balanced",
                    "name": "Balanced",
                    "reason": "no_clear_indicators"
                }
            ))
        
        return suggestions
    
    def get_display_value(self, value: Any) -> str:
        """Get human-readable display value."""
        try:
            num_value = int(value)
            for approach_info in self.APPROACH_SPECTRUM.values():
                if approach_info["value"] == num_value:
                    return approach_info["name"]
            return f"Level {num_value}"
        except:
            return str(value)
