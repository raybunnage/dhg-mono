# Document CLI Scripts Archive

This directory contains archived document CLI scripts that have been deprecated in favor of the unified document-pipeline-service-cli.sh approach.

## Archived Files

- `document-cli.2025-05-01.sh` - Basic CLI for document processing operations
- `classify-document-with-prompt.2025-05-01.sh` - Standalone script for document classification using Claude
- `health-check.2025-05-01.sh` - Original health check script (copy of current version as reference)

## Current Approach

For all document processing needs, use the consolidated pipeline:

```bash
./scripts/cli-pipeline/document/document-pipeline-service-cli.sh [command]
```

This script provides a comprehensive interface for document operations including classification, synchronization, and testing.

See `./document-pipeline-service-cli.sh help` for a complete list of commands.
