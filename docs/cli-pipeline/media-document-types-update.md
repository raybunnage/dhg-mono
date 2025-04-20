# Media Document Types Update

This document describes updates to the `list` command in the Google Sync CLI pipeline to exclude media files and folders.

## Excluded File Types

The `list-google-sources.ts` command has been updated to exclude the following file types:

1. Video files (`*.mp4`) with MIME type `video/mp4`
2. Audio files (`*.m4a`) with MIME type `audio/x-m4a`
3. Folders with MIME type `application/vnd.google-apps.folder`

## Implementation Details

The exclusion is implemented using the Supabase query builder's `.not()` method to filter out records based on their MIME type:

```typescript
// Filter out mp4, m4a, and folder files
query = query.not('mime_type', 'ilike', '%video/mp4%')
             .not('mime_type', 'eq', 'audio/x-m4a')
             .not('mime_type', 'ilike', '%application/vnd.google-apps.folder%');
```

This filter is applied after any name filters but before expert-based filtering, ensuring that the specified file types are excluded regardless of other filter criteria.

## Usage

The command usage remains the same:

```bash
./google-sync-cli.sh list [options]
```

Options:
- `-l, --limit <number>`: Maximum number of sources to list (default: 100)
- `-f, --filter <string>`: Filter sources by name
- `-e, --expert <string>`: Filter sources by expert name
- `-o, --output <path>`: Output file path for the report
- `-s, --sort-by <field>`: Sort results by field (name, updated, type) (default: name)

## Example Output

The output will now only include document files (like .docx, .pdf, etc.) and exclude any media files and folders.

```
| Source Name | Document Type | Has Expert Doc | Expert Doc Type | Raw Content Preview | Has JSON | Processed Content Preview |
|-------------|---------------|----------------|-----------------|---------------------|----------|---------------------------|
| example.docx | Meeting Notes | Yes | Meeting Transcript | Title: Project Status Meeting... | Yes | {"key_topics":["Project timeline"... |
```

## Benefits

This update:
1. Makes the list output more focused on text-based documents that can be analyzed
2. Reduces clutter from media files that are handled by separate commands
3. Improves report readability by focusing on the most relevant document types