# Document Type Restructuring Plan

## Overview

This document outlines a plan for restructuring the document types system to improve organization and clarity while maintaining the functionality of the existing system. The approach focuses on separating content classification from file format concerns and creating a hierarchical structure without requiring major changes to existing data.

## Current Issues

1. **Format/MIME Confusion**: Many document types are defined by file format ("xlsx document", "mp4 video") rather than content
2. **Processing Status Mixing**: Some types indicate processing stage ("ai cleaned presentation")
3. **Overly Specific Categories**: Many types that could be consolidated ("journal article", "research article")
4. **Inconsistent Naming**: Mixed formats ("Json pdf summary" vs "pdf document")
5. **Folder Structure Types**: Types for describing hierarchy, not content

## Proposed Solution

1. **Keep existing document_types table unchanged** for references
2. **Add a document_type_categories table** for grouping
3. **Add metadata fields to document_types** to create hierarchy
4. **Move format concerns to mime_types table**

## Database Schema Enhancements

```sql
-- New categories table
CREATE TABLE document_type_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_name TEXT NOT NULL UNIQUE,
  description TEXT
);

-- Alter existing document_types table (only additions, no changes to existing fields)
ALTER TABLE document_types
  ADD COLUMN category_id UUID REFERENCES document_type_categories(id),
  ADD COLUMN is_general_type BOOLEAN DEFAULT FALSE,
  ADD COLUMN parent_type_id UUID REFERENCES document_types(id),
  ADD COLUMN ai_prompt_template_id UUID,
  ADD COLUMN expected_json_schema JSONB;
```

## Document Type Categories

| Category ID | Category Name | Description |
|-------------|---------------|-------------|
| [uuid] | Academic | Academic and research-focused content |
| [uuid] | Documentation | Documentation about code, systems, and processes |
| [uuid] | Media | Presentations, lectures, and visual content |
| [uuid] | Correspondence | Professional communications |
| [uuid] | Transcripts | Transcribed content from audio/video |
| [uuid] | Analysis | Analytical documents and reports |
| [uuid] | Scripts | Automation and code scripts |
| [uuid] | Other | Miscellaneous content types |

## General to Specific Document Type Mapping

### Academic/Research

| General Document Type | Specific Document Types |
|----------------------|-------------------------|
| **Research Paper** | "journal article", "research article", "preprint" |
| **Review Article** | "review article" |
| **Thesis/Dissertation** | "thesis" |
| **Book/Monograph** | "book" |
| **Academic Biography** | "curriculum vitae", "professional biography" |

### Documentation

| General Document Type | Specific Document Types |
|----------------------|-------------------------|
| **Technical Specification** | "Technical Specification" |
| **Code Documentation** | "Code Documentation Markdown" |
| **User Guide** | "Document Processing Script" (when used for documentation) |
| **Project README** | "README" |
| **Solution Guide** | "Solution Guide" |
| **Environment Documentation** | "Deployment Environment Guide" |

### Media Content

| General Document Type | Specific Document Types |
|----------------------|-------------------------|
| **Presentation** | "powerpoint document", "ppt microsoft early powerpoint", "scientific presentation and discussion" |
| **Lecture** | "non science presentation" (when educational) |
| **Interview** | (Not explicitly in current list, but would include interview recordings) |
| **Discussion** | "science meeting discussion" |

### Correspondence

| General Document Type | Specific Document Types |
|----------------------|-------------------------|
| **Professional Communication** | "email correspondence", "letter" |
| **Announcement** | "Presentation Announcement", "press release" |
| **Editorial** | "editorial", "letter to the editor" |

### Transcripts

| General Document Type | Specific Document Types |
|----------------------|-------------------------|
| **Presentation Transcript** | "presentation transcript", "cleaned presentation transcript", "ai presentation transcript" |
| **Discussion Transcript** | "dicussion transcript", "cleaned discussion transcript", "ai discussion transcript" |
| **Interview Transcript** | (Could be added for interview transcriptions) |

### Analysis/Reports

| General Document Type | Specific Document Types |
|----------------------|-------------------------|
| **Data Report** | "report" (when data-focused) |
| **Analysis Document** | "Video Summary Transcript" |
| **Executive Summary** | "Json document summary", "Json pdf summary", "Json Expert Summary", "new work summary" |
| **Concept Analysis** | "concept map", "subject classfication summary" |

### Scripts/Code

| General Document Type | Specific Document Types |
|----------------------|-------------------------|
| **Utility Script** | "Utility Script", parts of "Build Automation Script" |
| **Data Processing Script** | "Data Processing Script" |
| **Deployment Script** | "Deployment Script", "CI CD Pipeline Script" |
| **Infrastructure Script** | "Environment Setup Script" |
| **Integration Script** | "Api Integration Script" |

### Other Content

| General Document Type | Specific Document Types |
|----------------------|-------------------------|
| **Narrative Document** | "story" |
| **Web Content** | "website", "url blog post" |
| **Structured Data** | "json file", "csv data" |
| **Database Document** | "SQL Create Table Statement", "sql database file", "Database Management Script" |
| **Unknown/Unclassified** | "unknown document type" |

## Format-Based Types (Candidates for Pruning)

These document types are primarily defined by their format rather than content and could be handled by MIME types instead:

| Format-Based Types | Notes |
|-------------------|-------|
| "m4a audio", "mp3 audio", "wav audio", "aac audio", "m3u file" | All audio formats but say nothing about content |
| "mp4 video", "video quicktime", "video mpeg", "video microsoft avi", "m4v" | All video formats but say nothing about content |
| "jpg image", "png image" | Image formats |
| "pdf document", "word document", "doc file", "txt file", "google doc" | Text document formats |
| "xlsx document", "google sheet" | Spreadsheet formats |
| "root folder", "high level folder", "low level folder", "drive" | Hierarchy positions, not content types |

## Implementation Strategy

1. **Phase 1: Add Structure**
   - Create document_type_categories table
   - Add hierarchy fields to document_types
   - Create general document types

2. **Phase 2: Establish Relationships**
   - Assign categories to all document types
   - Link specific types to general types

3. **Phase 3: Gradual Pruning**
   - Identify format-based types that can be replaced by MIME types
   - Migrate documents to appropriate content-based types
   - Remove unnecessary format-based types

## Benefits of This Approach

1. **Zero disruption to existing code**
   - document_type_id in sources_google and expert_documents stays exactly the same
   - No need to update any records in those tables

2. **Gradual migration path**
   - Add general types and categories at your own pace
   - No need to reclassify existing documents immediately

3. **Best of both worlds**
   - Keep the specificity needed for processing
   - Gain the organizational benefits of categories and general types

4. **Future flexibility**
   - If later deciding to fully migrate to using general types, the path is clear
   - Could eventually update sources_google.document_type_id to point to general types

## MIME Types Table Design

For handling format information that's currently mixed into document types:

```sql
CREATE TABLE mime_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mime_type TEXT NOT NULL UNIQUE,
  file_extensions TEXT[], -- Array of associated extensions
  category TEXT, -- broad category like 'audio', 'video', 'document'
  processing_priority INTEGER, -- helps determine processing order
  requires_transcription BOOLEAN DEFAULT FALSE,
  requires_text_extraction BOOLEAN DEFAULT FALSE,
  description TEXT
);
```

## Processing Status Fields

Add these to relevant tables to track document processing state:

```sql
ADD COLUMN processing_status TEXT CHECK (
  processing_status IN (
    'unprocessed', 
    'needs_extraction', 
    'needs_transcription',
    'needs_classification',
    'processed',
    'processing_failed',
    'skip_processing'
  )
),
ADD COLUMN processing_notes TEXT,
ADD COLUMN processing_timestamp TIMESTAMP;
```

This separation ensures document types describe only content, while other fields handle format and processing concerns.

## Database Migration Plan

To transition from the old `document_type` field to the new `name` field, follow these steps:

1. **Create a migration script**:
```sql
-- Add the new name column with the same values as document_type
ALTER TABLE document_types ADD COLUMN name TEXT;
UPDATE document_types SET name = document_type;
ALTER TABLE document_types ALTER COLUMN name SET NOT NULL;

-- Create a compatibility view for backward compatibility
CREATE OR REPLACE VIEW document_types_legacy AS
SELECT 
  id,
  name AS document_type,
  category,
  description,
  mime_type,
  file_extension,
  classifier,
  is_ai_generated,
  created_at,
  updated_at,
  required_fields,
  validation_rules,
  ai_processing_rules,
  is_general_type,
  prompt_id,
  expected_json_schema
FROM document_types;

-- Make name the primary identifier
ALTER TABLE document_types DROP COLUMN document_type;
```

2. **Update Client Code**:
   - Search for all references to `document_type` and update them to use `name` instead
   - Update all interfaces that define document types
   - Modify API calls that reference the document type field

3. **Database View Strategy**:
   - The `document_types_legacy` view provides backward compatibility
   - Legacy code can still reference the `document_type` field through this view
   - New code should use the `name` field directly

4. **Testing Plan**:
   - Test all document classification functionality
   - Verify document type lookup works in all contexts
   - Ensure AI classification still works correctly
   - Test all CLI commands related to document types

## AI Integration for Classification

With the updated structure, you can now leverage the hierarchical relationship between general document types and specific subtypes for better AI classification:

```typescript
// When classifying a document
const getClassificationContext = async (documentContent: string) => {
  // Get all general document types
  const { data: generalTypes } = await supabase
    .from('document_types')
    .select('*')
    .eq('is_general_type', true);
    
  // First pass: Use general types for broad classification
  const generalTypeResult = await claudeService.sendPrompt(`
    Given the following document content: 
    
    ${documentContent.substring(0, 1500)}... 
    
    Which of these general document categories does it most likely belong to?
    
    ${generalTypes.map(type => `- ${type.name}: ${type.description}`).join('\n')}
    
    Return only the name of the best matching category.
  `);
  
  // Get specific subtypes for the identified general type
  const { data: specificTypes } = await supabase
    .from('document_types')
    .select('*')
    .eq('category', generalTypeResult.trim())
    .eq('is_general_type', false);
    
  // Second pass: Use specific types for detailed classification
  const specificTypeResult = await claudeService.sendPrompt(`
    Given the following document content: 
    
    ${documentContent} 
    
    This document has been identified as belonging to the general category: "${generalTypeResult.trim()}".
    
    Which of these specific document types does it most likely match?
    
    ${specificTypes.map(type => `- ${type.name}: ${type.description}`).join('\n')}
    
    Return only the name of the best matching specific type.
  `);
  
  // Get the full document type record
  const { data: matchedType } = await supabase
    .from('document_types')
    .select('*')
    .eq('name', specificTypeResult.trim())
    .single();
    
  return matchedType;
};
```

This approach gives you the best of both worlds:
1. Two-stage classification for better accuracy
2. Hierarchical organization for easier management
3. Reduced redundancy in descriptions
4. Better context for AI classification decisions

The hierarchical approach also reduces the total number of comparisons needed during classification, as documents are first sorted into broad categories before detailed classification.