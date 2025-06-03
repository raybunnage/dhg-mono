# Continuously Updated Documents

This folder contains documents that are tracked for continuous updates. These are key project documents that need to be kept current as the project evolves.

## Purpose

As the project grows and evolves, certain documents need regular updates to remain relevant:
- Technical specifications that guide ongoing development
- Core documentation like CLAUDE.md that prevents recurring issues
- Key guides that are referenced frequently

## How It Works

1. **Adding Documents**: Use the documentation CLI to add documents to continuous tracking:
   ```bash
   ./scripts/cli-pipeline/documentation/documentation-cli.sh add-continuous <path> [category] [frequency]
   ```

2. **Update Frequencies**:
   - `daily` - Updated every 24 hours
   - `weekly` - Updated every 7 days (default)
   - `on-change` - Updated whenever the source file changes

3. **Automatic Updates**: Run the update command to refresh all tracked documents:
   ```bash
   ./scripts/cli-pipeline/documentation/documentation-cli.sh update-continuous
   ```

## Categories

Documents are organized by category:
- `project-instructions/` - Core project files like CLAUDE.md
- `technical-specs/` - Active technical specifications
- `solution-guides/` - Frequently referenced solutions
- `deployment/` - Deployment and environment guides
- `general/` - Other important documents

## Tracking

The `.tracking.json` file maintains metadata about all tracked documents including:
- Original source path
- Update frequency
- Last update timestamp
- Category and description

## Commands

```bash
# List all tracked documents
./scripts/cli-pipeline/documentation/documentation-cli.sh list-continuous

# Update all documents that are due
./scripts/cli-pipeline/documentation/documentation-cli.sh update-continuous

# Force update all documents
./scripts/cli-pipeline/documentation/documentation-cli.sh update-continuous --force

# Add a new document to tracking
./scripts/cli-pipeline/documentation/documentation-cli.sh add-continuous <path>
```