# Document Type Classification Fix

This document outlines the fixes implemented to resolve the document type classification issues in the document pipeline service.

## Issue Description

The document pipeline CLI command `classify-untyped` was failing with two separate issues:

1. Database schema issue:
```
ERROR Query execution error {"error":{"error":{"code":"42703","details":null,"hint":null,"message":"column document_types.name does not exist"}}}
ERROR Error fetching document types: {"error":{"code":"42703","details":null,"hint":null,"message":"column document_types.name does not exist"}}
```

2. Claude API issue after the first fix:
```
WARN Claude API request failed (attempt 1/3) {"status":400,"message":"response_format: Extra inputs are not permitted"}
ERROR Error calling Claude API: {"error":{"name":"Error","message":"Claude API error: response_format: Extra inputs are not permitted"}}
```

## Root Causes

1. **Database Schema Issue**: The database schema for the `document_types` table uses a column called `document_type` to store the type name, but the TypeScript code was incorrectly referencing it as `name`.

2. **Claude API Issue**: The Claude API's response format specification changed with Claude 3 models, requiring an update to the API request format.

## Implemented Fixes

### Database Schema Fix

1. Updated the DocumentType interface to use the correct field name:
   ```typescript
   export interface DocumentType {
     id: string;
     document_type: string; // Changed from name
     description?: string;
   }
   ```

2. Updated the query to fetch document types with the correct column name:
   ```typescript
   const { data: documentTypes, error: typesError } = await databaseService.getRecords<DocumentType>(
     'document_types',
     'id, document_type, description' // Changed from id, name, description
   );
   ```

3. Updated the type options list creation to use the correct field:
   ```typescript
   const typeOptions = documentTypes.map(type => 
     `${type.id}: ${type.document_type}${type.description ? ` - ${type.description}` : ''}`
   ).join('\n');
   ```

4. Updated the Claude API response handling to use the correct field names:
   ```typescript
   const response = await claudeService.getJsonResponse<{
     document_type_id: string;
     document_type: string; // Changed from document_type_name
     confidence: number;
     rationale: string;
   }>(classificationPrompt, { temperature: 0.2 });
   ```

5. Updated logging references to use the correct field:
   ```typescript
   logger.info(`✅ Classified ${document.file_path} as ${response.document_type || response.document_type_id} (confidence: ${response.confidence})`);
   ```

6. Updated the Claude prompt instructions to request the correct field name:
   ```
   Respond with a valid JSON object containing these fields:
   - document_type_id: The ID of the selected document type (required)
   - document_type: The type of the selected document
   - confidence: A number between 0-1 indicating your confidence in this classification
   - rationale: A brief explanation of why you chose this classification
   ```

### Claude API Fix

We took a more robust approach by removing the `response_format` specification and instead using prompt engineering to ensure valid JSON responses:

1. Removed the problematic `response_format` parameter that was causing errors:
   ```typescript
   // Skip response_format for now - the models being used may not support it properly
   ```

2. Enhanced the system message to be more explicit about JSON requirements:
   ```typescript
   options.system = "You are a helpful AI assistant that ONLY provides responses in valid JSON format. Your responses must be structured as valid, parseable JSON with nothing else before or after the JSON object. Do not include markdown code formatting, explanations, or any text outside the JSON object.";
   ```

3. Added explicit JSON instructions to the prompt:
   ```typescript
   // Add a clear instruction for JSON response
   enhancedPrompt = `${prompt}\n\nIMPORTANT: Respond with ONLY a JSON object and nothing else. Do not include explanations, markdown formatting, or any text outside the JSON object. The response must be valid, parseable JSON that follows this structure for document classification:\n
   {
     "document_type_id": "the ID of the selected document type",
     "document_type": "the name of the document type", 
     "confidence": 0.95, // a number between 0-1
     "rationale": "brief explanation of classification"
   }`;
   ```

4. Added robust JSON extraction from response text:
   ```typescript
   // Find and extract JSON from the response if embedded in other text
   const jsonMatch = responseText.match(/\{[\s\S]*\}/);
   const jsonText = jsonMatch ? jsonMatch[0] : responseText;
   
   return JSON.parse(jsonText) as T;
   ```

## Usage

With these fixes, the document classification should now work correctly. You can run:

```bash
./scripts/cli-pipeline/document/document-pipeline-service-cli.sh classify-untyped [count]
```

where `[count]` is the number of untyped documents to classify.

## Future Recommendations

1. Add a database schema verification step to the pipeline startup
2. Consider using a type generation system (like Supabase's generated types) to ensure TypeScript types match the database schema
3. Add automated testing for the document classification process
4. Add version detection for Claude API to handle different model versions appropriately
5. Implement comprehensive error handling for API changes