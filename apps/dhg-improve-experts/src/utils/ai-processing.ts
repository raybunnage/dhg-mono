import { supabase } from '@/integrations/supabase/client';
import type { Database } from '../types/supabase';
import { toast } from 'react-hot-toast';
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';

// Enhance debug utility
const debug = {
  log: (stage: string, data: any) => {
    console.log(`[AI Processing][${stage}]`, {
      ...data,
      timestamp: new Date().toISOString()
    });
  },
  error: (stage: string, error: any) => {
    console.error(`[AI Processing][${stage}] Error:`, {
      message: error.message,
      cause: error.cause,
      stack: error.stack,
      details: error,
      timestamp: new Date().toISOString()
    });
  },
  content: (stage: string, content: any) => {
    console.log(`[AI Processing][${stage}] Content:`, {
      type: typeof content,
      isNull: content === null,
      length: content?.length,
      preview: typeof content === 'string' ? content.slice(0, 100) : 'non-string content',
      timestamp: new Date().toISOString()
    });
  }
};

// Update type to use Database type
type ExpertDocument = Database['public']['Tables']['expert_documents']['Row'];

interface Expert {
  id?: string;
  expert_name: string; // Changed from 'name' to match schema
  specialties?: string[];
  education?: string[];
  experience?: string;
  bio?: string;
  updated_at?: string;
}

interface ExpertProfile {
  name: string;
  specialties?: string[];
  education?: string[];
  experience?: string;
  bio?: string;
}

// Custom error types for better error handling
class AIProcessingError extends Error {
  constructor(stage: string, message: string, public cause?: unknown) {
    super(`[${stage}] ${message}`);
    this.name = 'AIProcessingError';
  }
}

interface ProcessingStatus {
  stage: string;
  documentId: string;
  startTime: string;
  error?: any;
}

interface ProcessWithAIOptions {
  systemPrompt: string;
  userMessage: string;
  temperature?: number;
  requireJsonOutput?: boolean;
  validateResponse?: (response: any) => any;
  signal?: AbortSignal;
}

const anthropic = new Anthropic({
  apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY,
  dangerouslyAllowBrowser: true
});

// Response validation schema
const ExpertiseSchema = z.object({
  areas: z.array(z.object({
    name: z.string(),
    confidence: z.number(),
    evidence: z.array(z.string())
  })),
  summary: z.string()
});

// Add constant for model name
// const MODEL_NAME = "claude-3-5-sonnet-20241022";
const MODEL_NAME_NEW = "claude-3-7-sonnet-20250219";

// Add type for valid sync statuses
const SYNC_STATUS = {
  PENDING: 'pending',
  SYNCED: 'synced',
  ERROR: 'error',
  DISABLED: 'disabled'
} as const;

type SyncStatus = typeof SYNC_STATUS[keyof typeof SYNC_STATUS];

// Update the schema to be more flexible
const ExpertProfileSchema = z.object({
  basic_information: z.object({
    name: z.string(),
    title: z.string().default(""),
    current_position: z.string().default(""),
    institution: z.string().default(""),
    credentials: z.union([
      z.array(z.string()),
      z.string().transform(str => str ? [str] : [])
    ]).default([]),
    specialty_areas: z.union([
      z.array(z.string()),
      z.string().transform(str => str ? [str] : [])
    ]).default([])
  }),
  research_summary: z.string().default(""),
  notable_achievements: z.union([
    z.array(z.string()),
    z.string().transform(str => str ? [str] : [])
  ]).default([]),
  professional_links: z.object({
    website_urls: z.array(z.string()).default([]),
    social_media: z.array(z.string()).default([])
  }).default({}),
  expertise_keywords: z.array(z.string()).default([])
});

// Update the validation function to handle text response
export const validateExpertProfile = (response: any) => {
  try {
    // Log the raw input first
    debug.log('validate-input', {
      responseType: typeof response,
      responseLength: response?.length,
      responsePreview: typeof response === 'string' ? response.slice(0, 300) : 'non-string response'
    });

    let data: any;
    
    if (typeof response === 'string') {
      // Find the first '{' and last '}' to extract just the JSON
      const startIndex = response.indexOf('{');
      const endIndex = response.lastIndexOf('}') + 1;
      
      debug.log('json-extraction-bounds', {
        startIndex,
        endIndex,
        fullLength: response.length,
        hasStartBrace: startIndex >= 0,
        hasEndBrace: endIndex > 0,
        textBeforeJson: startIndex > 0 ? response.slice(0, startIndex) : 'none',
        textAfterJson: endIndex < response.length ? response.slice(endIndex) : 'none'
      });

      const jsonStr = response.slice(startIndex, endIndex);
      
      debug.log('extracted-json', {
        extractedLength: jsonStr.length,
        extractedPreview: jsonStr.slice(0, 300),
        isValidJson: (() => {
          try {
            JSON.parse(jsonStr);
            return true;
          } catch (e) {
            return false;
          }
        })()
      });

      try {
        data = JSON.parse(jsonStr);
      } catch (parseError) {
        debug.error('json-parse-error', {
          error: parseError,
          jsonPreview: jsonStr.slice(0, 500),
          errorLocation: (parseError as Error).message,
          fullResponse: response
        });
        throw parseError;
      }
    } else {
      data = response;
    }

    debug.log('pre-validation-data', {
      hasBasicInfo: !!data?.basic_information,
      dataKeys: Object.keys(data || {}),
      basicInfoKeys: Object.keys(data?.basic_information || {}),
      credentialsType: typeof data?.basic_information?.credentials,
      credentialsValue: data?.basic_information?.credentials,
      specialtyAreasType: typeof data?.basic_information?.specialty_areas,
      specialtyAreasValue: data?.basic_information?.specialty_areas
    });

    // Try parsing with schema
    try {
      const validated = ExpertProfileSchema.parse(data);
      debug.log('validation-success', {
        validatedKeys: Object.keys(validated),
        basicInfoKeys: Object.keys(validated.basic_information),
        credentialsCount: validated.basic_information.credentials.length,
        specialtyAreasCount: validated.basic_information.specialty_areas.length
      });
      return validated;
    } catch (validationError) {
      debug.error('schema-validation-error', {
        error: validationError,
        failedData: data,
        zodError: validationError instanceof Error ? validationError.message : 'Unknown error'
      });
      throw validationError;
    }
  } catch (error) {
    debug.error('expert-profile-validation-failed', {
      error,
      stage: error instanceof Error ? error.message : 'Unknown error',
      rawResponse: typeof response === 'string' ? response.slice(0, 1000) : response
    });
    throw new AIProcessingError('validation', 'Failed to validate expert profile', error);
  }
};

// Update processWithAI to handle validation better
export async function processWithAI({
  systemPrompt,
  userMessage,
  temperature = 0.7,
  requireJsonOutput = false,
  validateResponse,
  signal
}: ProcessWithAIOptions) {
  console.log('AI Processing - Input:', {
    systemPromptLength: systemPrompt.length,
    userMessageLength: userMessage.length,
    temperature,
    requireJsonOutput
  });

  const startTime = Date.now();
  
  try {
    debug.log('init', {
      messageLength: userMessage.length,
      systemPromptLength: systemPrompt.length,
      temperature
    });

    const anthropic = new Anthropic({
      apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY,
      dangerouslyAllowBrowser: true
    });

    debug.log('request', {
      model: MODEL_NAME_NEW,
      messagePreview: userMessage.slice(0, 100) + '...',
      systemPromptPreview: systemPrompt.slice(0, 100) + '...'
    });

    // Use the latest Claude model (or fallback to older one if not available)
    const model = MODEL_NAME_NEW;
    console.log(`Using AI model: ${model}`);
    
    const response = await anthropic.messages.create({
      model,
      max_tokens: 4096,
      temperature,
      system: systemPrompt,
      messages: [{
        role: 'user',
        content: userMessage
      }]
      // Remove signal here as it's causing the 400 error
    });

    // Check for abort after the request
    if (signal?.aborted) {
      throw new Error('Processing aborted by user');
    }

    const content = response.content[0].type === 'text' 
      ? response.content[0].text 
      : '';

    // Add more detailed logging
    debug.log('ai-response', {
      contentType: typeof content,
      length: content.length,
      preview: content.slice(0, 100)
    });

    console.log('AI Processing - Raw Response:', {
      responseType: typeof content,
      responseLength: content?.length,
      preview: content?.slice(0, 200)
    });

    if (requireJsonOutput) {
      try {
        // Attempt to parse as JSON first
        const parsed = JSON.parse(content);
        console.log('AI Processing - JSON Parsed:', {
          hasData: Boolean(parsed),
          topLevelKeys: Object.keys(parsed)
        });
        
        // Run custom validation if provided
        if (validateResponse) {
          const validated = validateResponse(parsed);
          console.log('AI Processing - Validated:', {
            hasValidated: Boolean(validated),
            type: typeof validated
          });
          return validated;
        }
        return parsed;
      } catch (parseError) {
        console.error('AI Processing - JSON Parse Error:', {
          error: parseError,
          response: content?.slice(0, 500)
        });
        throw new Error(`Failed to parse AI response as JSON: ${parseError.message}`);
      }
    }

    return content;

  } catch (error) {
    if (signal?.aborted) {
      throw new Error('Processing aborted by user');
    }
    // Detailed error logging based on error type
    if (error instanceof AIProcessingError) {
      debug.error(error.name, {
        stage: error.message.split(']')[0].slice(1),
        message: error.message,
        cause: error.cause
      });
    } else if (error instanceof Error) {
      debug.error('anthropic-api', {
        name: error.name,
        message: error.message,
        stack: error.stack,
        processingTime: `${Date.now() - startTime}ms`
      });
    } else {
      debug.error('unknown', {
        error,
        processingTime: `${Date.now() - startTime}ms`
      });
    }

    // User-friendly error message
    const errorMessage = error instanceof Error 
      ? `AI processing failed: ${error.message}`
      : 'An unknown error occurred during AI processing';
    
    toast.error(errorMessage);
    throw error;
  }
}

export async function processDocumentWithAI(documentId: string) {
  try {
    let doc: any; // Declare doc in outer scope
    
    debug.log('start', { 
      documentId,
      timestamp: new Date().toISOString(),
      stage: 'initial',
      function: 'processDocumentWithAI'
    });

    // Load prompt first
    let prompt: string;
    try {
      const response = await fetch('/docs/prompts/expert-extraction-prompt.md');
      if (!response.ok) {
        throw new Error(`Failed to load prompt: ${response.status}`);
      }
      prompt = await response.text();

      // Get document with all necessary relations
      const { data: docResult, error } = await supabase
        .from('expert_documents')
        .select(`
          id,
          raw_content,
          document_type_id,
          processing_status
        `)
        .eq('id', documentId)
        .single();

      doc = docResult; // Assign to outer scope variable

      // Create the system prompt here where we have access to 'prompt'
      const systemPrompt = prompt + `
\nIMPORTANT: Your response must be ONLY a valid JSON object with no additional text before or after. For missing information, use empty arrays [] or empty strings "". Example:
{
  "basic_information": {
    "name": "Dr. Example Name",
    "title": "Professor",
    "current_position": "Director",
    "institution": "University",
    "credentials": [],
    "specialty_areas": []
  },
  "research_summary": "",
  "notable_achievements": [],
  "professional_links": {
    "website_urls": [],
    "social_media": []
  },
  "expertise_keywords": []
}`;

      // Query document with detailed logging
      debug.log('querying-document', {
        id: documentId,
        table: 'expert_documents'
      });

      // Content validation with type checking
      if (!doc.raw_content) {
        throw new Error('Document has no content');
      }

      // Process with detailed logging
      const result = await processWithAI({
        systemPrompt,
        userMessage: doc.raw_content,
        requireJsonOutput: true,
        validateResponse: validateExpertProfile
      });

      // Log the raw response for debugging
      console.log('AI Raw Response:', {
        type: typeof result,
        preview: typeof result === 'string' ? result.slice(0, 200) : JSON.stringify(result).slice(0, 200)
      });

      // Update document status
      const { error: updateError } = await supabase
        .from('expert_documents')
        .update({
          processing_status: 'completed',
          processed_content: {
            raw: doc.raw_content,
            ai_analysis: result,
            processed_at: new Date().toISOString()
          }
        })
        .eq('id', doc.id);

      if (updateError) {
        throw new Error(`Failed to update document: ${updateError.message}`);
      }

      return result;

    } catch (processError) {
      debug.error('processing-failed', {
        docId: doc.id,
        error: processError
      });

      // Update error status
      await supabase
        .from('expert_documents')
        .update({
          processing_status: 'failed',
          processing_error: processError.message
        })
        .eq('id', doc.id);

      throw processError;
    }

  } catch (error) {
    debug.error('fatal-error', {
      documentId,
      error: error instanceof Error ? {
        message: error.message,
        stack: error.stack
      } : 'Unknown error'
    });
    throw error;
  }
}

async function extractDocumentStructure(content: string) {
  const response = await retryWithAI(async () => {
    const message = await anthropic.messages.create({
      model: MODEL_NAME,  // Fixed model name
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: `Analyze this document and identify its main sections and structure: ${content}`
      }]
    });
    return message.content;
  });

  return response;
}

async function identifyExpertise(structuredContent: string) {
  const response = await anthropic.messages.create({
    model: MODEL_NAME,  // Fixed model name
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: `Identify areas of expertise from this content. Return as JSON with areas array containing name, confidence (0-1), and evidence array: ${structuredContent}`
    }]
  });

  return response.content;
}

function validateAIResponse(response: any) {
  return ExpertiseSchema.parse(JSON.parse(response));
}

async function retryWithAI<T>(
  operation: () => Promise<T>, 
  maxRetries = 3,
  delay = 1000
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
    }
  }
  throw new Error('Max retries exceeded');
} 