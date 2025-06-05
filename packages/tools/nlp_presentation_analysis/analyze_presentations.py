#!/usr/bin/env python3
"""Main CLI for analyzing presentations."""

import click
import logging
from typing import Optional
import sys
from pathlib import Path

# Add package to path
sys.path.insert(0, str(Path(__file__).parent))

from analyzers import EntityExtractor, KeywordExtractor, EmbeddingGenerator
from db import PresentationQueries
from models import Presentation, AnalysisResult
from utils import clean_text

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@click.command()
@click.option('--presentation-id', help='Analyze a specific presentation by ID')
@click.option('--batch', is_flag=True, help='Process multiple unprocessed presentations')
@click.option('--limit', default=10, help='Number of presentations to process in batch mode')
@click.option('--use-medical', is_flag=True, help='Use medical NER model (requires scispacy)')
@click.option('--skip-entities', is_flag=True, help='Skip entity extraction')
@click.option('--skip-keywords', is_flag=True, help='Skip keyword extraction')
@click.option('--skip-embeddings', is_flag=True, help='Skip embedding generation')
@click.option('--dry-run', is_flag=True, help='Run analysis without saving to database')
def analyze_presentations(
    presentation_id: Optional[str],
    batch: bool,
    limit: int,
    use_medical: bool,
    skip_entities: bool,
    skip_keywords: bool,
    skip_embeddings: bool,
    dry_run: bool
):
    """Analyze presentation transcripts with NLP."""
    
    # Initialize components
    queries = PresentationQueries()
    
    # Get presentations to process
    if presentation_id:
        logger.info(f"Analyzing single presentation: {presentation_id}")
        pres_data = queries.get_presentation_by_id(presentation_id)
        if not pres_data:
            logger.error(f"Presentation {presentation_id} not found")
            return
        presentations = [pres_data]
    elif batch:
        logger.info(f"Batch processing up to {limit} presentations")
        presentations = queries.get_unprocessed_presentations(limit)
        if not presentations:
            logger.info("No unprocessed presentations found")
            return
    else:
        logger.error("Please specify either --presentation-id or --batch")
        return
        
    logger.info(f"Processing {len(presentations)} presentation(s)")
    
    # Initialize analyzers
    entity_extractor = None
    keyword_extractor = None
    embedding_generator = None
    
    if not skip_entities:
        try:
            model_name = "en_core_sci_md" if use_medical else "en_core_web_sm"
            entity_extractor = EntityExtractor(model_name=model_name, use_medical=use_medical)
        except Exception as e:
            logger.error(f"Failed to initialize entity extractor: {e}")
            if use_medical:
                logger.info("Falling back to general model")
                entity_extractor = EntityExtractor(model_name="en_core_web_sm", use_medical=False)
                
    if not skip_keywords:
        keyword_extractor = KeywordExtractor()
        
    if not skip_embeddings:
        embedding_generator = EmbeddingGenerator()
        
    # Process each presentation
    success_count = 0
    for pres_data in presentations:
        try:
            # Create presentation object
            pres = Presentation(**pres_data)
            logger.info(f"Processing: {pres.title}")
            
            # Get text for analysis
            analysis_text = pres.get_analysis_text()
            if not analysis_text:
                logger.warning(f"No text found for presentation {pres.id}")
                continue
                
            # Create result container
            result = AnalysisResult(presentation_id=pres.id)
            
            # Extract entities
            if entity_extractor:
                logger.info("  - Extracting entities...")
                entities = entity_extractor.analyze(analysis_text)
                result.entities = entities
                
                # Log summary
                total_entities = sum(len(v) for k, v in entities.items() 
                                   if isinstance(v, list) and k != 'metadata')
                logger.info(f"    Found {total_entities} entities")
                
            # Extract keywords
            if keyword_extractor:
                logger.info("  - Extracting keywords...")
                keywords = keyword_extractor.analyze(analysis_text)
                result.keywords = keywords
                
                # Log summary
                for method, kws in keywords.items():
                    if isinstance(kws, list) and method != 'metadata':
                        logger.info(f"    {method}: {len(kws)} keywords")
                        
            # Generate embeddings
            if embedding_generator:
                logger.info("  - Generating embeddings...")
                
                # Generate comprehensive embedding
                embedding_result = embedding_generator.generate_presentation_embedding(
                    title=pres.title or "",
                    summary=pres.summary or "",
                    transcript=pres.transcript_text or ""
                )
                result.embeddings = embedding_result.tolist()
                logger.info(f"    Generated {len(result.embeddings)}-dimensional embedding")
                
            # Save results
            if not dry_run:
                logger.info("  - Saving results to database...")
                
                if result.entities and not skip_entities:
                    queries.save_presentation_entities(pres.id, result.entities)
                    
                if result.keywords and not skip_keywords:
                    queries.save_presentation_keywords(pres.id, result.keywords)
                    
                if result.embeddings and not skip_embeddings:
                    queries.save_presentation_embedding(pres.id, result.embeddings)
                    
                logger.info("  ✓ Analysis complete")
            else:
                logger.info("  - Dry run: Results not saved")
                
            success_count += 1
            
        except Exception as e:
            logger.error(f"Error processing presentation {pres_data.get('id')}: {e}")
            continue
            
    logger.info(f"Successfully processed {success_count}/{len(presentations)} presentations")


if __name__ == '__main__':
    analyze_presentations()
