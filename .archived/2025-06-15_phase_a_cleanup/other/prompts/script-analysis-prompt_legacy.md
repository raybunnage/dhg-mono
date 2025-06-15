# Script Analysis Prompt

## Task

Analyze the provided script file to determine its purpose, functionality, and assess its quality, relevancy, and potential value to the project. Categorize the script into predefined document types.

## Context

You are analyzing a script file from a codebase to determine its document type, purpose, and overall quality. Your assessment will help organize and manage scripts in the codebase, identify potential duplicates, and ensure scripts are properly documented and maintained.

## Instructions

1. **Analyze the script content, purpose, and functionality**
   - Determine what the script does
   - Identify the technologies and libraries used
   - Note any inputs, outputs, or side effects

2. **Determine the script's primary purpose**
   - Categorize into one of the document types:
     - AI: Related to AI/ML models, prompts, and configurations
     - Integration: For external system integrations
     - Operations: For operational tasks and infrastructure
     - Development: For development tools and processes

3. **Assess quality, relevancy, and potential value**
   - Code quality: Is the code well-written, documented, and maintainable?
   - Relevancy: Is the script still relevant to the project?
   - Potential value: How valuable is this script to the project?

4. **Check for package.json references**
   - Is this script referenced in any package.json files?
   - Is it part of a defined workflow or process?

5. **Detect potential duplicates**
   - Does this script have similar functionality to other scripts?
   - Is this potentially a duplicate or variation of another script?

6. **Generate appropriate tags**
   - Create tags that describe the script's purpose, technology, and functionality

7. **Recommend a status**
   - ACTIVE: Currently in use and up-to-date
   - UPDATE_NEEDED: Still useful but requires updates
   - OBSOLETE: No longer needed or outdated
   - DUPLICATE: Duplicates functionality found elsewhere
   - UNUSED: Not referenced or used in the project

## Output Format

Provide your analysis in the following JSON format:

```json
{
  "metadata": {
    "file_path": "path/to/script.js",
    "title": "Descriptive title of the script",
    "language": "javascript|typescript|shell|python|etc",
    "document_type": "AI|Integration|Operations|Development"
  },
  "assessment": {
    "summary": "Brief summary of what the script does",
    "tags": ["tag1", "tag2", "tag3"],
    "quality": {
      "code_quality": 1-10,
      "maintainability": 1-10,
      "utility": 1-10,
      "documentation": 1-10
    },
    "relevance": {
      "score": 1-10,
      "reasoning": "Explanation of relevance score"
    },
    "referenced": true|false,
    "potential_duplicates": ["path/to/similar/script1", "path/to/similar/script2"],
    "status": {
      "recommendation": "ACTIVE|UPDATE_NEEDED|OBSOLETE|DUPLICATE|UNUSED",
      "confidence": 1-10,
      "reasoning": "Explanation of status recommendation"
    }
  }
}
```

Ensure your assessment is objective, thorough, and provides clear reasoning for your categorization and recommendations.