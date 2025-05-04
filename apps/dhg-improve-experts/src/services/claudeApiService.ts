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
  
  console.log(`Making Claude API request to model: ${model} with temperature: ${temperature}`);
  console.log(`Prompt: ${prompt.substring(0, 100)}...`);
  
  try {
    // Make API request through our proxy API
    const response = await fetch('/api/claude-api', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature,
        max_tokens: maxTokens,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      })
    });
    
    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`Claude API error: ${response.status} ${response.statusText}\n${errorData}`);
    }
    
    const data = await response.json();
    const completion = data.content?.[0]?.text || '';
    
    return { completion };
  } catch (error) {
    console.error('Error in Claude API request:', error);
    throw error;
  }
};

/**
 * Generate text completion with Claude (mock implementation)
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
 * Process a document with Claude (mock implementation)
 */
export const processDocument = async (
  documentContent: string,
  promptTemplate: string,
  temperature: number = 0
): Promise<Record<string, unknown>> => {
  try {
    // Replace placeholder in prompt template with actual document content
    const fullPrompt = promptTemplate.replace('{{DOCUMENT_CONTENT}}', documentContent);
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Check if the prompt is for an expert extraction
    if (promptTemplate.includes('expert') || promptTemplate.includes('profile')) {
      // Return mock expert profile
      return {
        basic_information: {
          name: "Dr. Jane Smith",
          title: "Professor",
          current_position: "Director of AI Research",
          institution: "University of Technology",
          credentials: ["Ph.D. in Computer Science", "M.S. in Mathematics"],
          specialty_areas: ["Machine Learning", "Natural Language Processing", "AI Ethics"]
        },
        research_summary: "Dr. Smith specializes in developing explainable AI systems that can be understood and trusted by humans. Her recent work focuses on creating neural networks that can provide reasoning for their decisions.",
        notable_achievements: [
          "Developed the TransparentML framework for explainable AI",
          "Published over 50 peer-reviewed articles in top AI journals",
          "Recipient of the National Science Foundation Career Award"
        ],
        professional_links: {
          website_urls: ["https://janesmith.example.edu"],
          social_media: ["https://twitter.com/drjanesmith"]
        },
        expertise_keywords: ["Explainable AI", "Neural Networks", "Machine Learning", "AI Ethics", "Computer Vision"]
      };
    }
    
    // Generic JSON response for other requests
    return { 
      rawResponse: `This is a mock response from Claude Sonnet 3.7.
      
The document was analyzed and processed successfully.

Document length: ${documentContent.length} characters.`,
      success: true,
      mockData: true
    };
  } catch (error) {
    console.error('Error processing document:', error);
    throw new Error(`Document processing error: ${error.message}`);
  }
};