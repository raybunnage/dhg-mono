# ClassifyDocument.tsx Component Explanation

## Overview
The `ClassifyDocument.tsx` component is a React page that handles document classification and processing in the DHG Improve Experts application. It interacts with the Supabase database and uses AI processing to classify, extract content from, and analyze documents.

## Main Functionality

### Authentication
- `ensureAuth()`: Handles authentication with Supabase, either using an existing session or logging in with test credentials.
- The component checks authentication status on load and shows appropriate UI based on authentication state.

### Document Content Extraction
- `extractDocxContent()`: Extracts content from DOCX files stored in Google Drive.
- Uses the `getDocxContent()` utility to process Word documents and store their content in the database.
- Provides progress tracking and allows stopping the extraction process.

### Document Classification
- `classifyDocuments()`: Processes documents with extracted content to determine their document type.
- Uses AI processing to analyze document content and assign a document type.
- Updates documents with classification metadata including confidence scores and reasoning.

### Document Management
- `transferToExpertDocuments()`: Transfers classified documents to the expert_documents table.
- `updateClassificationMetadata()`: Updates metadata for already classified documents.
- `processPresentationAnnouncements()`: Processes presentation announcements with AI to extract expert information.

### Diagnostic and Debug Functions
- `runDebugQueries()`: Runs diagnostic queries on the document_types table.
- `checkAuthAndTableAccess()`: Verifies authentication and database access.
- `checkTableStructure()`: Examines the structure of the document_types table.
- `checkDocxCount()`: Counts DOCX files that need extraction.
- `checkExtractedContent()`: Checks extracted content for specific documents.
- `checkProcessedPresentations()`: Reviews processed presentation announcements.

## UI Components and Buttons

| Button | Function | Description |
|--------|----------|-------------|
| 🏷️ Classify Documents | `classifyDocuments()` | Classifies unclassified documents with extracted content using AI |
| ➕ Add Presentation Type | `addPresentationAnnouncementType()` | Adds a "Presentation Announcement" document type to the database |
| 📄 Extract Content | `extractDocxContent()` | Extracts text content from DOCX files stored in Google Drive |
| ⏹️ Stop Extraction | `stopExtraction()` | Stops the ongoing content extraction process |
| 📥 Download Results | `downloadResults()` | Downloads classification results as a markdown file |
| Run Diagnostics | `runDebugQueries()` | Runs diagnostic queries on the document_types table |
| Check Auth/DB Access | `checkAuthAndTableAccess()` | Verifies authentication and database access |
| Check Table Structure | `checkTableStructure()` | Examines the structure of the document_types table |
| 📝 Update Classification Metadata | `updateClassificationMetadata()` | Updates metadata for already classified documents |
| Check Extracted Content | `checkExtractedContent()` | Checks extracted content for specific documents |
| 🤖 Classify New Content | `classifyNewContent()` | Classifies documents extracted today |
| 📋 Show Today's Classifications | `showTodaysClassifications()` | Displays documents classified today |
| 📋➡️ Transfer to Expert Documents | `transferToExpertDocuments()` | Transfers classified documents to expert_documents table |
| 🎯 Process Presentations | `processPresentationAnnouncements()` | Processes presentation announcements to extract expert information |
| 🎯 Check Processed Presentations | `checkProcessedPresentations()` | Reviews processed presentation announcements |

## Usage Instructions

### Document Processing Workflow

1. **Authentication**: The component automatically handles authentication on load.

2. **Extract Document Content**:
   - Click "Extract Content" to process DOCX files from Google Drive.
   - This will extract text content and store it in the database.
   - You can stop the extraction process with the "Stop Extraction" button.

3. **Classify Documents**:
   - Click "Classify Documents" to analyze documents with extracted content.
   - The system will assign document types and update the database.
   - Classification results will be displayed and can be downloaded.

4. **Process Specialized Documents**:
   - For presentation announcements, click "Process Presentations" to extract expert information.
   - Click "Transfer to Expert Documents" to move classified documents to the expert_documents table.

5. **Verify and Monitor**:
   - Use "Show Today's Classifications" to view recent classification results.
   - Use the diagnostic buttons to check database state and content extraction.

## Technical Details

- Uses Claude AI (via Anthropic API) for document classification and content analysis
- Interacts with Google Drive to access and process documents
- Uses Supabase for database operations and authentication
- Implements TypeScript interfaces for type safety
- Uses React hooks for state management (useState, useEffect, useRef)
- Implements schema validation with Zod

## Database Structure
The component interacts with several tables in the Supabase database:
- `document_types`: Stores document type definitions
- `sources_google`: Stores documents from Google Drive with extracted content
- `expert_documents`: Stores processed documents for expert analysis