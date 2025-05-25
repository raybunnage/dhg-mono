"""Patient population dimension."""

from typing import Any, Dict, List
from .base_dimension import BaseDimension, DimensionDefinition, DimensionValue


class PatientPopulationDimension(BaseDimension):
    """Relevant patient demographics and populations."""
    
    POPULATIONS = {
        "pediatric": {
            "name": "Pediatric",
            "keywords": ["pediatric", "children", "child", "infant", "adolescent",
                        "youth", "teenage", "newborn", "neonatal"],
            "age_range": "0-18 years"
        },
        "adult": {
            "name": "Adult",
            "keywords": ["adult", "adults", "middle-aged"],
            "age_range": "18-65 years"
        },
        "geriatric": {
            "name": "Geriatric",
            "keywords": ["geriatric", "elderly", "older adult", "senior", "aging"],
            "age_range": "65+ years"
        },
        "maternal": {
            "name": "Maternal/Prenatal",
            "keywords": ["maternal", "prenatal", "pregnancy", "pregnant", "perinatal",
                        "obstetric", "mother", "fetal"],
            "age_range": "Childbearing age"
        },
        "general": {
            "name": "General Population",
            "keywords": ["general population", "all ages", "across lifespan"],
            "age_range": "All ages"
        }
    }
    
    SPECIAL_POPULATIONS = {
        "immunocompromised": ["immunocompromised", "immunosuppressed", "transplant"],
        "chronic-disease": ["chronic disease", "comorbid", "multiple conditions"],
        "genetic-disorders": ["genetic", "hereditary", "congenital", "inherited"]
    }
    
    def get_definition(self) -> DimensionDefinition:
        return DimensionDefinition(
            name="patient_population",
            description="Relevant patient demographics",
            type="categorical",
            required=False,
            multiple=True,
            options=list(self.POPULATIONS.keys())
        )
    
    def validate_value(self, value: Any) -> bool:
        """Validate patient population value."""
        if isinstance(value, str):
            return value in self.POPULATIONS
        elif isinstance(value, list):
            return all(v in self.POPULATIONS for v in value)
        return False
    
    def suggest_value(self, text: str, context: Dict[str, Any]) -> List[DimensionValue]:
        """Suggest patient populations based on content analysis."""
        text_lower = text.lower()
        suggestions = []
        population_scores = {}
        
        # Check for population keywords
        for pop_key, pop_info in self.POPULATIONS.items():
            score = 0
            matched_keywords = []
            
            for keyword in pop_info["keywords"]:
                if keyword in text_lower:
                    # Weight based on keyword specificity
                    weight = 2 if len(keyword.split()) > 1 else 1
                    score += weight
                    matched_keywords.append(keyword)
            
            if score > 0:
                population_scores[pop_key] = {
                    "score": score,
                    "keywords": matched_keywords
                }
        
        # Check for age mentions
        age_patterns = [
            (r'\b(\d+)\s*(?:year|yr)s?\s*old\b', 'age_mention'),
            (r'\b(?:age|aged?)\s*(\d+)\b', 'age_mention'),
            (r'\b(\d+)\s*months?\s*old\b', 'infant')
        ]
        
        for pattern, hint in age_patterns:
            matches = re.findall(pattern, text_lower)
            if matches:
                # Determine population based on age
                for match in matches:
                    try:
                        age = int(match)
                        if hint == 'infant' or age < 18:
                            if "pediatric" in population_scores:
                                population_scores["pediatric"]["score"] += 2
                            else:
                                population_scores["pediatric"] = {"score": 2, "keywords": ["age mention"]}
                        elif age >= 65:
                            if "geriatric" in population_scores:
                                population_scores["geriatric"]["score"] += 2
                            else:
                                population_scores["geriatric"] = {"score": 2, "keywords": ["age mention"]}
                    except:
                        pass
        
        # Check for special populations
        special_mentions = []
        for special_key, keywords in self.SPECIAL_POPULATIONS.items():
            for keyword in keywords:
                if keyword in text_lower:
                    special_mentions.append(special_key)
        
        # Create suggestions
        if population_scores:
            sorted_pops = sorted(population_scores.items(), key=lambda x: x[1]["score"], reverse=True)
            
            for pop_key, score_info in sorted_pops[:2]:  # Top 2 populations
                confidence = min(score_info["score"] / 5, 0.8)
                
                suggestions.append(DimensionValue(
                    value=pop_key,
                    confidence=confidence,
                    source="nlp",
                    metadata={
                        "name": self.POPULATIONS[pop_key]["name"],
                        "matched_keywords": score_info["keywords"],
                        "special_populations": special_mentions
                    }
                ))
        
        # If no specific population found but not clearly general
        if not suggestions and "population" not in text_lower:
            # Don't assume general population - return empty
            pass
        
        return suggestions
    
    def get_display_value(self, value: Any) -> str:
        """Get human-readable display value."""
        if isinstance(value, str):
            return self.POPULATIONS.get(value, {}).get("name", value)
        elif isinstance(value, list):
            names = [self.POPULATIONS.get(v, {}).get("name", v) for v in value]
            return ", ".join(names)
        return str(value)
