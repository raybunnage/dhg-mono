"""Keyword extraction using various algorithms."""

from typing import Dict, List, Any, Tuple
import spacy
from collections import Counter
import math
from .base_analyzer import BaseAnalyzer

class KeywordExtractor(BaseAnalyzer):
    """Extract keywords using TF-IDF and other methods."""
    
    def __init__(self, model_name: str = "en_core_web_sm"):
        """Initialize keyword extractor.
        
        Args:
            model_name: spaCy model to use
        """
        super().__init__(model_name)
        self.stop_words = set()
        
    def _setup(self):
        """Load the spaCy model and setup stop words."""
        try:
            self.nlp = spacy.load(self.model_name)
            # Get stop words from spaCy
            self.stop_words = self.nlp.Defaults.stop_words
            self.logger.info(f"Loaded spaCy model: {self.model_name}")
        except OSError:
            self.logger.error(f"Model {self.model_name} not found.")
            raise
            
    def analyze(self, text: str, method: str = "all", top_k: int = 20) -> Dict[str, Any]:
        """Extract keywords from text.
        
        Args:
            text: Text to analyze
            method: Method to use ('tfidf', 'frequency', 'textrank', 'all')
            top_k: Number of top keywords to return
            
        Returns:
            Dictionary containing extracted keywords
        """
        if not self.validate_input(text):
            return {"error": "Invalid input"}
            
        text = self.preprocess(text)
        doc = self.nlp(text)
        
        results = {}
        
        if method in ["frequency", "all"]:
            results['frequency_keywords'] = self._extract_frequency_keywords(doc, top_k)
            
        if method in ["tfidf", "all"]:
            results['tfidf_keywords'] = self._extract_tfidf_keywords(doc, top_k)
            
        if method in ["pos_patterns", "all"]:
            results['pos_pattern_keywords'] = self._extract_pos_patterns(doc, top_k)
            
        # Add metadata
        results['metadata'] = {
            'method': method,
            'top_k': top_k,
            'total_tokens': len(doc),
            'unique_tokens': len(set(token.text.lower() for token in doc if not token.is_stop))
        }
        
        return results
    
    def _extract_frequency_keywords(self, doc: spacy.tokens.Doc, top_k: int) -> List[Tuple[str, float]]:
        """Extract keywords based on frequency.
        
        Args:
            doc: spaCy document
            top_k: Number of keywords to return
            
        Returns:
            List of (keyword, score) tuples
        """
        # Count word frequencies
        word_freq = Counter()
        
        for token in doc:
            # Skip stop words, punctuation, and short words
            if (not token.is_stop and 
                not token.is_punct and 
                len(token.text) > 2 and
                token.pos_ in ['NOUN', 'PROPN', 'VERB', 'ADJ']):
                word_freq[token.lemma_.lower()] += 1
                
        # Get top keywords
        total_words = sum(word_freq.values())
        keywords = []
        
        for word, freq in word_freq.most_common(top_k):
            score = freq / total_words  # Normalize by total
            keywords.append((word, round(score, 4)))
            
        return keywords
    
    def _extract_tfidf_keywords(self, doc: spacy.tokens.Doc, top_k: int) -> List[Tuple[str, float]]:
        """Extract keywords using TF-IDF.
        
        Args:
            doc: spaCy document
            top_k: Number of keywords to return
            
        Returns:
            List of (keyword, score) tuples
        """
        # For true TF-IDF, we'd need a document collection
        # Here we'll use a simplified version based on sentences
        
        sentences = list(doc.sents)
        if len(sentences) < 2:
            # Fall back to frequency for short texts
            return self._extract_frequency_keywords(doc, top_k)
            
        # Calculate term frequency per sentence
        sentence_words = []
        vocabulary = set()
        
        for sent in sentences:
            words = []
            for token in sent:
                if (not token.is_stop and 
                    not token.is_punct and 
                    len(token.text) > 2 and
                    token.pos_ in ['NOUN', 'PROPN', 'VERB', 'ADJ']):
                    word = token.lemma_.lower()
                    words.append(word)
                    vocabulary.add(word)
            sentence_words.append(words)
            
        # Calculate IDF scores
        idf_scores = {}
        num_sentences = len(sentences)
        
        for word in vocabulary:
            # Count sentences containing the word
            doc_freq = sum(1 for words in sentence_words if word in words)
            idf_scores[word] = math.log((num_sentences + 1) / (doc_freq + 1))
            
        # Calculate TF-IDF for the whole document
        doc_word_freq = Counter()
        for words in sentence_words:
            doc_word_freq.update(words)
            
        total_words = sum(doc_word_freq.values())
        tfidf_scores = {}
        
        for word, freq in doc_word_freq.items():
            tf = freq / total_words
            tfidf_scores[word] = tf * idf_scores[word]
            
        # Sort and return top keywords
        sorted_keywords = sorted(tfidf_scores.items(), key=lambda x: x[1], reverse=True)
        return [(word, round(score, 4)) for word, score in sorted_keywords[:top_k]]
    
    def _extract_pos_patterns(self, doc: spacy.tokens.Doc, top_k: int) -> List[str]:
        """Extract multi-word keywords based on POS patterns.
        
        Args:
            doc: spaCy document
            top_k: Number of keywords to return
            
        Returns:
            List of multi-word keywords
        """
        # Define POS patterns for multi-word expressions
        patterns = [
            ['ADJ', 'NOUN'],           # "medical condition"
            ['NOUN', 'NOUN'],          # "stress response"
            ['ADJ', 'ADJ', 'NOUN'],    # "chronic fatigue syndrome"
            ['NOUN', 'ADP', 'NOUN'],   # "state of health"
            ['VERB', 'NOUN'],          # "reduce inflammation"
            ['ADV', 'VERB'],           # "significantly improve"
        ]
        
        keywords = Counter()
        
        for sent in doc.sents:
            tokens = [token for token in sent if not token.is_punct]
            
            for i in range(len(tokens)):
                for pattern in patterns:
                    if i + len(pattern) <= len(tokens):
                        # Check if tokens match pattern
                        if all(tokens[i+j].pos_ == pattern[j] for j in range(len(pattern))):
                            # Extract the phrase
                            phrase = ' '.join(tokens[i+j].text for j in range(len(pattern)))
                            # Only keep if not all stop words
                            if not all(tokens[i+j].is_stop for j in range(len(pattern))):
                                keywords[phrase.lower()] += 1
                                
        # Return top phrases
        return [phrase for phrase, _ in keywords.most_common(top_k)]
    
    def extract_domain_keywords(self, text: str, domain_terms: List[str]) -> Dict[str, Any]:
        """Extract keywords related to specific domain terms.
        
        Args:
            text: Text to analyze
            domain_terms: List of domain-specific terms to look for
            
        Returns:
            Dictionary of domain keywords and their contexts
        """
        doc = self.nlp(text)
        domain_keywords = {}
        
        # Convert domain terms to lowercase for matching
        domain_terms_lower = [term.lower() for term in domain_terms]
        
        for sent in doc.sents:
            sent_lower = sent.text.lower()
            
            for i, term in enumerate(domain_terms_lower):
                if term in sent_lower:
                    if domain_terms[i] not in domain_keywords:
                        domain_keywords[domain_terms[i]] = {
                            'count': 0,
                            'contexts': []
                        }
                    
                    domain_keywords[domain_terms[i]]['count'] += 1
                    domain_keywords[domain_terms[i]]['contexts'].append(sent.text.strip())
                    
        return domain_keywords
