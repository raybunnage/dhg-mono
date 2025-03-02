/**
 * Service for interacting with Claude Sonnet 3.7 API
 */

interface ClaudeRequestOptions {
  prompt: string;
  temperature?: number;
  maxTokens?: number;
  model?: string;
}

interface ClaudeResponse {
  completion: string;
  // Add other fields as needed
}

/**
 * Make a request to the Claude API
 */
export const makeClaudeRequest = async (options: ClaudeRequestOptions): Promise<ClaudeResponse> => {
  const { prompt, temperature = 0, maxTokens = 4000, model = 'claude-3-7-sonnet-20250219' } = options;
  
  // Get API key from localStorage
  const apiKey = localStorage.getItem('claude-api-key');
  
  if (!apiKey) {
    throw new Error('Claude API key not found. Please add your API key in the settings.');
  }
  
  // This would be a real API call in production
  // For now, let's just simulate a response
  console.log(`Making Claude API request with temperature: ${temperature}`);
  
  // Mock response - replace with actual API call
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        completion: `This is a simulated response from Claude Sonnet 3.7.
        
The prompt was:
${prompt.substring(0, 100)}...

In a real implementation, this would contain the actual response from the Claude API.`
      });
    }, 1500); // simulate API delay
  });
};

/**
 * Generate text completion with Claude
 */
export const generateCompletion = async (
  prompt: string,
  temperature: number = 0
): Promise<string> => {
  try {
    const response = await makeClaudeRequest({ prompt, temperature });
    return response.completion;
  } catch (error) {
    console.error('Error generating completion:', error);
    throw new Error(`Claude API error: ${error.message}`);
  }
};

/**
 * Process a document with Claude
 */
export const processDocument = async (
  documentContent: string,
  promptTemplate: string,
  temperature: number = 0
): Promise<Record<string, unknown>> => {
  try {
    // Replace placeholder in prompt template with actual document content
    const fullPrompt = promptTemplate.replace('{{DOCUMENT_CONTENT}}', documentContent);
    
    const response = await makeClaudeRequest({ prompt: fullPrompt, temperature });
    
    // Extract JSON from the response if it exists
    const jsonMatch = response.completion.match(/```json\n([\s\S]*?)```/);
    if (jsonMatch && jsonMatch[1]) {
      try {
        return JSON.parse(jsonMatch[1]);
      } catch (e) {
        console.error('Error parsing JSON from Claude response:', e);
        return { rawResponse: response.completion };
      }
    }
    
    return { rawResponse: response.completion };
  } catch (error) {
    console.error('Error processing document:', error);
    throw new Error(`Document processing error: ${error.message}`);
  }
};