# Guide for Integrating Database Document Types with Claude

## Approach 1: Direct CSV File Upload

### Step 1: Export Document Types from Database
```sql
-- Example SQL query to export document types
SELECT id, document_type, description, category, mime_type, file_extension 
FROM document_types_table
WHERE is_active = true
ORDER BY category, document_type;
```

Export this query result as a CSV file.

### Step 2: Upload CSV to Claude
When using Claude, upload the CSV file at the beginning of your conversation. You can reference this in your prompt with:

```
I've uploaded a CSV file containing our document type definitions. Please use these definitions when classifying the documents I'll submit.
```

### Step 3: Submit Documents for Classification
Upload the document(s) you want classified and use the prompt provided in the other artifact.

## Approach 2: API Integration for Real-time Document Types

If you're using Claude through the API, you can create a more automated solution:

### Step 1: Create a Document Type Fetching Function
```python
def get_current_document_types():
    """Fetch current document types from database"""
    conn = connect_to_database()  # Your database connection logic
    query = """
    SELECT id, document_type, description, category, mime_type, 
           file_extension, required_fields, is_ai_generated
    FROM document_types_table
    WHERE is_active = true
    ORDER BY category, document_type;
    """
    df = pd.read_sql(query, conn)
    conn.close()
    
    # Convert to formatted string for prompt insertion
    formatted_types = df.to_string(index=False) 
    # Or format as markdown table:
    # formatted_types = df.to_markdown(index=False)
    
    return formatted_types
```

### Step 2: Insert Current Types into Prompt
```python
def create_classification_prompt(doc_path):
    """Create a classification prompt with current document types"""
    # Get base prompt template
    with open('classification_prompt_template.md', 'r') as f:
        prompt_template = f.read()
    
    # Get current document types
    current_types = get_current_document_types()
    
    # Insert current types into template
    prompt = prompt_template.replace('[INSERT DOCUMENT_TYPES_CSV_DATA HERE]', current_types)
    
    return prompt
```

### Step 3: Send to Claude API
```python
def classify_document(doc_path):
    """Send document to Claude for classification"""
    prompt = create_classification_prompt(doc_path)
    
    # Read document content
    doc_content = read_document(doc_path)  # Your document reading logic
    
    # Combine prompt with document content
    full_prompt = f"{prompt}\n\nHere is the document to classify:\n\n{doc_content}"
    
    # Send to Claude API
    response = claude_api.send_message(full_prompt)
    
    return response
```

## Approach 3: Hybrid Solution with Cached Types

For efficiency with frequent classifications:

1. Schedule a daily/weekly job to export current document types to a JSON/CSV file
2. Have your application read from this file when preparing prompts
3. Include a "last updated" timestamp in your prompt
4. Add logic to refresh the cache if it's older than a threshold

## Best Practices for Document Type Definitions

For optimal classification results:

1. **Distinct Descriptions**: Ensure each document type has a clear, distinctive description
2. **Example Indicators**: Include typical characteristics or markers for each type
3. **Hierarchical Organization**: Group similar types under categories
4. **Usage Context**: Note typical use cases or departments for each type
5. **Versioning**: Include version information for document types that evolve

## Handling New Document Types

To accommodate the discovery of new document types:

1. Add a feedback loop where Claude can suggest new types
2. Create a review process for suggested types
3. Implement a staging area in your database for proposed document types
4. Periodically review and formalize new types

## Sample Document Type Definition Format

For best results with Claude, structure your document types with these fields:

```
id: Unique identifier
document_type: Short name of the type
description: Detailed description of characteristics and purpose
category: Higher-level grouping
typical_sections: Common headings or sections
typical_length: Average length range
common_phrases: Frequently appearing terminology
related_types: Similar document types with distinguishing factors
```
