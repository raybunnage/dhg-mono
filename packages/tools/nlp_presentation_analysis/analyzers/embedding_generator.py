"""Generate embeddings for semantic analysis."""

from typing import Dict, List, Any, Optional, Union
import numpy as np
from sentence_transformers import SentenceTransformer
import logging
from .base_analyzer import BaseAnalyzer

class EmbeddingGenerator(BaseAnalyzer):
    """Generate semantic embeddings for text analysis."""
    
    # Recommended models for different use cases
    MODELS = {
        'general': 'all-MiniLM-L6-v2',  # Fast and good quality
        'medical': 'pritamdeka/S-PubMedBert-MS-MARCO',  # Medical domain
        'similarity': 'all-mpnet-base-v2',  # Best quality for similarity
        'multilingual': 'paraphrase-multilingual-MiniLM-L12-v2'
    }
    
    def __init__(self, model_name: Optional[str] = None, model_type: str = 'general'):
        """Initialize embedding generator.
        
        Args:
            model_name: Specific model name to use
            model_type: Type of model ('general', 'medical', 'similarity')
        """
        if model_name is None:
            model_name = self.MODELS.get(model_type, self.MODELS['general'])
        
        super().__init__(model_name)
        self.model_type = model_type
        
    def _setup(self):
        """Load the sentence transformer model."""
        try:
            self.model = SentenceTransformer(self.model_name)
            self.logger.info(f"Loaded embedding model: {self.model_name}")
            
            # Get embedding dimension
            self.embedding_dim = self.model.get_sentence_embedding_dimension()
            
        except Exception as e:
            self.logger.error(f"Error loading model {self.model_name}: {e}")
            raise
            
    def analyze(self, text: Union[str, List[str]]) -> Dict[str, Any]:
        """Generate embeddings for text.
        
        Args:
            text: Single text or list of texts
            
        Returns:
            Dictionary containing embeddings and metadata
        """
        if isinstance(text, str):
            texts = [text]
            single_input = True
        else:
            texts = text
            single_input = False
            
        # Validate inputs
        if not texts or not all(isinstance(t, str) for t in texts):
            return {"error": "Invalid input"}
            
        # Preprocess texts
        processed_texts = [self.preprocess(t) for t in texts]
        
        # Generate embeddings
        embeddings = self.model.encode(processed_texts, convert_to_numpy=True)
        
        results = {
            'embeddings': embeddings[0] if single_input else embeddings,
            'metadata': {
                'model_name': self.model_name,
                'model_type': self.model_type,
                'embedding_dim': self.embedding_dim,
                'num_texts': len(texts)
            }
        }
        
        # Add text statistics
        if single_input:
            results['text_stats'] = self._get_text_stats(texts[0])
        
        return results
    
    def generate_chunk_embeddings(self, text: str, chunk_size: int = 512, overlap: int = 128) -> Dict[str, Any]:
        """Generate embeddings for text chunks with overlap.
        
        Args:
            text: Text to chunk and embed
            chunk_size: Size of each chunk in characters
            overlap: Overlap between chunks
            
        Returns:
            Dictionary containing chunk embeddings
        """
        if not self.validate_input(text):
            return {"error": "Invalid input"}
            
        # Create chunks
        chunks = self._create_chunks(text, chunk_size, overlap)
        
        # Generate embeddings for chunks
        embeddings = self.model.encode(chunks, convert_to_numpy=True)
        
        return {
            'chunk_embeddings': embeddings,
            'chunks': chunks,
            'metadata': {
                'num_chunks': len(chunks),
                'chunk_size': chunk_size,
                'overlap': overlap,
                'model_name': self.model_name
            }
        }
    
    def compute_similarity(self, text1: str, text2: str) -> float:
        """Compute cosine similarity between two texts.
        
        Args:
            text1: First text
            text2: Second text
            
        Returns:
            Similarity score between 0 and 1
        """
        # Generate embeddings
        embeddings = self.model.encode([text1, text2], convert_to_numpy=True)
        
        # Compute cosine similarity
        similarity = self._cosine_similarity(embeddings[0], embeddings[1])
        
        return float(similarity)
    
    def find_similar_chunks(self, query: str, chunks: List[str], top_k: int = 5) -> List[Dict[str, Any]]:
        """Find most similar chunks to a query.
        
        Args:
            query: Query text
            chunks: List of text chunks to search
            top_k: Number of similar chunks to return
            
        Returns:
            List of similar chunks with scores
        """
        # Generate embeddings
        query_embedding = self.model.encode([query], convert_to_numpy=True)[0]
        chunk_embeddings = self.model.encode(chunks, convert_to_numpy=True)
        
        # Compute similarities
        similarities = []
        for i, chunk_embedding in enumerate(chunk_embeddings):
            similarity = self._cosine_similarity(query_embedding, chunk_embedding)
            similarities.append({
                'chunk_index': i,
                'chunk_text': chunks[i],
                'similarity': float(similarity)
            })
            
        # Sort by similarity
        similarities.sort(key=lambda x: x['similarity'], reverse=True)
        
        return similarities[:top_k]
    
    def generate_presentation_embedding(self, title: str, summary: str, transcript: str) -> np.ndarray:
        """Generate a comprehensive embedding for a presentation.
        
        Args:
            title: Presentation title
            summary: Presentation summary
            transcript: Full transcript
            
        Returns:
            Combined embedding
        """
        # Weight different components
        weights = {
            'title': 0.3,
            'summary': 0.4,
            'transcript': 0.3
        }
        
        # Generate embeddings
        title_emb = self.model.encode([title], convert_to_numpy=True)[0]
        summary_emb = self.model.encode([summary], convert_to_numpy=True)[0]
        
        # For transcript, use first 1000 characters or chunk approach
        if len(transcript) > 1000:
            transcript_sample = transcript[:1000] + "..."
        else:
            transcript_sample = transcript
            
        transcript_emb = self.model.encode([transcript_sample], convert_to_numpy=True)[0]
        
        # Weighted average
        combined_embedding = (
            weights['title'] * title_emb +
            weights['summary'] * summary_emb +
            weights['transcript'] * transcript_emb
        )
        
        # Normalize
        combined_embedding = combined_embedding / np.linalg.norm(combined_embedding)
        
        return combined_embedding
    
    def _create_chunks(self, text: str, chunk_size: int, overlap: int) -> List[str]:
        """Create overlapping chunks from text.
        
        Args:
            text: Text to chunk
            chunk_size: Size of each chunk
            overlap: Overlap between chunks
            
        Returns:
            List of text chunks
        """
        chunks = []
        start = 0
        
        while start < len(text):
            end = start + chunk_size
            chunk = text[start:end]
            
            # Try to end at a sentence boundary
            if end < len(text):
                last_period = chunk.rfind('.')
                if last_period > chunk_size * 0.8:  # If period is in last 20%
                    chunk = chunk[:last_period + 1]
                    end = start + last_period + 1
                    
            chunks.append(chunk.strip())
            start = end - overlap
            
        return chunks
    
    def _cosine_similarity(self, vec1: np.ndarray, vec2: np.ndarray) -> float:
        """Compute cosine similarity between two vectors.
        
        Args:
            vec1: First vector
            vec2: Second vector
            
        Returns:
            Cosine similarity
        """
        dot_product = np.dot(vec1, vec2)
        norm1 = np.linalg.norm(vec1)
        norm2 = np.linalg.norm(vec2)
        
        if norm1 == 0 or norm2 == 0:
            return 0.0
            
        return dot_product / (norm1 * norm2)
    
    def _get_text_stats(self, text: str) -> Dict[str, Any]:
        """Get basic statistics about text.
        
        Args:
            text: Input text
            
        Returns:
            Dictionary of statistics
        """
        words = text.split()
        sentences = text.split('.')
        
        return {
            'char_count': len(text),
            'word_count': len(words),
            'sentence_count': len([s for s in sentences if s.strip()]),
            'avg_word_length': sum(len(w) for w in words) / len(words) if words else 0
        }
