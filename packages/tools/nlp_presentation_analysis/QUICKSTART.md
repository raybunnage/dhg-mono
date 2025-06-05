# NLP Presentation Analysis Tool

This directory contains the NLP analysis tools for processing DHG presentation content.

## Quick Start

1. **Install dependencies**:
```bash
cd packages/tools/nlp_presentation_analysis
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
python -m spacy download en_core_web_sm
```

2. **Set up environment**:
```bash
cp .env.example .env
# Edit .env with your Supabase credentials
```

3. **Create database tables**:
```sql
-- Run the SQL in scripts/setup_tables.sql in your Supabase SQL editor
```

4. **Test the analyzers**:
```bash
python test_analyzers.py
```

5. **Analyze presentations**:
```bash
# Analyze a single presentation
python analyze_presentations.py --presentation-id <uuid>

# Batch process unanalyzed presentations
python analyze_presentations.py --batch --limit 10

# Dry run to test without saving
python analyze_presentations.py --batch --limit 1 --dry-run
```

## Features Implemented

### Phase 1 (Current):
- ✅ Entity extraction (general)
- ✅ Keyword extraction (frequency, TF-IDF, POS patterns)
- ✅ Embedding generation
- ✅ Database integration
- ✅ CLI tools

### Ready for Phase 2:
- Medical entity extraction (with scispaCy)
- Topic clustering
- Similarity search

## Project Structure

```
nlp_presentation_analysis/
├── analyzers/           # NLP analysis modules
├── db/                  # Database integration
├── models/              # Data models
├── utils/               # Text processing utilities
├── scripts/             # Database setup scripts
├── analyze_presentations.py    # Main CLI
├── generate_embeddings.py      # Embedding generation
├── cluster_topics.py           # Topic clustering
└── test_analyzers.py           # Test suite
```

## Next Steps

1. Run test script to verify installation
2. Analyze a few presentations with dry-run
3. Review extracted entities and keywords
4. Adjust parameters as needed
5. Run full batch processing
