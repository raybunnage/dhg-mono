# Experts CLI Pipeline

Command-line utilities for managing experts and their associations with presentations, folders, and content.

## Overview

This CLI pipeline provides tools for:

- Creating and managing expert associations with sources_google folders
- Identifying top-level folders that need expert assignments
- Facilitating bulk operations for expert data management

## Installation

No additional installation required. The CLI is integrated into the monorepo.

## Usage

Run commands using the shell script wrapper:

```bash
./scripts/cli-pipeline/experts/experts-cli.sh [command] [options]
```

Or directly with ts-node:

```bash
ts-node scripts/cli-pipeline/experts/experts-cli.ts [command] [options]
```

## Available Commands

### link-top-level-folders

Lists top-level folders (path_depth = 0) with non-null main_video_id and displays commands to assign experts to them.

```bash
./scripts/cli-pipeline/experts/experts-cli.sh link-top-level-folders [options]
```

Options:
- `-d, --dry-run` - Show what would be done without making changes
- `-p, --primary` - Set all created associations as primary (default: true)
- `-v, --verbose` - Show more detailed output
- `-l, --limit <number>` - Limit number of folders shown (default: 50)
- `-s, --skip-assigned <boolean>` - Skip folders that already have experts (default: true)

Example:
```bash
# List top-level folders that need expert assignment
./scripts/cli-pipeline/experts/experts-cli.sh link-top-level-folders --verbose

# Show all folders including those already assigned
./scripts/cli-pipeline/experts/experts-cli.sh link-top-level-folders --skip-assigned=false

# Show more folders in the list
./scripts/cli-pipeline/experts/experts-cli.sh link-top-level-folders --limit 100
```

### assign-expert

Assigns an expert to a specific folder by creating a sources_google_experts record.

```bash
./scripts/cli-pipeline/experts/experts-cli.sh assign-expert [options]
```

Required options:
- `--folder-id <id>` - ID of the folder to assign the expert to
- `--expert-id <id>` - ID of the expert to assign

Additional options:
- `--primary <boolean>` - Set as primary expert (default: true)
- `-d, --dry-run` - Show what would be done without making changes
- `-v, --verbose` - Show more detailed output

Example:
```bash
# Assign an expert to a folder
./scripts/cli-pipeline/experts/experts-cli.sh assign-expert \
  --folder-id "abc123" \
  --expert-id "def456"

# Dry run to see what would happen
./scripts/cli-pipeline/experts/experts-cli.sh assign-expert \
  --folder-id "abc123" \
  --expert-id "def456" \
  --dry-run
```

### list-experts

Lists all experts in the system to help with the assignment process.

```bash
./scripts/cli-pipeline/experts/experts-cli.sh list-experts [options]
```

Options:
- `-l, --limit <number>` - Limit number of experts shown (default: 100)
- `-v, --verbose` - Show assignment command examples for each expert

Example:
```bash
# List all experts
./scripts/cli-pipeline/experts/experts-cli.sh list-experts

# Show detailed information with assignment commands
./scripts/cli-pipeline/experts/experts-cli.sh list-experts --verbose
```

## Development

To add new commands to this pipeline:

1. Create a new file in the `commands/` directory
2. Implement the command function with appropriate parameters
3. Add the command to the main CLI program in `experts-cli.ts`
4. Update this README with the new command details