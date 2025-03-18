# AI Processing Utilities

## Overview
These utilities handle the AI-powered processing of documents, extracting expert information and creating structured profiles. Think of it as an AI assistant that reads documents and organizes the important information.

## Main Function: processDocumentWithAI

### What It Does
Takes a document (like a CV or research paper) and:
1. Reads the content
2. Understands who the expert is
3. Extracts key information (name, expertise, publications, etc.)
4. Creates a structured profile

### How To Use It
```typescript
// Basic usage
const expertProfile = await processDocumentWithAI('document-123');

// With options
const profile = await processDocumentWithAI('document-123', {
  requireJsonOutput: true,
  maxRetries: 3
});
```

### Step-by-Step Process

1. **Document Preparation**
```typescript
// First, get the document from the database
const { data: document } = await supabase
  .from('expert_documents')
  .select('id, raw_content')
  .eq('id', documentId)
  .single();
```

2. **AI Processing**
```typescript
// Send to Claude AI with specific instructions
const response = await anthropic.messages.create({
  model: 'claude-3-sonnet-20240229',
  max_tokens: 4096,
  system: "You are an expert at extracting structured information...",
  messages: [{
    role: 'user',
    content: `Extract expert information from: ${document.raw_content}`
  }]
});
```

3. **Response Processing**
```typescript
// Convert AI response to structured data
const expertProfile = {
  name: extracted.name,
  expertise: extracted.expertise,
  publications: extracted.publications,
  // ... other fields
};
```

### What You Get Back
```typescript
// Example return value
{
  name: "Dr. Jane Smith",
  expertise: ["Machine Learning", "Neural Networks"],
  publications: [
    {
      title: "Advanced AI Applications",
      year: 2023,
      journal: "AI Quarterly"
    }
  ],
  education: [
    {
      degree: "Ph.D.",
      field: "Computer Science",
      institution: "MIT"
    }
  ]
}
```

## AI Layer Details

### 1. System Instructions
The AI is configured with specific instructions:
```typescript
const systemPrompt = `
You are an expert at extracting structured information about experts.
Focus on:
- Name and title
- Areas of expertise
- Academic background
- Professional experience
- Publications and research
Output in clean, structured JSON format.
`;
```

### 2. Processing Layers

#### Layer 1: Initial Extraction
```typescript
// First pass: Basic information extraction
const initialPass = await processWithAI(content, {
  focus: 'basic_info',
  format: 'json'
});
```

#### Layer 2: Verification
```typescript
// Second pass: Verify and enhance
const verifiedData = await processWithAI(initialPass, {
  focus: 'verification',
  previousData: initialPass
});
```

#### Layer 3: Enrichment
```typescript
// Final pass: Add context and connections
const enrichedData = await processWithAI(verifiedData, {
  focus: 'enrichment',
  mode: 'enhance'
});
```

## Error Handling

### Retry Logic
```typescript
const processWithRetry = async (documentId: string, attempts = 3) => {
  try {
    return await processDocumentWithAI(documentId);
  } catch (error) {
    if (attempts > 1) {
      return processWithRetry(documentId, attempts - 1);
    }
    throw error;
  }
};
```

### Error Types
1. **Content Errors**
   - Document too long
   - Unreadable content
   - Unsupported format

2. **AI Processing Errors**
   - Token limit exceeded
   - Model unavailable
   - Invalid response format

## Best Practices

1. **Content Preparation**
```typescript
// Clean and normalize content before processing
const prepareContent = (content: string) => {
  return content
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_CONTENT_LENGTH);
};
```

2. **Response Validation**
```typescript
const validateResponse = (response: any) => {
  const required = ['name', 'expertise'];
  return required.every(field => response[field]);
};
```

3. **Progress Tracking**
```typescript
const trackProgress = (status: string) => {
  await supabase
    .from('expert_documents')
    .update({ 
      processing_status: status,
      updated_at: new Date().toISOString()
    });
};
```

## Common Use Cases

### 1. Process New Document
```typescript
async function processNewDocument(documentId: string) {
  // Start processing
  trackProgress('processing');
  
  try {
    const profile = await processDocumentWithAI(documentId);
    await saveExpertProfile(profile);
    trackProgress('completed');
  } catch (error) {
    trackProgress('failed');
    throw error;
  }
}
```

### 2. Batch Processing
```typescript
async function processBatch(documentIds: string[]) {
  const results = [];
  for (const id of documentIds) {
    try {
      const profile = await processDocumentWithAI(id);
      results.push({ id, success: true, profile });
    } catch (error) {
      results.push({ id, success: false, error });
    }
  }
  return results;
}
```

## Integration Tips

1. **With UI Components**
```typescript
function ProcessingButton({ documentId }) {
  const [loading, setLoading] = useState(false);
  
  const handleProcess = async () => {
    setLoading(true);
    try {
      await processDocumentWithAI(documentId);
      toast.success('Processing complete!');
    } catch (error) {
      toast.error('Processing failed');
    } finally {
      setLoading(false);
    }
  };
  
  return <button onClick={handleProcess}>Process Document</button>;
}
```

2. **With Background Jobs**
```typescript
// Queue processing for large batches
const queueProcessing = async (documentIds: string[]) => {
  for (const id of documentIds) {
    await addToQueue({
      type: 'process_document',
      documentId: id,
      priority: 'normal'
    });
  }
};
``` 