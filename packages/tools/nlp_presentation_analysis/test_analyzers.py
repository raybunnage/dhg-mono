#!/usr/bin/env python3
"""Test the analyzers with sample text."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from analyzers import EntityExtractor, KeywordExtractor, EmbeddingGenerator
from utils import clean_text, extract_medical_abbreviations, normalize_medical_terms

# Sample medical text for testing
SAMPLE_TEXT = """
Dr. Smith presented a comprehensive overview of mitochondrial dysfunction in autism spectrum disorders. 
The presentation covered key biomarkers including elevated lactate levels, oxidative stress markers, 
and reduced ATP production. Treatment protocols discussed included CoQ10 supplementation at 100mg daily, 
N-acetylcysteine (NAC) at 600mg twice daily, and targeted nutritional interventions.

The cell danger response (CDR) theory was explored in detail, highlighting how chronic activation 
of this protective mechanism may contribute to the persistent symptoms seen in ME/CFS and related 
conditions. Metabolomic analysis revealed distinct patterns of purine metabolism disruption.

Key findings included:
- 75% of ASD patients showed mitochondrial abnormalities
- Significant improvement with metabolic support protocols
- Correlation between oxidative stress and symptom severity
"""


def test_entity_extraction():
    """Test entity extraction."""
    print("=" * 50)
    print("TESTING ENTITY EXTRACTION")
    print("=" * 50)
    
    extractor = EntityExtractor()
    results = extractor.analyze(SAMPLE_TEXT)
    
    print("\nExtracted Entities:")
    for entity_type, entities in results.items():
        if entity_type == 'metadata' or entity_type == 'key_phrases':
            continue
        if entities:
            print(f"\n{entity_type}:")
            for entity in entities[:5]:  # Show first 5
                print(f"  - {entity}")
                
    print(f"\nKey Phrases: {len(results.get('key_phrases', []))}")
    for phrase in results.get('key_phrases', [])[:10]:
        print(f"  - {phrase}")


def test_keyword_extraction():
    """Test keyword extraction."""
    print("\n" + "=" * 50)
    print("TESTING KEYWORD EXTRACTION")
    print("=" * 50)
    
    extractor = KeywordExtractor()
    results = extractor.analyze(SAMPLE_TEXT, method='all')
    
    for method, keywords in results.items():
        if method == 'metadata':
            continue
        print(f"\n{method}:")
        for keyword in keywords[:10]:  # Show top 10
            if isinstance(keyword, tuple):
                print(f"  - {keyword[0]}: {keyword[1]}")
            else:
                print(f"  - {keyword}")


def test_embedding_generation():
    """Test embedding generation."""
    print("\n" + "=" * 50)
    print("TESTING EMBEDDING GENERATION")
    print("=" * 50)
    
    generator = EmbeddingGenerator()
    results = generator.analyze(SAMPLE_TEXT)
    
    embedding = results['embeddings']
    print(f"\nEmbedding shape: {len(embedding)} dimensions")
    print(f"Model: {results['metadata']['model_name']}")
    print(f"Text stats: {results.get('text_stats', {})}")
    
    # Test similarity
    text1 = "Mitochondrial dysfunction in autism"
    text2 = "Energy metabolism and ASD"
    text3 = "Weather patterns in Seattle"
    
    sim1_2 = generator.compute_similarity(text1, text2)
    sim1_3 = generator.compute_similarity(text1, text3)
    
    print(f"\nSimilarity scores:")
    print(f"  '{text1}' vs '{text2}': {sim1_2:.3f}")
    print(f"  '{text1}' vs '{text3}': {sim1_3:.3f}")


def test_utilities():
    """Test utility functions."""
    print("\n" + "=" * 50)
    print("TESTING UTILITIES")
    print("=" * 50)
    
    # Test medical abbreviations
    abbrevs = extract_medical_abbreviations(SAMPLE_TEXT)
    print(f"\nMedical abbreviations: {abbrevs}")
    
    # Test normalization
    test_text = "The pt received 50mg vit. d and 10ml of rx meds"
    normalized = normalize_medical_terms(test_text)
    print(f"\nOriginal: {test_text}")
    print(f"Normalized: {normalized}")


if __name__ == '__main__':
    print("NLP Presentation Analysis - Test Suite\n")
    
    try:
        test_entity_extraction()
        test_keyword_extraction()
        test_embedding_generation()
        test_utilities()
        
        print("\n" + "=" * 50)
        print("ALL TESTS COMPLETED SUCCESSFULLY!")
        print("=" * 50)
        
    except Exception as e:
        print(f"\nERROR: {e}")
        print("\nMake sure you have installed dependencies:")
        print("  pip install -r requirements.txt")
        print("  python -m spacy download en_core_web_sm")
