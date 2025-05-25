#!/usr/bin/env python3
"""Cluster presentations into topics."""

import click
import logging
import numpy as np
from sklearn.cluster import KMeans
from typing import List, Dict, Any
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from db import PresentationQueries
from models import TopicCluster

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@click.command()
@click.option('--n-clusters', default=10, help='Number of topic clusters')
@click.option('--min-cluster-size', default=3, help='Minimum presentations per cluster')
@click.option('--method', default='kmeans', help='Clustering method (kmeans)')
def cluster_topics(n_clusters: int, min_cluster_size: int, method: str):
    """Cluster presentations into topics based on embeddings."""
    
    queries = PresentationQueries()
    
    # Get all embeddings
    logger.info("Loading presentation embeddings...")
    embeddings_data = queries.get_presentation_embeddings()
    
    if len(embeddings_data) < n_clusters:
        logger.error(f"Not enough embeddings ({len(embeddings_data)}) for {n_clusters} clusters")
        return
        
    # Extract embeddings and IDs
    presentation_ids = [e['presentation_id'] for e in embeddings_data]
    embeddings = np.array([e['embedding'] for e in embeddings_data])
    
    logger.info(f"Clustering {len(embeddings)} presentations into {n_clusters} topics")
    
    # Perform clustering
    if method == 'kmeans':
        clusterer = KMeans(n_clusters=n_clusters, random_state=42)
        cluster_labels = clusterer.fit_predict(embeddings)
        centroids = clusterer.cluster_centers_
    else:
        logger.error(f"Unknown clustering method: {method}")
        return
        
    # Get keywords for each cluster
    clusters = {}
    for i, label in enumerate(cluster_labels):
        if label not in clusters:
            clusters[label] = {
                'presentation_ids': [],
                'centroid': centroids[label]
            }
        clusters[label]['presentation_ids'].append(presentation_ids[i])
        
    # Get top keywords for each cluster
    for cluster_id, cluster_data in clusters.items():
        if len(cluster_data['presentation_ids']) < min_cluster_size:
            logger.warning(f"Cluster {cluster_id} has only {len(cluster_data['presentation_ids'])} presentations")
            continue
            
        # Get keywords from presentations in this cluster
        cluster_keywords = []
        for pres_id in cluster_data['presentation_ids']:
            keywords = queries.db.select(
                'presentation_keywords',
                columns='keyword, score',
                filters={'presentation_id': pres_id}
            )
            cluster_keywords.extend([(k['keyword'], k['score']) for k in keywords])
            
        # Aggregate and sort keywords
        keyword_scores = {}
        for keyword, score in cluster_keywords:
            if keyword not in keyword_scores:
                keyword_scores[keyword] = 0
            keyword_scores[keyword] += score
            
        # Get top keywords
        top_keywords = sorted(keyword_scores.items(), key=lambda x: x[1], reverse=True)[:10]
        cluster_data['keywords'] = [kw[0] for kw in top_keywords]
        
        # Generate cluster name from top keywords
        cluster_data['name'] = ' / '.join(cluster_data['keywords'][:3])
        
    # Save clusters to database
    logger.info("Saving topic clusters to database...")
    
    for cluster_id, cluster_data in clusters.items():
        if len(cluster_data['presentation_ids']) >= min_cluster_size:
            # Create cluster record
            cluster_record = {
                'cluster_name': cluster_data['name'],
                'cluster_keywords': cluster_data['keywords'],
                'presentation_ids': cluster_data['presentation_ids'],
                'centroid_embedding': cluster_data['centroid'].tolist(),
                'metadata': {
                    'size': len(cluster_data['presentation_ids']),
                    'method': method,
                    'cluster_id': int(cluster_id)
                }
            }
            
            # Insert cluster
            result = queries.db.insert('topic_clusters', cluster_record)
            cluster_uuid = result['id']
            
            # Create presentation-topic assignments
            for pres_id in cluster_data['presentation_ids']:
                assignment = {
                    'presentation_id': pres_id,
                    'cluster_id': cluster_uuid,
                    'confidence_score': 1.0  # Could calculate distance to centroid
                }
                queries.db.insert('presentation_topics', assignment)
                
            logger.info(f"Created cluster: {cluster_data['name']} ({len(cluster_data['presentation_ids'])} presentations)")
            
    logger.info("Topic clustering complete!")


if __name__ == '__main__':
    cluster_topics()
