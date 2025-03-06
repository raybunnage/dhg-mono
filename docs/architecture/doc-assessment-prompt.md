# Documentation Assessment Prompt

```
Analyze the following documentation file and provide a structured assessment:

---
Filename: {{filename}}
Creation Date: {{creation_date}}
Last Modified: {{last_modified_date}}
Path: {{file_path}}
Content:

{{file_content}}
---

Current Development Context:
{{development_context}}

Based on the file content and development context provided, generate a comprehensive assessment with the following components:

1. Summary: Provide a concise 3-sentence summary of the document's purpose, structure, and key content.

2. Tags: Generate 5-10 relevant tags that would help classify and search for this document. Focus on content type, technical domain, functionality described, and document purpose.

3. Current Relevance Assessment: On a scale of 1-10, how relevant is this document to the current development state? Provide brief reasoning for your score.

4. Potential Relevance Assessment: On a scale of 1-10, rate the potential future relevance of this document. Consider the creation date, technology described, and alignment with development direction. Provide brief reasoning for your score.

5. Status Recommendation: Based on your analysis, recommend one of the following actions:
   - KEEP: The document is valuable as is
   - UPDATE: The document contains valuable information but needs updating
   - ARCHIVE: The document has historical value but isn't actively needed
   - DELETE: The document provides little to no value and can be removed

6. Confidence: On a scale of 1-10, rate your confidence in this assessment.

7. Reasoning: Provide a short paragraph summarizing your reasoning for this assessment.

Output your analysis as a valid JSON object using the following structure:
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

## Example Development Context

```
Current Development Context:
The project is a React-based web application for content management with Supabase as the backend. We're currently focused on implementing the command history tracking system and improving documentation organization. Key technologies include TypeScript, React, Supabase, and PostgreSQL functions. The team is prioritizing improvements to the file metadata synchronization system and document processing workflows. We're actively refactoring code to improve reusability and reduce duplication.
```
