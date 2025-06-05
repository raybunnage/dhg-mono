#!/usr/bin/env python3
"""Generate embeddings for all presentations."""

import click
import logging
from typing import Optional
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from analyzers import EmbeddingGenerator
from db import PresentationQueries
from models import Presentation

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@click.command()
@click.option('--all', 'process_all', is_flag=True, help='Generate embeddings for all presentations')
@click.option('--missing', is_flag=True, help='Only process presentations without embeddings')
@click.option('--model-type', default='general', help='Model type: general, medical, similarity')
@click.option('--batch-size', default=10, help='Number of presentations to process at once')
def generate_embeddings(process_all: bool, missing: bool, model_type: str, batch_size: int):
    """Generate embeddings for presentations."""
    
    queries = PresentationQueries()
    embedding_generator = EmbeddingGenerator(model_type=model_type)
    
    # Get presentations
    if process_all:
        presentations = queries.db.select('presentations', columns='id, title, summary, transcript_text')
    elif missing:
        # Get presentations without embeddings
        existing = queries.db.select('presentation_embeddings', columns='presentation_id')
        existing_ids = [e['presentation_id'] for e in existing]
        
        all_presentations = queries.db.select('presentations', columns='id, title, summary, transcript_text')
        presentations = [p for p in all_presentations if p['id'] not in existing_ids]
    else:
        logger.error("Please specify --all or --missing")
        return
        
    logger.info(f"Processing {len(presentations)} presentations with {model_type} model")
    
    success_count = 0
    for i in range(0, len(presentations), batch_size):
        batch = presentations[i:i + batch_size]
        
        for pres_data in batch:
            try:
                pres = Presentation(**pres_data)
                logger.info(f"Generating embedding for: {pres.title}")
                
                # Generate embedding
                embedding = embedding_generator.generate_presentation_embedding(
                    title=pres.title or "",
                    summary=pres.summary or "",
                    transcript=pres.transcript_text or ""
                )
                
                # Save embedding
                queries.save_presentation_embedding(
                    pres.id,
                    embedding.tolist(),
                    embedding_generator.model_name
                )
                
                success_count += 1
                
            except Exception as e:
                logger.error(f"Error processing presentation {pres_data['id']}: {e}")
                
    logger.info(f"Successfully generated {success_count} embeddings")


if __name__ == '__main__':
    generate_embeddings()
