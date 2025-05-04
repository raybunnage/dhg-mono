# Document Classification Page Documentation

## Overview
The Document Classification page (`ClassifyDocument.tsx`) provides a suite of tools for managing, classifying, and processing documents in the DHG system. This page handles document classification, content extraction, and expert profile processing.

## Authentication
- The page automatically handles authentication using Supabase
- Uses test credentials from environment variables (VITE_TEST_USER_EMAIL, VITE_TEST_USER_PASSWORD)
- Shows authentication status in UI

## Main Functions and Buttons

### 1. Classify Documents 🏷️
**Button:** "Classify Documents"
**Function:** `classifyDocuments()`
- Loads document types from database
- Processes unclassified documents using AI
- Updates document classifications in database
- Shows results in UI with confidence scores

### 2. Add Presentation Type ➕
**Button:** "Add Presentation Type"
**Function:** `addPresentationAnnouncementType()`
- Adds "Presentation Announcement" document type if it doesn't exist
- Used for categorizing presentation-related documents

### 3. Extract Content 📄
**Button:** "Extract Content"
**Function:** `extractDocxContent()`
- Extracts text content from DOCX files in Google Drive
- Shows progress during extraction
- Can be stopped with "Stop Extraction" button
- Updates database with extracted content

### 4. Update Classification Metadata 📝
**Button:** "Update Classification Metadata"
**Function:** `updateClassificationMetadata()`
- Updates metadata for classified documents
- Adds timestamps and classification details
- Useful for maintaining document history

### 5. Classify New Content 🤖
**Button:** "Classify New Content"
**Function:** `classifyNewContent()`
- Processes only newly added documents
- Uses AI to determine document types
- Updates database with classifications

### 6. Show Today's Classifications 📋
**Button:** "Show Today's Classifications"
**Function:** `showTodaysClassifications()`
- Displays documents classified today
- Shows document types, confidence scores, and reasoning
- Presents results in a formatted list

### 7. Transfer to Expert Documents 📋➡️
**Button:** "Transfer to Expert Documents"
**Function:** `transferToExpertDocuments()`
- Moves classified documents to expert_documents table
- Preserves metadata and classifications
- Used for documents identified as expert-related

### 8. Process Presentations 🎯
**Button:** "Process Presentations"
**Function:** `processPresentationAnnouncements()`
- Processes documents classified as "Presentation Announcement"
- Extracts expert profiles using AI
- Updates database with structured expert information
- Shows processing progress and final summary

### 9. Check Processed Presentations 🎯
**Button:** "Check Processed Presentations"
**Function:** `checkProcessedPresentations()`
- Reviews processed presentation announcements
- Shows AI analysis results
- Displays processing status and timestamps

## Diagnostic Tools

### Run Diagnostics
**Button:** "Run Diagnostics"
**Function:** `runDebugQueries()`
- Checks database connectivity
- Verifies table structures
- Shows document counts and status

### Check Auth/DB Access
**Button:** "Check Auth/DB Access"
**Function:** `checkAuthAndTableAccess()`
- Verifies authentication status
- Tests database permissions
- Shows access levels

### Check Table Structure
**Button:** "Check Table Structure"
**Function:** `checkTableStructure()`
- Validates database schema
- Shows table relationships
- Reports any structural issues

### Check Extracted Content
**Button:** "Check Extracted Content"
**Function:** `checkExtractedContent()`
- Reviews extracted document content
- Validates content format
- Shows extraction statistics

## Key Data Structures

### Expert Profile Schema
```typescript
const ExpertProfileSchema = z.object({
  basic_information: z.object({
    name: z.string(),
    title: z.string().default(""),
    current_position: z.string().default(""),
    institution: z.string().default(""),
    credentials: z.union([
      z.array(z.string()),
      z.string().transform(str => str ? [str] : [])
    ]).default([]),
    specialty_areas: z.union([
      z.array(z.string()),
      z.string().transform(str => str ? [str] : [])
    ]).default([])
  }),
  research_summary: z.string().default(""),
  notable_achievements: z.array(z.string()).default([]),
  professional_links: z.object({
    website_urls: z.array(z.string()).default([]),
    social_media: z.array(z.string()).default([])
  }).default({}),
  expertise_keywords: z.array(z.string()).default([])
});
```

## Error Handling
- All functions include error handling and user feedback
- Errors are logged to console with details
- User-friendly error messages via toast notifications
- Failed operations are tracked and reported

## Best Practices
1. Always check authentication status before operations
2. Use the diagnostic tools to verify system state
3. Monitor processing progress in console logs
4. Review today's classifications regularly
5. Check processed presentations after batch processing

## Common Workflows

### Processing New Documents
1. Click "Extract Content" to get document text
2. Use "Classify Documents" to categorize
3. Review results in "Today's Classifications"
4. Transfer relevant documents to expert system

### Processing Presentations
1. Ensure documents are classified as "Presentation Announcement"
2. Click "Process Presentations" to extract expert profiles
3. Use "Check Processed Presentations" to verify results
4. Monitor console for detailed processing logs 