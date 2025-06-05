"""Complexity level dimension for presentations."""

from typing import Any, Dict, List, Optional
from .base_dimension import BaseDimension, DimensionDefinition, DimensionValue
import re


class ComplexityDimension(BaseDimension):
    """Complexity level assessment for presentations."""
    
    COMPLEXITY_INDICATORS = {
        "beginner": {
            "keywords": ["introduction", "basics", "fundamental", "overview", "101", 
                        "beginner", "getting started", "primer", "essentials"],
            "phrases": ["what is", "introduction to", "basics of", "for beginners"],
            "score_range": (1, 3)
        },
        "intermediate": {
            "keywords": ["practical", "application", "case study", "clinical", 
                        "implementation", "protocol", "management"],
            "phrases": ["how to", "best practices", "clinical applications", "case studies"],
            "score_range": (4, 6)
        },
        "advanced": {
            "keywords": ["advanced", "complex", "detailed", "comprehensive", "research",
                        "mechanism", "pathophysiology", "molecular"],
            "phrases": ["deep dive", "advanced topics", "research findings", "mechanisms of"],
            "score_range": (7, 9)
        },
        "expert": {
            "keywords": ["cutting-edge", "novel", "emerging", "frontier", "breakthrough",
                        "controversial", "debate", "hypothesis"],
            "phrases": ["latest research", "novel approaches", "emerging evidence", "future directions"],
            "score_range": (9, 10)
        }
    }
    
    def get_definition(self) -> DimensionDefinition:
        return DimensionDefinition(
            name="complexity",
            description="Depth and sophistication level of content",
            type="numeric",
            required=True,
            multiple=False,
            range={"min": 1, "max": 10},
            validation_rules={
                "type": "integer",
                "allow_decimal": True
            }
        )
    
    def validate_value(self, value: Any) -> bool:
        """Validate complexity value is in range."""
        try:
            num_value = float(value)
            return 1 <= num_value <= 10
        except (TypeError, ValueError):
            return False
    
    def suggest_value(self, text: str, context: Dict[str, Any]) -> List[DimensionValue]:
        """Suggest complexity level based on text analysis."""
        text_lower = text.lower()
        suggestions = []
        
        # Score each complexity level
        level_scores = {}
        
        for level, indicators in self.COMPLEXITY_INDICATORS.items():
            score = 0
            
            # Check keywords
            for keyword in indicators["keywords"]:
                if keyword in text_lower:
                    score += 2
                    
            # Check phrases
            for phrase in indicators["phrases"]:
                if phrase in text_lower:
                    score += 3
                    
            level_scores[level] = score
        
        # Additional heuristics
        technical_score = self._calculate_technical_score(text)
        prerequisite_score = self._calculate_prerequisite_score(text)
        
        # Determine primary complexity level
        if level_scores:
            primary_level = max(level_scores.items(), key=lambda x: x[1])[0]
            base_score = self.COMPLEXITY_INDICATORS[primary_level]["score_range"]
            
            # Adjust based on technical content
            if technical_score > 0.7:
                complexity_value = base_score[1]  # Higher end
            elif technical_score > 0.4:
                complexity_value = (base_score[0] + base_score[1]) / 2  # Middle
            else:
                complexity_value = base_score[0]  # Lower end
                
            # Adjust based on prerequisites
            complexity_value += prerequisite_score
            
            # Ensure within bounds
            complexity_value = max(1, min(10, complexity_value))
            
            suggestions.append(DimensionValue(
                value=complexity_value,
                confidence=0.7,
                source="nlp",
                metadata={
                    "level": primary_level,
                    "technical_score": technical_score,
                    "prerequisite_score": prerequisite_score,
                    "indicators_found": sum(level_scores.values())
                }
            ))
        
        # If no clear indicators, estimate based on technical content
        if not suggestions:
            if technical_score > 0.6:
                complexity_value = 7
            elif technical_score > 0.3:
                complexity_value = 5
            else:
                complexity_value = 3
                
            suggestions.append(DimensionValue(
                value=complexity_value,
                confidence=0.5,
                source="nlp",
                metadata={
                    "technical_score": technical_score,
                    "method": "technical_analysis"
                }
            ))
        
        return suggestions
    
    def _calculate_technical_score(self, text: str) -> float:
        """Calculate technical content score (0-1)."""
        technical_indicators = [
            # Medical/scientific terms
            r'\b(?:metabol|mitochondr|oxidat|pathophysio|biomark|proteom|genomic)\w*\b',
            # Measurements and units
            r'\b\d+\s*(?:mg|ml|μM|mM|ng|pg|IU)\b',
            # Statistical terms
            r'\b(?:p-value|significance|correlation|regression|CI|SD|SEM)\b',
            # Research terms
            r'\b(?:methodology|hypothesis|mechanism|pathway|substrate|receptor)\b',
            # Complex medical conditions
            r'\b(?:dysfunction|syndrome|disorder|disease|pathology)\b'
        ]
        
        total_words = len(text.split())
        technical_matches = 0
        
        for pattern in technical_indicators:
            matches = re.findall(pattern, text, re.IGNORECASE)
            technical_matches += len(matches)
            
        # Calculate ratio
        technical_ratio = technical_matches / max(total_words, 1)
        
        # Normalize to 0-1 range (assume 10% technical terms is very technical)
        return min(technical_ratio * 10, 1.0)
    
    def _calculate_prerequisite_score(self, text: str) -> float:
        """Calculate prerequisite complexity adjustment."""
        prerequisite_phrases = [
            "requires understanding of",
            "builds upon",
            "assumes knowledge",
            "prerequisite",
            "advanced understanding",
            "familiarity with"
        ]
        
        score = 0
        text_lower = text.lower()
        
        for phrase in prerequisite_phrases:
            if phrase in text_lower:
                score += 1
                
        # Each prerequisite adds 0.5 to complexity
        return min(score * 0.5, 2.0)  # Max adjustment of 2
    
    def get_level_description(self, value: float) -> str:
        """Get human-readable description of complexity level."""
        if value <= 3:
            return "Beginner - Suitable for those new to the topic"
        elif value <= 6:
            return "Intermediate - Assumes basic knowledge"
        elif value <= 8:
            return "Advanced - Requires solid understanding"
        else:
            return "Expert - Cutting-edge or highly specialized"
    
    def get_display_value(self, value: Any) -> str:
        """Get display string for complexity value."""
        try:
            num_value = float(value)
            level_desc = self.get_level_description(num_value)
            return f"{num_value:.1f}/10 - {level_desc}"
        except:
            return str(value)
