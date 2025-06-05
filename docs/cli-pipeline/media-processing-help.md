# Presentations Pipeline CLI Help

## Overview

The presentations pipeline provides commands for managing expert presentations, including generating AI summaries from transcriptions, creating expert profiles, and managing presentation assets.

## Available Commands

### generate-summary

Generates AI summaries from presentation transcripts using Claude AI.

```
Usage: presentations-cli generate-summary [options]

Generate AI summary from presentation transcripts using Claude

Options:
  -p, --presentation-id <id>   Presentation ID to generate summary for (process just one presentation)
  -e, --expert-id <id>         Expert ID to generate summaries for (filter by expert)
  -f, --force                  Force regeneration of summary even if it already exists (default: false)
  --dry-run                    Preview mode: generate summaries but do not save them to the database (default: false)
  -l, --limit <limit>          Maximum number of presentations to process (default: "5")
  -o, --output <path>          Output file path for the JSON results (default: "presentation-summaries.json")
  --folder-id <id>             Filter presentations by Google Drive folder ID (default: "1wriOM2j2IglnMcejplqG_XcCxSIfoRMV")
  --format <format>            Summary format style:
                                 - concise: 2-3 paragraph summary (default)
                                 - detailed: 5-7 paragraph thorough summary with supporting evidence
                                 - bullet-points: 5-10 bullet points covering key presentation points
  --status <status>            Filter by presentation status (default: "make-ai-summary")
  -h, --help                   display help for command
```

### Examples

```bash
# Generate summaries for up to 5 presentations with a detailed format
presentations-cli generate-summary --format detailed

# Generate summary for a specific presentation in bullet-point format (dry run)
presentations-cli generate-summary --presentation-id 1234abcd --format bullet-points --dry-run

# Process presentations for a specific expert
presentations-cli generate-summary --expert-id 5678efgh --limit 10
```

### Common Use Cases

1. **Preview summaries before saving**: Use the `--dry-run` flag to see what summaries would be generated without saving to the database.

2. **Customize summary format**:
   - `--format concise`: Generate a brief 2-3 paragraph overview (default)
   - `--format detailed`: Create a comprehensive 5-7 paragraph summary with supporting details
   - `--format bullet-points`: Generate 5-10 key points in bullet format

3. **Process a specific presentation**: Use `--presentation-id` to target a single presentation.

4. **Batch process**: Control how many presentations are processed with `--limit`.

5. **Force regeneration**: Use `--force` to update summaries even if they already exist.

## Other Commands

For detailed help on other presentation pipeline commands, run:
```
presentations-cli [command] --help
```