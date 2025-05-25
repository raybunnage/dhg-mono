"""Temporal relevance dimension - currency of information."""

from typing import Any, Dict, List
from .base_dimension import BaseDimension, DimensionDefinition, DimensionValue
import re
from datetime import datetime


class TemporalRelevanceDimension(BaseDimension):
    """Currency and temporal context of information."""
    
    TEMPORAL_CATEGORIES = {
        "historical": {
            "name": "Historical Context",
            "description": "Background and evolution of concepts",
            "keywords": ["history", "historical", "evolution", "originally", "traditionally",
                        "classical", "foundation", "pioneered", "discovered"],
            "year_indicators": ["19\\d{2}", "early", "first described"]
        },
        "current": {
            "name": "Current Standard",
            "description": "Established current practices and knowledge",
            "keywords": ["current", "standard", "established", "conventional", "accepted",
                        "routine", "typical", "common practice", "guidelines"],
            "year_indicators": ["202[0-3]", "recent years", "currently"]
        },
        "emerging": {
            "name": "Emerging/Cutting-edge",
            "description": "Latest developments and future directions",
            "keywords": ["emerging", "cutting-edge", "latest", "novel", "new", "recent",
                        "breakthrough", "innovative", "state-of-the-art", "frontier"],
            "year_indicators": ["202[4-5]", "just published", "recently discovered"]
        },
        "future": {
            "name": "Future Directions",
            "description": "Predictions and upcoming developments",
            "keywords": ["future", "upcoming", "next generation", "potential", "promising",
                        "pipeline", "horizon", "prospects", "will be", "may lead to"],
            "year_indicators": ["202[6-9]", "next decade", "coming years"]
        }
    }
    
    def get_definition(self) -> DimensionDefinition:
        return DimensionDefinition(
            name="temporal_relevance",
            description="Currency and temporal context of information",
            type="categorical",
            required=True,
            multiple=False,
            options=list(self.TEMPORAL_CATEGORIES.keys())
        )
    
    def validate_value(self, value: Any) -> bool:
        """Validate temporal relevance value."""
        return value in self.TEMPORAL_CATEGORIES
    
    def suggest_value(self, text: str, context: Dict[str, Any]) -> List[DimensionValue]:
        """Suggest temporal relevance based on content analysis."""
        text_lower = text.lower()
        suggestions = []
        temporal_scores = {}
        
        # Score each temporal category
        for temp_key, temp_info in self.TEMPORAL_CATEGORIES.items():
            score = 0
            matched_terms = []
            
            # Check keywords
            for keyword in temp_info["keywords"]:
                if keyword in text_lower:
                    score += 2
                    matched_terms.append(keyword)
            
            # Check year patterns
            for pattern in temp_info["year_indicators"]:
                if re.search(pattern, text_lower):
                    score += 3
                    matched_terms.append(f"year pattern: {pattern}")
            
            if score > 0:
                temporal_scores[temp_key] = {
                    "score": score,
                    "matched_terms": matched_terms
                }
        
        # Additional temporal analysis
        
        # Check for specific year mentions
        year_matches = re.findall(r'\b(19\d{2}|20\d{2})\b', text)
        if year_matches:
            years = [int(y) for y in year_matches]
            avg_year = sum(years) / len(years)
            current_year = datetime.now().year
            
            # Classify based on average year mentioned
            if avg_year < 2000:
                if "historical" in temporal_scores:
                    temporal_scores["historical"]["score"] += 2
                else:
                    temporal_scores["historical"] = {"score": 2, "matched_terms": ["old years"]}
            elif avg_year >= current_year - 2:
                if "emerging" in temporal_scores:
                    temporal_scores["emerging"]["score"] += 2
                else:
                    temporal_scores["emerging"] = {"score": 2, "matched_terms": ["recent years"]}
        
        # Check for temporal phrases
        if "has been" in text_lower or "have been" in text_lower:
            if "current" in temporal_scores:
                temporal_scores["current"]["score"] += 1
        
        if "will be" in text_lower or "may become" in text_lower:
            if "future" in temporal_scores:
                temporal_scores["future"]["score"] += 1
        
        # Determine primary temporal relevance
        if temporal_scores:
            best_temporal = max(temporal_scores.items(), key=lambda x: x[1]["score"])
            temp_key, score_info = best_temporal
            
            confidence = min(score_info["score"] / 8, 0.85)
            
            suggestions.append(DimensionValue(
                value=temp_key,
                confidence=confidence,
                source="nlp",
                metadata={
                    "name": self.TEMPORAL_CATEGORIES[temp_key]["name"],
                    "score": score_info["score"],
                    "matched_terms": score_info["matched_terms"],
                    "years_found": year_matches if year_matches else []
                }
            ))
        else:
            # Default to current if no clear indicators
            suggestions.append(DimensionValue(
                value="current",
                confidence=0.5,
                source="rule",
                metadata={
                    "reason": "no_temporal_indicators",
                    "name": "Current Standard"
                }
            ))
        
        return suggestions
    
    def get_display_value(self, value: Any) -> str:
        """Get human-readable display value."""
        if value in self.TEMPORAL_CATEGORIES:
            return self.TEMPORAL_CATEGORIES[value]["name"]
        return str(value)
