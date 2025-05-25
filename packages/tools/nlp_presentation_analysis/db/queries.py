"""Database queries for presentation analysis."""

from typing import List, Dict, Any, Optional
from datetime import datetime
import json
import logging
from .supabase_client import SupabaseClient

class PresentationQueries:
    """Handle database queries for presentations."""
    
    def __init__(self):
        """Initialize with Supabase client."""
        self.db = SupabaseClient()
        self.logger = logging.getLogger(__name__)
        
    def get_unprocessed_presentations(self, limit: int = 10) -> List[Dict[str, Any]]:
        """Get presentations that haven't been processed yet.
        
        Args:
            limit: Maximum number of presentations to return
            
        Returns:
            List of presentation records
        """
        try:
            # First check if nlp_processed column exists in metadata
            presentations = self.db.select(
                'presentations',
                columns='id, title, summary, transcript_text, created_at, metadata',
                filters={}
            )
            
            # Filter unprocessed presentations
            unprocessed = []
            for pres in presentations:
                metadata = pres.get('metadata', {}) or {}
                if not metadata.get('nlp_processed', False):
                    unprocessed.append(pres)
                    
                if len(unprocessed) >= limit:
                    break
                    
            return unprocessed
            
        except Exception as e:
            self.logger.error(f"Error fetching unprocessed presentations: {e}")
            return []
            
    def get_presentation_by_id(self, presentation_id: str) -> Optional[Dict[str, Any]]:
        """Get a single presentation by ID.
        
        Args:
            presentation_id: UUID of the presentation
            
        Returns:
            Presentation record or None
        """
        try:
            results = self.db.select(
                'presentations',
                columns='*',
                filters={'id': presentation_id}
            )
            return results[0] if results else None
            
        except Exception as e:
            self.logger.error(f"Error fetching presentation {presentation_id}: {e}")
            return None
            
    def save_presentation_entities(self, presentation_id: str, entities: Dict[str, Any]) -> bool:
        """Save extracted entities for a presentation.
        
        Args:
            presentation_id: UUID of the presentation
            entities: Extracted entities
            
        Returns:
            Success status
        """
        try:
            # Prepare entity records
            entity_records = []
            
            # Process different entity types
            for entity_type, entity_list in entities.items():
                if entity_type == 'metadata' or entity_type == 'key_phrases':
                    continue
                    
                if isinstance(entity_list, list):
                    for entity in entity_list:
                        if isinstance(entity, dict):
                            record = {
                                'presentation_id': presentation_id,
                                'entity_type': entity_type,
                                'entity_text': entity.get('text', ''),
                                'confidence_score': entity.get('confidence', 1.0),
                                'extraction_method': 'spacy',
                                'metadata': {
                                    'label': entity.get('label', ''),
                                    'start': entity.get('start', 0),
                                    'end': entity.get('end', 0)
                                }
                            }
                            entity_records.append(record)
                            
            # Batch insert entities
            if entity_records:
                self.db.batch_insert('presentation_entities', entity_records)
                
            # Update presentation metadata
            self.mark_presentation_processed(presentation_id, 'entities')
            
            return True
            
        except Exception as e:
            self.logger.error(f"Error saving entities for presentation {presentation_id}: {e}")
            return False
            
    def save_presentation_keywords(self, presentation_id: str, keywords: Dict[str, Any]) -> bool:
        """Save extracted keywords for a presentation.
        
        Args:
            presentation_id: UUID of the presentation
            keywords: Extracted keywords
            
        Returns:
            Success status
        """
        try:
            # Prepare keyword records
            keyword_records = []
            
            for method, keyword_list in keywords.items():
                if method == 'metadata':
                    continue
                    
                if isinstance(keyword_list, list):
                    for item in keyword_list:
                        if isinstance(item, tuple):
                            keyword, score = item
                            record = {
                                'presentation_id': presentation_id,
                                'keyword': keyword,
                                'score': score,
                                'extraction_method': method
                            }
                        else:
                            record = {
                                'presentation_id': presentation_id,
                                'keyword': item,
                                'score': 1.0,
                                'extraction_method': method
                            }
                        keyword_records.append(record)
                        
            # Batch insert keywords
            if keyword_records:
                self.db.batch_insert('presentation_keywords', keyword_records)
                
            # Update presentation metadata
            self.mark_presentation_processed(presentation_id, 'keywords')
            
            return True
            
        except Exception as e:
            self.logger.error(f"Error saving keywords for presentation {presentation_id}: {e}")
            return False
            
    def save_presentation_embedding(self, presentation_id: str, embedding: List[float], 
                                  model_name: str = "all-MiniLM-L6-v2") -> bool:
        """Save embedding for a presentation.
        
        Args:
            presentation_id: UUID of the presentation
            embedding: Embedding vector
            model_name: Name of the model used
            
        Returns:
            Success status
        """
        try:
            data = {
                'presentation_id': presentation_id,
                'embedding': embedding,
                'model_name': model_name,
                'created_at': datetime.utcnow().isoformat()
            }
            
            # Upsert embedding (update if exists)
            self.db.upsert('presentation_embeddings', data, on_conflict='presentation_id')
            
            # Update presentation metadata
            self.mark_presentation_processed(presentation_id, 'embeddings')
            
            return True
            
        except Exception as e:
            self.logger.error(f"Error saving embedding for presentation {presentation_id}: {e}")
            return False
            
    def mark_presentation_processed(self, presentation_id: str, process_type: str) -> bool:
        """Mark a presentation as processed.
        
        Args:
            presentation_id: UUID of the presentation
            process_type: Type of processing done
            
        Returns:
            Success status
        """
        try:
            # Get current metadata
            pres = self.get_presentation_by_id(presentation_id)
            if not pres:
                return False
                
            metadata = pres.get('metadata', {}) or {}
            
            # Update processing status
            if 'nlp_processing' not in metadata:
                metadata['nlp_processing'] = {}
                
            metadata['nlp_processing'][process_type] = {
                'processed': True,
                'processed_at': datetime.utcnow().isoformat()
            }
            
            # Check if all processing is complete
            if all(metadata['nlp_processing'].get(pt, {}).get('processed', False) 
                   for pt in ['entities', 'keywords', 'embeddings']):
                metadata['nlp_processed'] = True
                metadata['nlp_processed_at'] = datetime.utcnow().isoformat()
                
            # Update presentation
            self.db.update(
                'presentations',
                {'metadata': metadata},
                {'id': presentation_id}
            )
            
            return True
            
        except Exception as e:
            self.logger.error(f"Error marking presentation {presentation_id} as processed: {e}")
            return False
            
    def get_presentation_embeddings(self, limit: Optional[int] = None) -> List[Dict[str, Any]]:
        """Get all presentation embeddings.
        
        Args:
            limit: Maximum number of embeddings to return
            
        Returns:
            List of embedding records
        """
        try:
            query = self.db.client.table('presentation_embeddings').select('*')
            
            if limit:
                query = query.limit(limit)
                
            result = query.execute()
            return result.data
            
        except Exception as e:
            self.logger.error(f"Error fetching presentation embeddings: {e}")
            return []
            
    def find_similar_presentations(self, presentation_id: str, top_k: int = 5) -> List[Dict[str, Any]]:
        """Find similar presentations using embeddings.
        
        Args:
            presentation_id: UUID of the reference presentation
            top_k: Number of similar presentations to return
            
        Returns:
            List of similar presentations with similarity scores
        """
        try:
            # This would ideally use pgvector for efficient similarity search
            # For now, we'll implement a simple version
            
            # Get target embedding
            target_result = self.db.select(
                'presentation_embeddings',
                filters={'presentation_id': presentation_id}
            )
            
            if not target_result:
                return []
                
            target_embedding = target_result[0]['embedding']
            
            # Get all other embeddings
            all_embeddings = self.get_presentation_embeddings()
            
            # Calculate similarities (would be done in DB with pgvector)
            similarities = []
            for emb_record in all_embeddings:
                if emb_record['presentation_id'] != presentation_id:
                    # Simple cosine similarity calculation
                    # In production, this should be done with pgvector
                    similarity = self._calculate_similarity(
                        target_embedding,
                        emb_record['embedding']
                    )
                    similarities.append({
                        'presentation_id': emb_record['presentation_id'],
                        'similarity': similarity
                    })
                    
            # Sort and get top k
            similarities.sort(key=lambda x: x['similarity'], reverse=True)
            
            # Get presentation details for top results
            top_similar = similarities[:top_k]
            presentation_ids = [s['presentation_id'] for s in top_similar]
            
            presentations = self.db.select(
                'presentations',
                columns='id, title, summary',
                filters={'id': presentation_ids}
            )
            
            # Merge with similarity scores
            pres_dict = {p['id']: p for p in presentations}
            results = []
            for sim in top_similar:
                if sim['presentation_id'] in pres_dict:
                    pres = pres_dict[sim['presentation_id']]
                    pres['similarity_score'] = sim['similarity']
                    results.append(pres)
                    
            return results
            
        except Exception as e:
            self.logger.error(f"Error finding similar presentations: {e}")
            return []
            
    def _calculate_similarity(self, vec1: List[float], vec2: List[float]) -> float:
        """Calculate cosine similarity between two vectors.
        
        Args:
            vec1: First vector
            vec2: Second vector
            
        Returns:
            Similarity score
        """
        import numpy as np
        
        v1 = np.array(vec1)
        v2 = np.array(vec2)
        
        dot_product = np.dot(v1, v2)
        norm1 = np.linalg.norm(v1)
        norm2 = np.linalg.norm(v2)
        
        if norm1 == 0 or norm2 == 0:
            return 0.0
            
        return float(dot_product / (norm1 * norm2))
