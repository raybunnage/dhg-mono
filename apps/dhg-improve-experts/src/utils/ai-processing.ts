import { supabase } from '@/integrations/supabase/client';
import type { Database } from '../types/supabase';
import { toast } from 'react-hot-toast';
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';

// Debugging utility
const debug = {
  log: (stage: string, data: any) => {
    console.log(`[AI Processing][${stage}]`, data);
  },
  error: (stage: string, error: any) => {
    console.error(`[AI Processing][${stage}] Error:`, {
      message: error.message,
      cause: error.cause,
      stack: error.stack,
      details: error
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

export async function processWithAI({
  systemPrompt,
  userMessage,
  temperature = 0.7,
  requireJsonOutput = false,
  validateResponse,
  signal
}: ProcessWithAIOptions) {
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
      model: 'claude-3-5-sonnet-20241022',
      messagePreview: userMessage.slice(0, 100) + '...',
      systemPromptPreview: systemPrompt.slice(0, 100) + '...'
    });

    // Remove signal from request if it causes issues
    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
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

    if (requireJsonOutput) {
      try {
        const parsed = JSON.parse(content);
        
        // If a validation function is provided, use it
        if (validateResponse) {
          return validateResponse(parsed);
        }
        
        return parsed;
      } catch (parseError) {
        debug.error('json-parsing', {
          error: parseError,
          content: content.slice(0, 500) + '...',
          message: 'Failed to parse AI response as JSON'
        });
        throw new AIProcessingError('json-parsing', 'AI response was not valid JSON', parseError);
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
    // Get document content from Supabase
    const { data: doc, error } = await supabase
      .from('sources_google')
      .select('content, metadata')
      .eq('id', documentId)
      .single();

    if (error || !doc) {
      throw new Error('Document not found');
    }

    // Extract document structure
    const structure = await extractDocumentStructure(doc.content);
    
    // Identify expertise
    const expertise = await identifyExpertise(structure);
    
    // Validate AI response
    const validatedExpertise = validateAIResponse(expertise);

    // Update document with AI analysis
    await supabase
      .from('sources_google')
      .update({
        ai_analysis: validatedExpertise,
        ai_processed: true,
        ai_processed_at: new Date().toISOString()
      })
      .eq('id', documentId);

    return validatedExpertise;

  } catch (error) {
    console.error('AI processing failed:', error);
    throw error;
  }
}

async function extractDocumentStructure(content: string) {
  const response = await retryWithAI(async () => {
    const message = await anthropic.messages.create({
      model: 'claude-3-sonnet-20240229',
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
    model: 'claude-3-sonnet-20240229',
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