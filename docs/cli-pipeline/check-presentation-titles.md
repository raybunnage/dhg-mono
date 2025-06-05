# Check Presentation Titles CLI Command

## Description

The `check-presentation-titles` command queries the database to compare presentation titles with their AI-generated processed content. This helps identify presentations where the title may not accurately reflect the content.

## Usage

```bash
./scripts/cli-pipeline/presentations/presentations-cli.sh check-presentation-titles [options]
```

## Options

- `-o, --output-path <path>` - Path to write report to (default: docs/cli-pipeline/presentation-titles-check.md)
- `-l, --limit <number>` - Limit the number of presentations to check (default: 100)

## Example Usage

```bash
# Basic usage with default settings
./scripts/cli-pipeline/presentations/presentations-cli.sh check-presentation-titles

# Specify output path and increase limit
./scripts/cli-pipeline/presentations/presentations-cli.sh check-presentation-titles --output-path ./custom-path.md --limit 200
```

## Output

The command generates a markdown report containing:

1. A table with columns:
   - Folder - The high-level folder name
   - Presentation - The current presentation title
   - Expert Title - The title from the expert document
   - Processed Content Preview - A preview of the AI-processed content

2. Instructions for updating titles when necessary

## SQL Query

The command uses the following query structure:

```sql
SELECT
  sf.name as folder,
  sg.name as source_name,
  p.title as presentation_title,
  e.title as expert_title,
  e.processed_content as processed_content
FROM presentations p 
JOIN expert_documents e ON p.expert_document_id = e.id
JOIN sources_google sg ON p.video_source_id = sg.id
JOIN sources_google sf ON p.high_level_folder_source_id = sf.id
WHERE e.processed_content IS NOT NULL
LIMIT 100
```

This report helps maintain data quality by ensuring presentation titles accurately reflect their content.