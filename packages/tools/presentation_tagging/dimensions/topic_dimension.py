"""Topic dimension implementation with hierarchical taxonomy."""

from typing import Any, Dict, List, Optional, Set, Tuple
from .base_dimension import BaseDimension, DimensionDefinition, DimensionValue
import re
from collections import defaultdict


class TopicNode:
    """Node in the topic hierarchy."""
    
    def __init__(self, id: str, name: str, parent: Optional['TopicNode'] = None):
        self.id = id
        self.name = name
        self.parent = parent
        self.children: List['TopicNode'] = []
        self.keywords: Set[str] = set()
        self.aliases: Set[str] = set()
        
    def get_path(self) -> List[str]:
        """Get full path from root to this node."""
        path = []
        node = self
        while node:
            path.append(node.name)
            node = node.parent
        return list(reversed(path))
    
    def get_depth(self) -> int:
        """Get depth in hierarchy (root = 0)."""
        depth = 0
        node = self.parent
        while node:
            depth += 1
            node = node.parent
        return depth
    
    def find_descendant(self, name: str) -> Optional['TopicNode']:
        """Find descendant node by name."""
        if self.name.lower() == name.lower():
            return self
        for child in self.children:
            result = child.find_descendant(name)
            if result:
                return result
        return None


class TopicDimension(BaseDimension):
    """Hierarchical topic taxonomy for presentations."""
    
    def __init__(self):
        super().__init__()
        self.taxonomy = self._build_taxonomy()
        self.keyword_map = self._build_keyword_map()
        
    def get_definition(self) -> DimensionDefinition:
        return DimensionDefinition(
            name="topics",
            description="Hierarchical subject matter taxonomy",
            type="hierarchical",
            required=True,
            multiple=True,
            validation_rules={
                "min_topics": 1,
                "max_topics": 5,
                "min_depth": 2,  # At least category + subcategory
                "max_depth": 4
            }
        )
    
    def _build_taxonomy(self) -> TopicNode:
        """Build the topic hierarchy."""
        root = TopicNode("root", "Root")
        
        # Clinical Domains
        clinical = TopicNode("clinical", "Clinical Domains", root)
        root.children.append(clinical)
        
        # Neurological Conditions
        neuro = TopicNode("neuro", "Neurological Conditions", clinical)
        clinical.children.append(neuro)
        
        # Autism Spectrum Disorders
        asd = TopicNode("asd", "Autism Spectrum Disorders", neuro)
        neuro.children.append(asd)
        asd.keywords.update(["autism", "asd", "autistic", "spectrum disorder"])
        asd.aliases.update(["autism spectrum", "autistic disorder"])
        
        asd_patho = TopicNode("asd-pathophysiology", "Pathophysiology", asd)
        asd_bio = TopicNode("asd-biomarkers", "Biomarkers", asd)
        asd_inter = TopicNode("asd-interventions", "Interventions", asd)
        asd.children.extend([asd_patho, asd_bio, asd_inter])
        
        # Chronic Fatigue Syndrome
        cfs = TopicNode("cfs", "Chronic Fatigue Syndrome", neuro)
        neuro.children.append(cfs)
        cfs.keywords.update(["chronic fatigue", "cfs", "me/cfs", "myalgic encephalomyelitis"])
        cfs.aliases.update(["ME", "CFS/ME"])
        
        # Metabolic Disorders
        metabolic = TopicNode("metabolic", "Metabolic Disorders", clinical)
        clinical.children.append(metabolic)
        
        mito = TopicNode("mitochondrial", "Mitochondrial Dysfunction", metabolic)
        metabolic.children.append(mito)
        mito.keywords.update(["mitochondria", "mitochondrial", "ATP", "cellular respiration"])
        
        energy = TopicNode("energy-metabolism", "Energy Metabolism", metabolic)
        metabolic.children.append(energy)
        energy.keywords.update(["metabolism", "metabolic", "energy production", "krebs cycle"])
        
        oxidative = TopicNode("oxidative-stress", "Oxidative Stress", metabolic)
        metabolic.children.append(oxidative)
        oxidative.keywords.update(["oxidative", "ROS", "reactive oxygen", "antioxidant"])
        
        # Research Methodologies
        research = TopicNode("research", "Research Methodologies", root)
        root.children.append(research)
        
        lab = TopicNode("lab-techniques", "Laboratory Techniques", research)
        research.children.append(lab)
        
        metabolomics = TopicNode("metabolomics", "Metabolomics", lab)
        proteomics = TopicNode("proteomics", "Proteomics", lab)
        genomics = TopicNode("genomics", "Genomics", lab)
        lab.children.extend([metabolomics, proteomics, genomics])
        
        # Theoretical Frameworks
        theory = TopicNode("theory", "Theoretical Frameworks", root)
        root.children.append(theory)
        
        cdr = TopicNode("cdr", "Cell Danger Response", theory)
        theory.children.append(cdr)
        cdr.keywords.update(["cell danger", "CDR", "danger response", "naviaux"])
        
        # Clinical Applications
        applications = TopicNode("applications", "Clinical Applications", root)
        root.children.append(applications)
        
        diagnostic = TopicNode("diagnostics", "Diagnostic Protocols", applications)
        treatment = TopicNode("treatment", "Treatment Planning", applications)
        applications.children.extend([diagnostic, treatment])
        
        return root
    
    def _build_keyword_map(self) -> Dict[str, List[TopicNode]]:
        """Build keyword to topic node mapping."""
        keyword_map = defaultdict(list)
        
        def traverse(node: TopicNode):
            # Add node name
            keyword_map[node.name.lower()].append(node)
            
            # Add keywords
            for keyword in node.keywords:
                keyword_map[keyword.lower()].append(node)
                
            # Add aliases
            for alias in node.aliases:
                keyword_map[alias.lower()].append(node)
                
            # Traverse children
            for child in node.children:
                traverse(child)
                
        traverse(self.taxonomy)
        return dict(keyword_map)
    
    def validate_value(self, value: Any) -> bool:
        """Validate a topic value."""
        if isinstance(value, str):
            # Check if it's a valid topic ID or path
            return self._find_node_by_id(value) is not None
        elif isinstance(value, list):
            # Validate topic path
            return self._validate_path(value)
        return False
    
    def suggest_value(self, text: str, context: Dict[str, Any]) -> List[DimensionValue]:
        """Suggest topics based on text analysis."""
        suggestions = []
        text_lower = text.lower()
        
        # Count keyword matches for each topic
        topic_scores = defaultdict(float)
        
        # Direct keyword matching
        for keyword, nodes in self.keyword_map.items():
            if keyword in text_lower:
                # Calculate relevance based on frequency
                count = len(re.findall(r'\b' + re.escape(keyword) + r'\b', text_lower))
                for node in nodes:
                    # Higher weight for deeper nodes (more specific)
                    weight = 1.0 + (node.get_depth() * 0.2)
                    topic_scores[node] += count * weight
        
        # Check for related terms and concepts
        medical_patterns = {
            r'\bmitochond\w+\b': ["mitochondrial"],
            r'\bmetabol\w+\b': ["metabolic", "energy-metabolism"],
            r'\boxidat\w+\b': ["oxidative-stress"],
            r'\bautis\w+\b': ["asd"],
            r'\bbiomark\w+\b': ["biomarkers"],
            r'\bfatigu\w+\b': ["cfs"],
            r'\bneurol\w+\b': ["neuro"],
            r'\btreatment\w+\b': ["treatment"],
            r'\bdiagnos\w+\b': ["diagnostics"]
        }
        
        for pattern, topic_ids in medical_patterns.items():
            if re.search(pattern, text_lower):
                for topic_id in topic_ids:
                    node = self._find_node_by_id(topic_id)
                    if node:
                        topic_scores[node] += 1.0
        
        # Sort by score and create suggestions
        sorted_topics = sorted(topic_scores.items(), key=lambda x: x[1], reverse=True)
        
        for node, score in sorted_topics[:5]:  # Top 5 suggestions
            # Calculate confidence based on score
            max_score = sorted_topics[0][1] if sorted_topics else 1.0
            confidence = min(score / max_score, 1.0) * 0.9  # Max 0.9 for automated
            
            suggestions.append(DimensionValue(
                value=node.id,
                confidence=confidence,
                source="nlp",
                metadata={
                    "path": node.get_path(),
                    "score": score,
                    "keywords_matched": [k for k in node.keywords if k in text_lower]
                }
            ))
        
        return suggestions
    
    def _find_node_by_id(self, node_id: str) -> Optional[TopicNode]:
        """Find node by ID in the taxonomy."""
        def search(node: TopicNode) -> Optional[TopicNode]:
            if node.id == node_id:
                return node
            for child in node.children:
                result = search(child)
                if result:
                    return result
            return None
        
        return search(self.taxonomy)
    
    def _validate_path(self, path: List[str]) -> bool:
        """Validate a topic path exists in taxonomy."""
        node = self.taxonomy
        for segment in path[1:]:  # Skip root
            found = False
            for child in node.children:
                if child.name == segment:
                    node = child
                    found = True
                    break
            if not found:
                return False
        return True
    
    def get_all_topics(self) -> List[Dict[str, Any]]:
        """Get all topics in the taxonomy."""
        topics = []
        
        def traverse(node: TopicNode, level: int = 0):
            if node.id != "root":
                topics.append({
                    "id": node.id,
                    "name": node.name,
                    "path": node.get_path(),
                    "level": level,
                    "keywords": list(node.keywords),
                    "has_children": len(node.children) > 0
                })
            for child in node.children:
                traverse(child, level + 1)
                
        traverse(self.taxonomy)
        return topics
    
    def calculate_similarity(self, value1: Any, value2: Any) -> float:
        """Calculate similarity between two topics."""
        node1 = self._find_node_by_id(value1)
        node2 = self._find_node_by_id(value2)
        
        if not node1 or not node2:
            return 0.0
            
        if node1 == node2:
            return 1.0
            
        # Calculate based on common ancestors
        path1 = node1.get_path()
        path2 = node2.get_path()
        
        # Find common prefix length
        common_length = 0
        for i in range(min(len(path1), len(path2))):
            if path1[i] == path2[i]:
                common_length += 1
            else:
                break
                
        # Similarity based on shared path
        max_length = max(len(path1), len(path2))
        return common_length / max_length if max_length > 0 else 0.0
