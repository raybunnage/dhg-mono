import { claudeService } from '@shared/services/claude-service/claude-service';

// Process general content with AI
export async function processWithAI(prompt: string): Promise<any> {
  try {
    const response = await claudeService.sendPrompt(prompt);
    return response;
  } catch (error) {
    console.error('AI processing error:', error);
    throw new Error(`AI processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Process document with AI for classification
export async function processDocumentWithAI(
  content: string,
  documentTypes: any[],
  promptTemplate: string
): Promise<{
  document_type_id: string;
  document_type_name: string;
  confidence: number;
  reasoning: string;
}> {
  try {
    // Build the prompt with document content and types
    const prompt = promptTemplate
      .replace('{{document_types}}', JSON.stringify(documentTypes, null, 2))
      .replace('{{content}}', content.substring(0, 4000)); // Limit content to avoid token limits

    // Get JSON response from Claude
    const response = await claudeService.getJsonResponse(prompt);

    // Validate the response has required fields
    if (!response.document_type_id || !response.document_type_name || 
        typeof response.confidence !== 'number' || !response.reasoning) {
      throw new Error('Invalid classification response format');
    }

    return {
      document_type_id: response.document_type_id,
      document_type_name: response.document_type_name,
      confidence: response.confidence,
      reasoning: response.reasoning
    };
  } catch (error) {
    console.error('Document AI processing error:', error);
    throw new Error(`Document AI processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Validate expert profile data
export async function validateExpertProfile(profileData: any): Promise<{
  isValid: boolean;
  errors: string[];
  suggestions: string[];
}> {
  try {
    const prompt = `
      Validate this expert profile data and provide feedback:
      
      ${JSON.stringify(profileData, null, 2)}
      
      Please respond with a JSON object containing:
      - isValid: boolean indicating if the profile is complete and valid
      - errors: array of validation errors found
      - suggestions: array of suggestions for improvement
    `;

    const response = await claudeService.getJsonResponse(prompt);

    return {
      isValid: response.isValid || false,
      errors: response.errors || [],
      suggestions: response.suggestions || []
    };
  } catch (error) {
    console.error('Expert profile validation error:', error);
    return {
      isValid: false,
      errors: ['Failed to validate profile'],
      suggestions: []
    };
  }
}

// Extract key information from document content
export async function extractKeyInfo(content: string): Promise<{
  title?: string;
  summary?: string;
  keywords?: string[];
  entities?: string[];
}> {
  try {
    const prompt = `
      Extract key information from this document content:
      
      ${content.substring(0, 3000)}
      
      Please respond with a JSON object containing:
      - title: suggested title for the document
      - summary: brief summary (max 200 words)
      - keywords: array of relevant keywords
      - entities: array of people, organizations, or concepts mentioned
    `;

    const response = await claudeService.getJsonResponse(prompt);

    return {
      title: response.title,
      summary: response.summary,
      keywords: response.keywords || [],
      entities: response.entities || []
    };
  } catch (error) {
    console.error('Key info extraction error:', error);
    return {};
  }
}