# Document Archiving System Fix

This document details the solution implemented to fix document archiving functionality in the DHG platform. The solution addresses reliability issues with the "Archive" button on the Docs page by implementing a standalone server approach that leverages patterns already working elsewhere in the codebase.

## Problem Overview

The document archiving functionality on the Docs page was not working reliably, particularly in production environments. The issues included:

1. Netlify function approach wasn't properly configured in all environments
2. Path resolution was inconsistent, leading to "file not found" errors
3. API response handling had edge cases that weren't properly addressed
4. Different environments (local, staging, production) behaved differently

## Solution Architecture

The implemented solution follows a multi-layered approach with fallbacks:

```
┌─────────────────┐     ┌───────────────────────┐     ┌─────────────────────────────┐
│  UI Component   │────▶│ markdownFileService   │────▶│ 1. Standalone Server (3003) │
│  Archive Button │     │ archiveFile() method  │     └─────────────────────────────┘
└─────────────────┘     └───────────────────────┘                   │
                                    │                               ▼
                                    │                     ┌─────────────────────────┐
                                    │                     │ If server not available │
                                    │                     └─────────────────────────┘
                                    │                               │
                                    │                               ▼
                                    │                   ┌───────────────────────────┐
                                    └──────────────────▶│ 2. Netlify API Function   │
                                                        └───────────────────────────┘
```

## Implemented Components

### 1. Standalone Document Archive Server

Created a new standalone server (`docs-archive-server.js`) based on the successful script server model:

- Simple Node.js HTTP server running on port 3003
- Handles file operations directly with robust path resolution
- Implements CORS for cross-origin requests in development
- Provides endpoints for file retrieval, archiving, and deletion
- Follows the same patterns as the working script-server.js

Key features of this server:
- Multiple path resolution strategies to find files reliably
- Creates `.archive_docs` folders as needed
- Shell command fallbacks when Node.js file operations fail
- Detailed logging for easier debugging
- No dependencies on Netlify deployment

### 2. Updated markdownFileService Client

Modified the `markdownFileService.ts` file to implement a cascading fallback approach:

- First attempts to use the standalone server if running
- Falls back to legacy local servers if available
- Finally uses the Netlify function API as a last resort
- Proper error handling and timeouts for reliability
- Improved response parsing with fallbacks

The updated archiveFile method now:
- Tries the standalone server first with a 3-second timeout
- Falls back to the Netlify function if needed
- Handles JSON parsing errors gracefully
- Provides better error messages
- Returns a consistent response format

### 3. Support Scripts and Documentation

Created additional files to support the solution:

- `run-docs-archive-server.sh`: Simple shell script to start the server
- `docs-archive-server.README.md`: Documentation for the standalone server
- Updated `DOCUMENT_ARCHIVING_GUIDE.md` with information about both approaches

## Implementation Details

### Standalone Server Implementation

The `docs-archive-server.js` file implements four key endpoints:

1. **GET /api/doc-file?path=...** - Retrieves document content
2. **GET /api/doc-files** - Lists all document files
3. **POST /api/doc-file/archive** - Archives a document file
4. **DELETE /api/doc-file?path=...** - Deletes a document file

The archive endpoint:
1. Validates the incoming path
2. Searches for the file in multiple possible locations
3. Creates an `.archive_docs` folder if needed
4. Moves the file to that folder
5. Returns the new path for database updates

### Client-Side Integration

The `markdownFileService.ts` archiveFile method was modified to:

1. First try the standalone server at http://localhost:3003 in development
2. Implement proper timeout handling with AbortController
3. Fall back to the original API endpoint if needed
4. Parse responses safely and handle errors consistently

Similar pattern was applied to the deleteFile method to ensure consistency.

## Deployment Considerations

The solution works in all environments:

1. **Local Development**: Start the standalone server with `./scripts/run-docs-archive-server.sh`
2. **Staging/Production**: Either:
   - Deploy the standalone server as a background service
   - Or rely on the Netlify function fallback

## Benefits

This solution provides several advantages:

1. **Reliability**: Multiple fallback mechanisms ensure operations work in all environments
2. **Consistency**: Same approach as the script-server.js that's already working well
3. **Simplicity**: Direct file system access is easier to understand and debug
4. **Maintainability**: Standalone approach avoids Netlify deployment complexities
5. **Debugging**: Detailed logging at each step makes troubleshooting easier

## Lessons Learned

1. Simple, proven patterns often outperform complex ones
2. Direct file system access is more reliable than API proxies
3. Multiple fallback strategies improve overall system reliability
4. Leveraging working patterns from elsewhere in the codebase speeds development
5. Standalone servers can offer a more robust solution than serverless functions for file operations

## Future Improvements

Potential enhancements to consider:

1. Consolidate both script and document servers into a single file operations service
2. Add monitoring and auto-restart capabilities to the standalone server
3. Implement batched operations for multiple files
4. Add database integration directly to the standalone server
5. Implement file versioning instead of simple archiving