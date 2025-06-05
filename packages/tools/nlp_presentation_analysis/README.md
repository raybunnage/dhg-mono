# NLP Presentation Analysis Tool

This tool provides NLP-based analysis of presentation transcripts for the DHG learning platform.

## Features

- Entity extraction (general and medical)
- Keyword extraction
- Topic clustering
- Semantic embeddings for similarity search
- Hierarchical taxonomy generation

## Installation

1. Create a Python virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Download spaCy models:
```bash
# Basic English model
python -m spacy download en_core_web_sm

# Medical/Scientific model (optional for Phase 2)
pip install https://s3-us-west-2.amazonaws.com/ai2-s2-scispacy/releases/v0.5.3/en_core_sci_md-0.5.3.tar.gz
```

4. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your Supabase credentials
```

## Usage

### Basic Analysis
```bash
python analyze_presentations.py --presentation-id <uuid>
```

### Batch Processing
```bash
python analyze_presentations.py --batch --limit 10
```

### Generate Embeddings
```bash
python generate_embeddings.py --all
```

### Cluster Topics
```bash
python cluster_topics.py --n-clusters 10
```

## Architecture

```
nlp_presentation_analysis/
├── analyzers/
│   ├── __init__.py
│   ├── base_analyzer.py      # Base class for analyzers
│   ├── entity_extractor.py   # Entity extraction logic
│   ├── keyword_extractor.py  # Keyword extraction
│   └── embedding_generator.py # Semantic embeddings
├── models/
│   ├── __init__.py
│   └── presentation.py       # Data models
├── db/
│   ├── __init__.py
│   ├── supabase_client.py   # Supabase connection
│   └── queries.py           # Database queries
├── utils/
│   ├── __init__.py
│   └── text_preprocessing.py # Text cleaning utilities
├── scripts/
│   ├── setup_tables.sql     # Database schema
│   └── seed_data.py         # Test data
├── analyze_presentations.py  # Main CLI
├── generate_embeddings.py    # Embedding generation
├── cluster_topics.py         # Topic clustering
└── api.py                   # FastAPI server (optional)
```

## Development Phases

### Phase 1: Basic Entity Extraction (Current)
- General entity extraction with spaCy
- Keyword extraction
- Basic database integration

### Phase 2: Medical Entity Recognition
- Integrate scispaCy for medical entities
- Improve entity classification
- Add confidence scoring

### Phase 3: Semantic Analysis
- Generate embeddings with sentence-transformers
- Implement similarity search
- Create presentation recommendations

### Phase 4: Topic Clustering
- Apply K-means clustering
- Generate topic hierarchies
- Map topic dependencies
