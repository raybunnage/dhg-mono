# Multi-Dimensional Tagging System for Presentations

This module implements a comprehensive tagging system that categorizes presentations across multiple dimensions to enable intelligent content matching and recommendations.

## Overview

The system tags each presentation across 8 key dimensions:

1. **Topic/Subject** - Primary content area (hierarchical)
2. **Application Context** - Where/how knowledge is applied
3. **Complexity Level** - Depth and sophistication (1-10 scale)
4. **Approach Type** - Theoretical vs. practical focus
5. **Evidence Level** - Research maturity
6. **Patient Population** - Relevant demographics
7. **Temporal Relevance** - Currency of information
8. **Learning Modality** - Presentation style

## Quick Start

```bash
# Install dependencies
pip install -r requirements.txt

# Run interactive tagging for a single presentation
python tag_presentation.py --presentation-id <uuid>

# Batch process with automated suggestions
python batch_tag_presentations.py --auto-suggest

# Generate tagging report
python generate_tagging_report.py
```

## Architecture

```
presentation_tagging/
├── dimensions/              # Dimension definitions and validators
│   ├── __init__.py
│   ├── base_dimension.py
│   ├── topic_dimension.py
│   ├── complexity_dimension.py
│   └── ...
├── taggers/                # Automated tagging logic
│   ├── __init__.py
│   ├── nlp_tagger.py      # NLP-based auto-tagging
│   ├── rule_tagger.py     # Rule-based tagging
│   └── ml_tagger.py       # ML-based suggestions
├── validators/             # Tag validation
│   ├── __init__.py
│   └── tag_validator.py
├── ui/                     # Interactive tagging interface
│   ├── __init__.py
│   └── cli_interface.py
├── db/                     # Database operations
│   ├── __init__.py
│   └── tag_storage.py
├── tag_presentation.py     # Main CLI for single presentation
├── batch_tag_presentations.py  # Batch processing
└── generate_tagging_report.py  # Analytics and reporting
```

## Tagging Process

1. **Automated Analysis** - NLP extracts initial suggestions
2. **Rule Application** - Domain rules refine suggestions
3. **Human Review** - Expert validates and adjusts
4. **Quality Check** - Ensures completeness and consistency
5. **Storage** - Saves to database with audit trail

## Dimension Details

See `docs/dimension_definitions.md` for complete documentation of each dimension.
