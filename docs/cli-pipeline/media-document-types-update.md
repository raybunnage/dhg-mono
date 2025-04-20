# Media Document Types Update

This document describes updates to the Google Sync CLI pipeline for handling media document types, including rules for updating document types in both sources_google and expert_documents tables.

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
- `-l, --limit <number>`: Maximum number of sources to list (default: 1000)
- `-f, --filter <string>`: Filter sources by name
- `-e, --expert <string>`: Filter sources by expert name
- `-o, --output <path>`: Output file path for the report
- `-s, --sort-by <field>`: Sort results by field (name, updated, type) (default: name)
- `-c, --console`: Display results in console table format instead of generating markdown

## Example Output

The output will now only include document files (like .docx, .pdf, etc.) and exclude any media files and folders.

### Markdown Output (Default)
```
| Source Name | Document Type | Has Expert Doc | Expert Doc Type | Raw Content Preview | Has JSON | Processed Content Preview |
|-------------|---------------|----------------|-----------------|---------------------|----------|---------------------------|
| example.docx | Meeting Notes | Yes | Meeting Transcript | Title: Project Status Meeting... | Yes | {"key_topics":["Project timeline"... |
```

### Console Table Output (with --console flag)
```
Google Drive Sources and Expert Documents:
====================================================================================================================================
Source Name                    | Document Type      | Has Expert | Expert Doc Type    | Raw Content Preview  | Has JSON | Processed Content Preview
------------------------------------------------------------------------------------------------------------------------------------
example.docx                   | Meeting Notes      | Yes        | Meeting Transcri   | Title: Project Sta   | Yes      | {"key_topics":["Project 
planning.docx                  | Business Document  | Yes        | Business Plan      | Business Plan for    | Yes      | {"company":"Acme Corp", 
proposal.pdf                   | Proposal           | Yes        | Project Proposal   | Project Proposal:    | Yes      | {"project_name":"Alpha  
------------------------------------------------------------------------------------------------------------------------------------
Total sources: 3
Sources with expert documents: 3
Total expert documents: 3
```

## Document Type Updates

The `update-media-document-types` command applies the following document type update rules:

### JSON Content Processing Rules

1. If there is JSON in the processed_content field in expert_document and the document_type_id in sources_google is "46dac359-01e9-4e36-bfb2-531da9c25e3f" (Document): 
   - Set the document_type_id in expert_documents = "1f71f894-d2f8-415e-80c1-a4d6db4d8b18" (Document)

2. If there is JSON in the processed_content field in expert_document and the document_type_id in sources_google is "03743a23-d2f3-4c73-a282-85afc138fdfd" (Working Document):
   - Set the document_type_id in expert_documents = "5b1f8963-0946-4e89-884d-30517eebb8a5" (Json Expert Summary)

3. If the name of the file in sources_google ends in .conf:
   - Set the document type in sources_google to "c1a7b78b-c61e-44a4-8b77-a27a38cbba7e" (Configuration File)
   - Set the expert_document_id to "1f71f894-d2f8-415e-80c1-a4d6db4d8b18" (Document)

4. If the record in sources_google has one of these document_type_ids, set expert_document_id to "1f71f894-d2f8-415e-80c1-a4d6db4d8b18" (Document):
   - "c62f92f5-6123-4324-876d-14639841284e" (Publication)
   - "83849c95-823e-4f8b-bf47-4318ae014f16" (Calendar)
   - "98ac1e77-2cff-474a-836e-4db32a521a16" (Worksheet)
   - "5eb89387-854c-4754-baf8-3632ac286d92" (Whitepaper)
   - "e886b004-b90c-4130-bfa7-971d084e88ec" (Article)
   - "ab90f374-00f6-4220-90e0-91b2054eafad" (News)
   - "eca21963-c638-4435-85f5-0da67458995c" (Technical Document)
   - "f2fd129e-a0ad-485d-a457-ec49736010a9" (Manual)
   - "bb90f01f-b6c4-4030-a3ea-db9dd8c4b55a" (Guide)

### Additional Processing Rules

1. If there is JSON in the related processed_content field in expert_document and the JSON field starts with {"title":
   - Set the document_type_id in expert_documents to "5b1f8963-0946-4e89-884d-30517eebb8a5" (Json Expert Summary)

2. If there is no JSON in the related processed_content:
   - Add a new field in the metadata field in expert_documents: needs_reprocessing = true

3. If there is JSON in the related processed_content field in expert_document:
   - If the document_type_id in sources_google is "e9d3e473-5315-4837-9f5f-61f150cbd137" (Research Paper)
   - And the processed content has "File analysis unavailable" in it somewhere
   - Then add a new field in the metadata field in expert_documents: needs_reprocessing = true

4. If the mime_type in sources_google is a folder:
   - Add a new field in the metadata field in expert_documents: needs_reprocessing = true 

5. If the sources_google document_type_id is "ea74c86e-7f22-4ecf-ae16-0430291995e2" (Spreadsheet):
   - Set the document_type_id in expert_documents to "1f71f894-d2f8-415e-80c1-a4d6db4d8b18" (Document)

6. If the sources_google document_type_id is "9ccdc433-99d8-46fb-8bf7-3ba72cf27c88" (Presentation):
   - Set the document_type_id in expert_documents to "2f5af574-9053-49b1-908d-c35001ce9680" (PDF/PPTX)

7. If the sources_google document_type_id is "5e61bfbc-39ef-4380-80c0-592017b39b71" (Technical Paper):
   - Set the document_type_id in expert_documents to "2f5af574-9053-49b1-908d-c35001ce9680" (PDF/PPTX)

8. The sources_google document_type_id "9dbe32ff-5e82-4586-be63-1445e5bcc548" (Unknown) is explicitly excluded from processing.

## Benefits

This update:
1. Makes the list output more focused on text-based documents that can be analyzed
2. Reduces clutter from media files that are handled by separate commands
3. Improves report readability by focusing on the most relevant document types
4. Correctly categorizes documents based on their content and source file characteristics
5. Flags documents that need reprocessing with a needs_reprocessing metadata flag