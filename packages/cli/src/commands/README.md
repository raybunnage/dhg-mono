# CLI Commands

This directory contains the command definitions for the CLI tool.

## Document Commands

The document commands provide an interface to the document pipeline functionality. They are accessible via:

```bash
ai-workflow document <command>
```

Available commands:

| Command | Description | Options |
|---------|-------------|---------|
| `show-recent` | Show recent document files | `-c, --count` - Number of files to show (default: 20) |
| `find-new` | Find and insert new document files | None |
| `show-untyped` | Show all files without a document type | None |
| `classify-recent` | Classify the most recent files | `-c, --count` - Number of files to process (default: 20) |

### Examples

```bash
# Show 10 recent document files
ai-workflow document show-recent --count 10

# Find and insert new document files
ai-workflow document find-new

# Show untyped document files
ai-workflow document show-untyped

# Classify 5 recent document files
ai-workflow document classify-recent --count 5
```

## Implementation Details

The document commands are implemented as a bridge to the existing shell scripts in `scripts/cli-pipeline/` directory. As part of our gradual migration strategy, these commands use the `DocumentPipelineService` to execute the shell scripts.

In the future, these commands will be reimplemented in TypeScript to provide better type safety, error handling, and extensibility.

## Adding New Commands

To add a new document command:

1. Add a method to the `DocumentPipelineService` class
2. Create a new command in `document-commands.ts`
3. Add the command to the document command group

See the existing implementations for examples.