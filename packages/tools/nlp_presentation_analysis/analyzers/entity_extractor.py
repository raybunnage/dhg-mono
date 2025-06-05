"""Entity extraction using spaCy and scispaCy."""

from typing import Dict, List, Any, Optional, Set
import spacy
from spacy.language import Language
from collections import defaultdict
import logging

from .base_analyzer import BaseAnalyzer

class EntityExtractor(BaseAnalyzer):
    """Extract entities from text using spaCy models."""
    
    MEDICAL_ENTITY_TYPES = {
        'DISEASE', 'DISORDER', 'SYNDROME',
        'SIGN_OR_SYMPTOM', 'SIGN', 'SYMPTOM',
        'MEDICAL_CONDITION', 'INJURY_OR_POISONING',
        'PATHOLOGIC_FUNCTION', 'NEOPLASTIC_PROCESS',
        'MENTAL_OR_BEHAVIORAL_DYSFUNCTION'
    }
    
    TREATMENT_ENTITY_TYPES = {
        'TREATMENT', 'THERAPEUTIC_PROCEDURE',
        'DRUG', 'MEDICATION', 'CLINICAL_DRUG',
        'PHARMACOLOGIC_SUBSTANCE',
        'MEDICAL_DEVICE', 'RESEARCH_DEVICE'
    }
    
    BIOLOGICAL_ENTITY_TYPES = {
        'GENE_OR_GENE_PRODUCT', 'GENE', 'PROTEIN',
        'CELL', 'CELL_TYPE', 'CELL_LINE',
        'TISSUE', 'ORGAN', 'ORGANISM',
        'AMINO_ACID', 'NUCLEOTIDE_SEQUENCE'
    }
    
    def __init__(self, model_name: str = "en_core_web_sm", use_medical: bool = False):
        """Initialize entity extractor.
        
        Args:
            model_name: spaCy model to use
            use_medical: Whether to use medical entity recognition
        """
        self.use_medical = use_medical
        super().__init__(model_name)
        
    def _setup(self):
        """Load the spaCy model."""
        try:
            self.nlp = spacy.load(self.model_name)
            self.logger.info(f"Loaded spaCy model: {self.model_name}")
        except OSError:
            self.logger.error(f"Model {self.model_name} not found. Please install it first.")
            raise
            
    def analyze(self, text: str) -> Dict[str, Any]:
        """Extract entities from text.
        
        Args:
            text: Text to analyze
            
        Returns:
            Dictionary containing extracted entities
        """
        if not self.validate_input(text):
            return {"error": "Invalid input"}
            
        text = self.preprocess(text)
        doc = self.nlp(text)
        
        # Extract basic entities
        entities = self._extract_basic_entities(doc)
        
        # Extract medical entities if using medical model
        if self.use_medical:
            medical_entities = self._extract_medical_entities(doc)
            entities.update(medical_entities)
        
        # Extract key noun phrases
        entities['key_phrases'] = self._extract_key_phrases(doc)
        
        # Add metadata
        entities['metadata'] = {
            'model_used': self.model_name,
            'text_length': len(text),
            'sentence_count': len(list(doc.sents))
        }
        
        return entities
    
    def _extract_basic_entities(self, doc: Language) -> Dict[str, List[Dict[str, Any]]]:
        """Extract basic named entities.
        
        Args:
            doc: spaCy document
            
        Returns:
            Dictionary of entity types to entity lists
        """
        entities = defaultdict(list)
        seen_entities = defaultdict(set)
        
        for ent in doc.ents:
            # Skip duplicates
            if ent.text.lower() in seen_entities[ent.label_]:
                continue
                
            entity_info = {
                'text': ent.text,
                'start': ent.start_char,
                'end': ent.end_char,
                'label': ent.label_
            }
            
            entities[ent.label_].append(entity_info)
            seen_entities[ent.label_].add(ent.text.lower())
            
        return dict(entities)
    
    def _extract_medical_entities(self, doc: Language) -> Dict[str, List[Dict[str, Any]]]:
        """Extract medical-specific entities.
        
        Args:
            doc: spaCy document with medical NER
            
        Returns:
            Dictionary of medical entity categories
        """
        medical_entities = {
            'conditions': [],
            'treatments': [],
            'biological_entities': [],
            'other_medical': []
        }
        
        seen = defaultdict(set)
        
        for ent in doc.ents:
            if ent.text.lower() in seen[ent.label_]:
                continue
                
            entity_info = {
                'text': ent.text,
                'type': ent.label_,
                'start': ent.start_char,
                'end': ent.end_char
            }
            
            # Categorize medical entities
            if ent.label_ in self.MEDICAL_ENTITY_TYPES:
                medical_entities['conditions'].append(entity_info)
            elif ent.label_ in self.TREATMENT_ENTITY_TYPES:
                medical_entities['treatments'].append(entity_info)
            elif ent.label_ in self.BIOLOGICAL_ENTITY_TYPES:
                medical_entities['biological_entities'].append(entity_info)
            else:
                medical_entities['other_medical'].append(entity_info)
                
            seen[ent.label_].add(ent.text.lower())
            
        return medical_entities
    
    def _extract_key_phrases(self, doc: Language, max_phrases: int = 20) -> List[str]:
        """Extract key noun phrases from document.
        
        Args:
            doc: spaCy document
            max_phrases: Maximum number of phrases to return
            
        Returns:
            List of key phrases
        """
        # Extract noun chunks
        noun_phrases = []
        seen_phrases = set()
        
        for chunk in doc.noun_chunks:
            # Skip very short phrases
            if len(chunk.text.split()) < 2:
                continue
                
            # Skip if contains only stop words
            if all(token.is_stop for token in chunk):
                continue
                
            phrase = chunk.text.lower().strip()
            if phrase not in seen_phrases:
                noun_phrases.append({
                    'text': chunk.text,
                    'root': chunk.root.text,
                    'length': len(chunk)
                })
                seen_phrases.add(phrase)
        
        # Sort by length (longer phrases often more specific)
        noun_phrases.sort(key=lambda x: x['length'], reverse=True)
        
        # Return top phrases
        return [p['text'] for p in noun_phrases[:max_phrases]]
    
    def extract_entity_relationships(self, text: str) -> List[Dict[str, Any]]:
        """Extract relationships between entities.
        
        Args:
            text: Text to analyze
            
        Returns:
            List of entity relationships
        """
        doc = self.nlp(text)
        relationships = []
        
        # Look for entities connected by specific dependency patterns
        for token in doc:
            if token.dep_ in ("nsubj", "dobj") and token.head.pos_ == "VERB":
                # Find subject-verb-object patterns
                subj = None
                obj = None
                
                for child in token.head.children:
                    if child.dep_ == "nsubj" and child.ent_type_:
                        subj = child
                    elif child.dep_ == "dobj" and child.ent_type_:
                        obj = child
                        
                if subj and obj and subj != obj:
                    relationships.append({
                        'subject': subj.text,
                        'subject_type': subj.ent_type_,
                        'relation': token.head.text,
                        'object': obj.text,
                        'object_type': obj.ent_type_
                    })
                    
        return relationships
