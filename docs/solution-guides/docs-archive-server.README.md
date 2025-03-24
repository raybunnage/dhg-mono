# Docs Archive Server

A standalone server for document file management operations, particularly focused on archiving documentation files.

## Overview

This server provides a simple, reliable way to perform file operations on documentation files (markdown, text, etc.) via HTTP API endpoints. It's designed to be similar to the `simple-script-server.js` approach but specialized for document files.

## Key Features

- Retrieve document file content
- List available document files
- Archive document files to an `.archive_docs` folder
- Delete document files
- No Netlify function or deployment dependencies

## Installation

No installation is needed. The server is a standalone Node.js script.

## Usage

### Starting the Server

```bash
node scripts/docs-archive-server.js
```

This will start the server on port 3003 by default.

### API Endpoints

#### 1. Get File Content

```
GET /api/doc-file?path=path/to/file.md
```

Returns the content of the specified document file.

#### 2. List Document Files

```
GET /api/doc-files
```

Returns a list of all document files in the repository.

#### 3. Archive a File

```
POST /api/doc-file/archive
```

Request body:
```json
{
  "path": "path/to/file.md"
}
```

Moves the file to an `.archive_docs` folder in the same directory.

#### 4. Delete a File

```
DELETE /api/doc-file?path=path/to/file.md
```

Deletes the specified document file.

## Implementation Details

- The server looks for files in multiple possible locations to handle different repository structures.
- For archive operations, it creates `.archive_docs` folders as needed.
- All operations include extensive error handling and fallbacks.
- The server supports CORS for local development.

## Integration with markdownFileService

The `markdownFileService.ts` has been updated to try using this server first for file operations, with fallbacks to the original API endpoints. This provides better reliability and simpler operation than relying on Netlify functions.

## Running in Production

For production, this server can run as a background process, or you can use the fallback Netlify functions that are already configured.

## Benefits Over Netlify Functions

1. Simpler to understand and modify
2. More direct file system access
3. Better control over file paths and directories
4. No dependency on Netlify deployment
5. Works in all environments (local, staging, production)

## Example Responses

### Successful Archive

```json
{
  "success": true,
  "message": "File docs/example.md archived successfully",
  "original_path": "docs/example.md",
  "newPath": "docs/.archive_docs/example.md"
}
```

### Successful Delete

```json
{
  "success": true,
  "message": "File docs/example.md deleted successfully",
  "file_path": "docs/example.md"
}
```