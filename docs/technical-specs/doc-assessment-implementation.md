Let's adjust the command:

⏺ Bash(cd /Users/raybunnage/Documents/github/dhg-mono/apps/dhg-improve-experts && find . -type …
       -name "*.js" -o -name "*.ts" -o -name "*.sh" -o -name "*.py" -o -name "*.sql" | grep -v
      "node_modules" | grep -v "dist" | grep -v ".git" | grep -v "build" | grep -v "coverage" |
      head -10)
  ⎿  ./remove_user_references_code.sh
     ./fix_experts_rls.sql
     ./dev-start.sh
     ./apply_function_registry_migrations.sh
     ./apply_script_migrations.sh
     ./cleanup_batches.sql
     ./apply_export_functions_migration.sh
     ./process-docs-batch.sh
     ./apply_export_functions.sh
     ./function_registry_migrations.sql

⏺ Based on what we've found, here's the summary:

  1. The scan-scripts command is supposed to find script files with extensions js, ts, sh,
  py, sql while excluding patterns like node_modules, dist, build, .git, coverage.
  2. There's a mismatch between how scan-scripts.ts calls the findFiles function and how
  it's implemented in file-service.ts, which is likely causing issues.
  3. The analyze-scripts.sh script is looking for the CLI in a location that doesn't exist
  in your current setup.
  4. The database schema for the scripts table includes fields for file_path, language,
  document_type, summary, tags, etc.
  5. A simple find command shows that there are indeed script files in the repository with
  the extensions specified in the scan-scripts command.

  The issue appears to be that the CLI tool isn't properly built or installed, and there
  might be incompatibilities between the implementation and usage of the file finding logic.
   The basic logic for finding script files should match what's in the database schema, but
  the implementation details need to be resolved.


# Documentation Assessment System: Implementation Guide

## Overview

This document provides a comprehensive guide for implementing a documentation assessment system to help evaluate, categorize, and maintain your project's documentation. The system uses AI to analyze documentation files and provide structured assessments to help you decide which documents to keep, update, archive, or delete.

## JSON Response Structure

```json
{
  "file_metadata": {
    "filename": "{{filename}}",
    "creation_date": "{{creation_date}}",
    "last_modified": "{{last_modified_date}}",
    "path": "{{file_path}}"
  },
  "assessment": {
    "summary": "Three sentence summary goes here. It describes the document's purpose. It highlights key content.",
    "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"],
    "current_relevance": {
      "score": 7,
      "reasoning": "Brief explanation of current relevance score"
    },
    "potential_relevance": {
      "score": 8,
      "reasoning": "Brief explanation of potential relevance score"
    },
    "status_recommendation": "KEEP|UPDATE|ARCHIVE|DELETE",
    "confidence": 8,
    "reasoning": "Summary paragraph explaining the overall assessment and recommendations."
  }
}
```

## Implementation Considerations

### 1. Development Context Template

You'll need to provide a standardized description of your current development status that can be inserted into each prompt. This should include:
- Current project phase/goals
- Technologies in active use
- Upcoming development priorities
- Any specific documentation needs

Example:
```
Current Development Context:
The project is a React-based web application for content management with Supabase as the backend. We're currently focused on implementing the command history tracking system and improving documentation organization. Key technologies include TypeScript, React, Supabase, and PostgreSQL functions. The team is prioritizing improvements to the file metadata synchronization system and document processing workflows. We're actively refactoring code to improve reusability and reduce duplication.
```

### 2. File Processing System

- Set up a script to process each documentation file individually
- The script should extract metadata (filename, dates, path) and content
- Handle large files by potentially chunking them
- Add rate limiting to avoid overwhelming the AI service

Example pseudocode:
```javascript
async function processDocumentationFile(filePath) {
  // Extract file metadata
  const stats = fs.statSync(filePath);
  const metadata = {
    filename: path.basename(filePath),
    creation_date: stats.birthtime,
    last_modified: stats.mtime,
    path: filePath
  };
  
  // Read file content
  const content = fs.readFileSync(filePath, 'utf8');
  
  // Prepare prompt
  const prompt = generatePrompt(metadata, content, DEVELOPMENT_CONTEXT);
  
  // Process with AI
  const response = await callAI(prompt);
  
  // Parse and validate response
  const assessment = JSON.parse(response);
  
  // Store in database
  await storeAssessment(metadata, assessment);
  
  return assessment;
}
```

### 3. Database Structure

```sql
CREATE TABLE documentation_assessment (
  id SERIAL PRIMARY KEY,
  filename TEXT NOT NULL,
  file_path TEXT NOT NULL,
  creation_date TIMESTAMP,
  last_modified TIMESTAMP,
  assessment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  summary TEXT,
  tags TEXT[],
  current_relevance_score INTEGER,
  current_relevance_reasoning TEXT,
  potential_relevance_score INTEGER,
  potential_relevance_reasoning TEXT,
  status_recommendation TEXT,
  confidence INTEGER,
  reasoning TEXT,
  raw_json JSONB
);
```

This structure allows you to:
- Store all assessment information in a queryable format
- Keep the raw JSON for future reference
- Build analytics and reporting on your documentation status

### 4. Processing Enhancements

- **Document Similarity**: Calculate similarity between documents to identify redundant documentation
  ```sql
  -- Example query to find potentially similar documents based on tags
  SELECT a.filename, b.filename, array_length(array_intersect(a.tags, b.tags), 1) as common_tags
  FROM documentation_assessment a
  JOIN documentation_assessment b ON a.id < b.id
  WHERE array_length(array_intersect(a.tags, b.tags), 1) > 3
  ORDER BY common_tags DESC;
  ```

- **Version History**: Track assessments over time to see how document relevance changes
  ```sql
  CREATE TABLE documentation_assessment_history (
    id SERIAL PRIMARY KEY,
    documentation_id INTEGER REFERENCES documentation_assessment(id),
    assessment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status_recommendation TEXT,
    current_relevance_score INTEGER,
    potential_relevance_score INTEGER,
    confidence INTEGER,
    reasoning TEXT
  );
  ```

- **Review Cycle**: Implement periodic reassessment, especially for documents marked for updating
  ```sql
  -- Find documents that need review (assessed over 3 months ago or marked for update)
  SELECT * FROM documentation_assessment
  WHERE assessment_date < NOW() - INTERVAL '3 months'
  OR status_recommendation = 'UPDATE';
  ```

- **Human Judgment**: Allow overriding AI recommendations
  ```sql
  ALTER TABLE documentation_assessment
  ADD COLUMN human_override_status TEXT,
  ADD COLUMN human_override_reason TEXT,
  ADD COLUMN human_override_date TIMESTAMP;
  ```

### 5. Visualization & Workflow

- **Dashboard**: Create a dashboard showing document distribution by status
  - Pie chart of recommendations (KEEP/UPDATE/ARCHIVE/DELETE)
  - Bar chart of document counts by tag
  - Line chart showing documentation freshness (last modified vs. relevance)

- **Workflow for Updates**: Build a system to track documents that need updating
  ```
  1. Identify documents marked for UPDATE
  2. Assign to team members
  3. Track update status (assigned, in progress, updated, reviewed)
  4. Reassess after updating
  ```

- **Tag Management**: Interface to standardize and manage tags
  ```
  - View all existing tags with document counts
  - Merge similar tags
  - Create tag hierarchies/relationships
  - Apply tag standards
  ```

- **Coverage Reports**: Show documentation coverage of different system aspects
  ```
  - Identify system components lacking documentation
  - Track documentation freshness by component
  - Highlight critical components with outdated docs
  ```

### 6. Scaling Considerations

- **Batch Processing**: For large documentation bases, process in batches
  ```javascript
  async function processBatch(fileList, batchSize = 10, delayMs = 1000) {
    for (let i = 0; i < fileList.length; i += batchSize) {
      const batch = fileList.slice(i, i + batchSize);
      await Promise.all(batch.map(file => processDocumentationFile(file)));
      console.log(`Processed batch ${i/batchSize + 1}`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  ```

- **Priority Processing**: Process newest documents first
  ```javascript
  // Sort files by modified date before processing
  const files = getAllDocumentationFiles()
    .sort((a, b) => fs.statSync(b).mtime - fs.statSync(a).mtime);
  ```

- **Result Caching**: Avoid reprocessing unchanged documents
  ```javascript
  async function shouldProcessFile(filePath) {
    const stats = fs.statSync(filePath);
    const lastModified = stats.mtime;
    
    // Check if we already have an assessment from after the last modification
    const existingAssessment = await getExistingAssessment(filePath);
    if (existingAssessment && existingAssessment.assessment_date > lastModified) {
      return false; // Skip processing
    }
    return true;
  }
  ```

- **Cost Tracking**: Monitor API usage costs
  ```javascript
  let tokenCount = 0;
  
  async function trackAPIUsage(prompt, response) {
    // Approximate token count
    const promptTokens = prompt.length / 4;
    const responseTokens = response.length / 4;
    tokenCount += promptTokens + responseTokens;
    
    // Log when reaching thresholds
    if (tokenCount > COST_THRESHOLD) {
      console.warn(`Token usage exceeding threshold: ${tokenCount}`);
      // Notify administrator
    }
  }
  ```

## Best Practices

1. **Start Small**: Begin with a subset of critical documentation to refine your process

2. **Refine the Prompt**: Iterate on the prompt based on results to improve accuracy

3. **Establish Clear Criteria**: Define what makes a document relevant to your current development

4. **Regular Updates**: Re-evaluate documentation periodically, especially after major project milestones

5. **Integrate with Documentation Workflow**: Make assessment part of your documentation creation and update process

6. **Balance AI and Human Judgment**: Use AI recommendations as a starting point, but apply human judgment for final decisions

7. **Take Action**: Establish a clear workflow for handling documents based on their recommended status

## Conclusion

This documentation assessment system provides a structured approach to managing your documentation, helping you focus on what's valuable and current while reducing maintenance overhead from outdated or redundant documents. By implementing this system, you'll create a more useful, navigable, and maintainable documentation base for your project.
