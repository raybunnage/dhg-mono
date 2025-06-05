"""Evidence level dimension - research maturity and consensus."""

from typing import Any, Dict, List
from .base_dimension import BaseDimension, DimensionDefinition, DimensionValue
import re


class EvidenceLevelDimension(BaseDimension):
    """Research maturity and level of evidence."""
    
    EVIDENCE_LEVELS = {
        "emerging": {
            "name": "Emerging",
            "description": "Early research, preliminary findings",
            "keywords": ["preliminary", "pilot", "initial", "early", "emerging",
                        "novel", "first", "exploratory", "hypothesis-generating"],
            "phrases": ["early evidence", "preliminary data", "pilot study",
                       "initial findings", "emerging research"]
        },
        "developing": {
            "name": "Developing",
            "description": "Growing body of evidence, some validation",
            "keywords": ["developing", "growing", "accumulating", "promising",
                        "encouraging", "building", "evolving"],
            "phrases": ["growing evidence", "accumulating data", "recent studies",
                       "multiple studies", "converging evidence"]
        },
        "established": {
            "name": "Established",
            "description": "Well-validated with strong evidence base",
            "keywords": ["established", "validated", "confirmed", "proven",
                        "well-documented", "consensus", "standard", "accepted"],
            "phrases": ["well established", "strong evidence", "meta-analysis",
                       "systematic review", "clinical guidelines", "gold standard"]
        },
        "controversial": {
            "name": "Controversial",
            "description": "Conflicting evidence or ongoing debate",
            "keywords": ["controversial", "debate", "conflicting", "disputed",
                        "contested", "mixed", "inconsistent", "paradoxical"],
            "phrases": ["ongoing debate", "conflicting results", "controversial topic",
                       "mixed evidence", "paradoxical findings"]
        }
    }
    
    def get_definition(self) -> DimensionDefinition:
        return DimensionDefinition(
            name="evidence_level",
            description="Research maturity and strength of evidence",
            type="categorical",
            required=False,
            multiple=False,
            options=list(self.EVIDENCE_LEVELS.keys())
        )
    
    def validate_value(self, value: Any) -> bool:
        """Validate evidence level value."""
        return value in self.EVIDENCE_LEVELS
    
    def suggest_value(self, text: str, context: Dict[str, Any]) -> List[DimensionValue]:
        """Suggest evidence level based on content analysis."""
        text_lower = text.lower()
        suggestions = []
        
        # Score each evidence level
        level_scores = {}
        
        for level_key, level_info in self.EVIDENCE_LEVELS.items():
            score = 0
            matched_terms = []
            
            # Check keywords
            for keyword in level_info["keywords"]:
                if keyword in text_lower:
                    score += 2
                    matched_terms.append(keyword)
            
            # Check phrases (weighted higher)
            for phrase in level_info["phrases"]:
                if phrase in text_lower:
                    score += 3
                    matched_terms.append(phrase)
            
            if score > 0:
                level_scores[level_key] = {
                    "score": score,
                    "matched_terms": matched_terms
                }
        
        # Look for specific evidence indicators
        evidence_indicators = {
            "rct": "established",
            "randomized controlled": "established",
            "meta-analysis": "established",
            "systematic review": "established",
            "case report": "emerging",
            "case series": "emerging",
            "observational": "developing",
            "cohort study": "developing",
            "clinical trial": "developing"
        }
        
        for indicator, level in evidence_indicators.items():
            if indicator in text_lower:
                if level in level_scores:
                    level_scores[level]["score"] += 2
                else:
                    level_scores[level] = {"score": 2, "matched_terms": [indicator]}
        
        # Check for uncertainty language
        uncertainty_terms = ["may", "might", "could", "possibly", "potentially",
                           "suggests", "appears", "seems", "unclear", "unknown"]
        uncertainty_count = sum(1 for term in uncertainty_terms if term in text_lower)
        
        if uncertainty_count > 3:
            if "emerging" in level_scores:
                level_scores["emerging"]["score"] += uncertainty_count
        
        # Sort by score and create suggestions
        if level_scores:
            sorted_levels = sorted(level_scores.items(), key=lambda x: x[1]["score"], reverse=True)
            best_level, score_info = sorted_levels[0]
            
            # Calculate confidence based on score strength
            confidence = min(score_info["score"] / 10, 0.8)  # Cap at 0.8 for automated
            
            suggestions.append(DimensionValue(
                value=best_level,
                confidence=confidence,
                source="nlp",
                metadata={
                    "name": self.EVIDENCE_LEVELS[best_level]["name"],
                    "score": score_info["score"],
                    "matched_terms": score_info["matched_terms"],
                    "uncertainty_count": uncertainty_count
                }
            ))
        
        return suggestions
    
    def get_display_value(self, value: Any) -> str:
        """Get human-readable display value."""
        if value in self.EVIDENCE_LEVELS:
            level_info = self.EVIDENCE_LEVELS[value]
            return f"{level_info['name']} - {level_info['description']}"
        return str(value)
    
    def get_evidence_info(self, level_key: str) -> Dict[str, Any]:
        """Get detailed information about an evidence level."""
        return self.EVIDENCE_LEVELS.get(level_key, {})
