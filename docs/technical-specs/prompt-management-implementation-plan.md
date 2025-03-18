# Prompt Management System Implementation Plan

## Overview

This document outlines the implementation plan for a robust prompt management system that stores AI prompts along with their metadata in a structured database. The system will incorporate content hashing to enable integrity verification, change detection, and efficient version management.

## System Architecture

![Prompt Management System Architecture](https://via.placeholder.com/800x500)

The system consists of the following components:
1. **Database**: PostgreSQL with UUID support
2. **Prompt Loader**: Extracts prompts and metadata from markdown files
3. **Hash Generator**: Creates and validates SHA-256 hashes
4. **API Layer**: Interfaces with your application

## Implementation Steps

### 1. Database Setup

Execute the SQL schema provided to create the necessary tables:
- `prompt_categories`
- `prompts` (with metadata JSONB field)
- `prompt_relationships`
- `prompt_usage`

Create an index on the hash field for efficient lookups:

```sql
CREATE INDEX prompt_hash_idx ON prompts ((metadata->>'hash'));
```

### 2. Prompt File Format

Standardize your prompt markdown files to include metadata in a YAML frontmatter:

```markdown
---
name: Document Extraction Prompt
description: Extracts structured data from legal documents
documentType: legal_document
category: extraction
version: 1.0
author: AI Team
model: gpt-4-1106-preview
temperature: 0.2
maxTokens: 2000
inputSchema:
  document: string
  targetFields: string[]
outputSchema: JSON object with extracted fields
purpose: Extract structured data from legal documents
successCriteria: All target fields correctly identified
dependencies:
  - document_classification_prompt
estimatedCost: ~4000 tokens per document
tags:
  - extraction
  - legal
  - structured-data
---

# Document Extraction Prompt

## Context
You are a legal document analyzer tasked with extracting key information.

## Instructions
Extract the following information from the provided document:
[... rest of prompt content ...]
```

### 3. Prompt Processing Pipeline

Implement a pipeline that processes prompt files:

#### Step 1: Parse Markdown & Extract Metadata

```javascript
function parsePromptFile(filePath) {
  const fileContent = fs.readFileSync(filePath, 'utf8');
  
  // Extract frontmatter (metadata) and content
  const { data: metadata, content } = matter(fileContent);
  
  // Clean and structure content
  const cleanContent = content.trim();
  
  return {
    metadata,
    content: cleanContent,
    filePath
  };
}
```

#### Step 2: Generate Content Hash

```javascript
function generateContentHash(content) {
  return crypto
    .createHash('sha256')
    .update(content)
    .digest('hex');
}
```

#### Step 3: Structure Metadata JSON

```javascript
function buildMetadataObject(extractedMetadata, content, filePath) {
  const gitInfo = getGitInfo(filePath);
  const contentHash = generateContentHash(content);
  
  return {
    hash: contentHash,
    source: {
      fileName: path.basename(filePath),
      createdAt: fs.statSync(filePath).birthtime.toISOString(),
      gitInfo: {
        branch: gitInfo.branch,
        commitId: gitInfo.commitId
      }
    },
    aiEngine: {
      model: extractedMetadata.model || 'default',
      temperature: extractedMetadata.temperature || 0.7,
      maxTokens: extractedMetadata.maxTokens || 1000
    },
    usage: {
      inputSchema: extractedMetadata.inputSchema || {},
      outputSchema: extractedMetadata.outputSchema || 'text'
    },
    function: {
      purpose: extractedMetadata.purpose || extractedMetadata.description,
      successCriteria: extractedMetadata.successCriteria || '',
      dependencies: extractedMetadata.dependencies || [],
      estimatedCost: extractedMetadata.estimatedCost || ''
    }
  };
}
```

#### Step 4: Store in Database

```javascript
async function storePrompt(parsedPrompt) {
  const { metadata, content, filePath } = parsedPrompt;
  const structuredMetadata = buildMetadataObject(metadata, content, filePath);
  
  // Check if prompt already exists (by hash)
  const existingPrompt = await db.query(
    'SELECT id, version FROM prompts WHERE metadata->>\'hash\' = $1',
    [structuredMetadata.hash]
  );
  
  if (existingPrompt.rows.length > 0) {
    // Handle duplicate (maybe update version)
    console.log(`Prompt already exists with id ${existingPrompt.rows[0].id}`);
    return existingPrompt.rows[0].id;
  }
  
  // Get document type ID
  const documentTypeResult = await db.query(
    'SELECT id FROM document_types WHERE document_type = $1',
    [metadata.documentType]
  );
  
  const documentTypeId = documentTypeResult.rows.length > 0 
    ? documentTypeResult.rows[0].id 
    : null;
  
  // Get or create category
  let categoryId = null;
  if (metadata.category) {
    const categoryResult = await db.query(
      'SELECT id FROM prompt_categories WHERE name = $1',
      [metadata.category]
    );
    
    if (categoryResult.rows.length > 0) {
      categoryId = categoryResult.rows[0].id;
    } else {
      const newCategoryResult = await db.query(
        'INSERT INTO prompt_categories (name) VALUES ($1) RETURNING id',
        [metadata.category]
      );
      categoryId = newCategoryResult.rows[0].id;
    }
  }
  
  // Insert prompt
  const result = await db.query(
    `INSERT INTO prompts 
     (name, description, content, metadata, document_type_id, category_id, 
      version, status, author, tags, file_path)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING id`,
    [
      metadata.name,
      metadata.description,
      JSON.stringify(content),
      structuredMetadata,
      documentTypeId,
      categoryId,
      metadata.version || '1.0',
      'active',
      metadata.author,
      metadata.tags || [],
      filePath
    ]
  );
  
  return result.rows[0].id;
}
```

### 4. Prompt Loading & Validation

Implement a mechanism to load prompts from the database, using the hash to verify integrity:

```javascript
async function loadPrompt(promptId) {
  const result = await db.query(
    'SELECT * FROM prompts WHERE id = $1',
    [promptId]
  );
  
  if (result.rows.length === 0) {
    throw new Error(`Prompt with ID ${promptId} not found`);
  }
  
  const prompt = result.rows[0];
  
  // Verify hash integrity
  const calculatedHash = generateContentHash(prompt.content);
  const storedHash = prompt.metadata.hash;
  
  if (calculatedHash !== storedHash) {
    console.warn(`Warning: Prompt integrity check failed for ${promptId}`);
    // Optional: Handle hash mismatch (log, report, etc.)
  }
  
  return prompt;
}
```

### 5. Change Detection & Version Management

Implement a system to detect changes when reloading prompts:

```javascript
async function updatePromptFromFile(filePath, promptId) {
  const parsedPrompt = parsePromptFile(filePath);
  const { metadata, content } = parsedPrompt;
  const structuredMetadata = buildMetadataObject(metadata, content, filePath);
  
  // Get existing prompt
  const existingPrompt = await loadPrompt(promptId);
  
  // Check if content has changed
  if (structuredMetadata.hash === existingPrompt.metadata.hash) {
    console.log('No changes detected in prompt content');
    return promptId;
  }
  
  // Content has changed, update version
  const newVersion = incrementVersion(existingPrompt.version);
  
  // Update prompt
  await db.query(
    `UPDATE prompts
     SET content = $1, metadata = $2, version = $3, updated_at = CURRENT_TIMESTAMP
     WHERE id = $4`,
    [
      JSON.stringify(content),
      structuredMetadata,
      newVersion,
      promptId
    ]
  );
  
  console.log(`Updated prompt ${promptId} to version ${newVersion}`);
  return promptId;
}

function incrementVersion(version) {
  const parts = version.split('.');
  parts[parts.length - 1] = parseInt(parts[parts.length - 1]) + 1;
  return parts.join('.');
}
```

## User Interface Integration

### 1. "Load Prompt" Button Handler

```javascript
async function handleLoadPromptButton() {
  // Open file dialog to select prompt markdown file
  const filePath = await openFileDialog({
    title: 'Select Prompt File',
    filters: [{ name: 'Markdown', extensions: ['md'] }]
  });
  
  if (!filePath) return;
  
  try {
    // Parse and process prompt file
    const parsedPrompt = parsePromptFile(filePath);
    
    // Preview metadata and content for user confirmation
    showPromptPreview(parsedPrompt);
    
    // If user confirms, store prompt
    const promptId = await storePrompt(parsedPrompt);
    
    // Update UI with success message
    showSuccessMessage(`Prompt loaded successfully with ID: ${promptId}`);
    
    // Refresh prompt list
    refreshPromptList();
  } catch (error) {
    showErrorMessage(`Failed to load prompt: ${error.message}`);
  }
}
```

### 2. Document Type Association

```javascript
async function associatePromptWithDocumentType(promptId, documentTypeId) {
  await db.query(
    'UPDATE prompts SET document_type_id = $1 WHERE id = $2',
    [documentTypeId, promptId]
  );
  
  console.log(`Associated prompt ${promptId} with document type ${documentTypeId}`);
}
```

## Testing Plan

1. **Unit Tests**:
   - Test hash generation with known inputs and outputs
   - Test metadata extraction from sample markdown files
   - Test version increment logic

2. **Integration Tests**:
   - Test end-to-end prompt loading from file to database
   - Test prompt retrieval and validation
   - Test change detection and version management

3. **Edge Cases**:
   - Test handling of malformed markdown files
   - Test handling of missing metadata
   - Test hash collisions (if possible)

## Maintenance Considerations

1. **Database Maintenance**:
   - Implement regular backup of the prompts table
   - Consider archiving old prompt versions

2. **Performance Optimization**:
   - Monitor query performance, especially with large number of prompts
   - Consider caching frequently used prompts

3. **Future Enhancements**:
   - Implement prompt effectiveness tracking
   - Add support for prompt templates
   - Develop a visual editor for prompts

## Conclusion

Following this implementation plan will result in a robust prompt management system that leverages content hashing for integrity verification, change detection, and version management. The system will integrate with your existing document types and provide a foundation for managing AI prompts across your application.
