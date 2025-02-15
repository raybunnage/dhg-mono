import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/types/supabase'; // Update to correct path

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

// Add type definitions for database tables
interface ExpertDocument {
  id: string;
  raw_content: string;
  source_id: string;
  processed_at?: string;
  processing_status?: 'pending' | 'processing' | 'completed' | 'failed';
  source?: {
    name: string;
    mime_type: string;
  }
}

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

export async function processDocumentWithAI(documentId: string): Promise<ExpertProfile> {
  const processingStatus: ProcessingStatus = {
    stage: 'init',
    documentId,
    startTime: new Date().toISOString()
  };

  try {
    // 1. Environment check
    debug.log('init', { documentId });
    if (!import.meta.env.VITE_ANTHROPIC_API_KEY) {
      throw new AIProcessingError('init', 'VITE_ANTHROPIC_API_KEY is not set');
    }

    // 2. Check current processing status
    processingStatus.stage = 'status-check';
    const { data: currentDoc, error: statusError } = await supabase
      .from('expert_documents')
      .select('processing_status, processed_at')
      .eq('id', documentId)
      .single();

    if (statusError) {
      debug.error('status-check', statusError);
      throw new AIProcessingError('status-check', `Failed to check document status: ${statusError.message}`);
    }

    debug.log('status-check', { currentStatus: currentDoc?.processing_status });
    
    if (currentDoc?.processing_status === 'processing') {
      const lastProcessed = new Date(currentDoc.processed_at || 0);
      const processingTime = Date.now() - lastProcessed.getTime();
      
      // If processing for more than 5 minutes, allow retry
      if (processingTime < 5 * 60 * 1000) {
        throw new AIProcessingError('status-check', 'Document is already being processed');
      }
      debug.log('status-check', 'Processing timeout detected, allowing retry');
    }

    // 3. Update status to processing
    processingStatus.stage = 'status-update';
    const { error: updateError } = await supabase
      .from('expert_documents')
      .update({
        processing_status: 'processing',
        processed_at: new Date().toISOString()
      })
      .eq('id', documentId);

    if (updateError) {
      debug.error('status-update', updateError);
      throw new AIProcessingError('status-update', `Failed to update processing status: ${updateError.message}`);
    }

    // 4. Fetch document content
    processingStatus.stage = 'fetch-document';
    const { data: doc, error: docError } = await supabase
      .from('expert_documents')
      .select(`
        id,
        raw_content,
        source:source_id (
          name,
          mime_type
        )
      `)
      .eq('id', documentId)
      .single();

    if (docError) {
      debug.error('fetch-document', docError);
      throw new AIProcessingError('fetch-document', `Failed to fetch document: ${docError.message}`);
    }

    if (!doc?.raw_content) {
      throw new AIProcessingError('fetch-document', 'Document content is empty');
    }

    debug.log('fetch-document', {
      contentLength: doc.raw_content.length,
      sourceType: doc.source?.mime_type
    });

    // 5. Call Claude API
    processingStatus.stage = 'ai-processing';
    debug.log('ai-processing', 'Initiating Claude API call');
    
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'anthropic-version': '2024-01-01',
        'x-api-key': import.meta.env.VITE_ANTHROPIC_API_KEY
      },
      body: JSON.stringify({
        model: "claude-3-5-sonnet-20241022",
        messages: [
          {
            role: "user",
            content: `You are tasked with extracting specific information about a medical expert from the provided document. Please return ONLY a JSON object with the following fields (omit any fields where information is not clearly stated in the document):

            {
              "name": "Expert's full name",
              "specialties": ["Array of specialties"],
              "education": ["Array of educational background"],
              "experience": "Professional experience description",
              "bio": "Professional biography"
            }

            Document content:
            ${doc.raw_content}
            `
          }
        ],
        max_tokens: 4000,
        temperature: 0
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      debug.error('ai-processing', {
        status: response.status,
        statusText: response.statusText,
        error: errorText
      });
      throw new AIProcessingError('ai-processing', `API error ${response.status}: ${errorText}`);
    }

    const aiResponse = await response.json();
    debug.log('ai-processing', { responseStructure: Object.keys(aiResponse) });

    // 6. Parse and validate AI response
    processingStatus.stage = 'response-parsing';
    let expertProfile: ExpertProfile;
    try {
      const responseText = aiResponse.content[0].text;
      debug.log('response-parsing', { rawResponse: responseText });
      
      expertProfile = JSON.parse(responseText);
      
      if (!expertProfile.name) {
        throw new AIProcessingError('response-parsing', 'AI response missing required name field');
      }

      debug.log('response-parsing', { 
        parsedProfile: {
          name: expertProfile.name,
          hasSpecialties: !!expertProfile.specialties?.length,
          hasEducation: !!expertProfile.education?.length,
          hasExperience: !!expertProfile.experience,
          hasBio: !!expertProfile.bio
        }
      });

    } catch (parseError) {
      debug.error('response-parsing', parseError);
      throw new AIProcessingError('response-parsing', 'Failed to parse AI response', parseError);
    }

    // 7. Update expert profile
    processingStatus.stage = 'database-update';
    const { error: expertUpdateError } = await supabase
      .from('experts')
      .upsert({
        expert_name: expertProfile.name,
        specialties: expertProfile.specialties || [],
        education: expertProfile.education || [],
        experience: expertProfile.experience || '',
        bio: expertProfile.bio || '',
        updated_at: new Date().toISOString()
      });

    if (expertUpdateError) {
      debug.error('database-update', expertUpdateError);
      throw new AIProcessingError('database-update', `Failed to update expert profile: ${expertUpdateError.message}`);
    }

    // 8. Mark processing as complete
    processingStatus.stage = 'completion';
    await supabase
      .from('expert_documents')
      .update({
        processing_status: 'completed',
        processed_at: new Date().toISOString()
      })
      .eq('id', documentId);

    debug.log('completion', {
      documentId,
      processingTime: Date.now() - new Date(processingStatus.startTime).getTime(),
      status: 'success'
    });

    return expertProfile;

  } catch (error) {
    // Detailed error logging
    debug.error(processingStatus.stage, error);
    
    // Update document status to failed
    try {
      await supabase
        .from('expert_documents')
        .update({
          processing_status: 'failed',
          processed_at: new Date().toISOString()
        })
        .eq('id', documentId);
    } catch (statusError) {
      debug.error('error-handling', statusError);
    }

    // Rethrow with context
    throw new AIProcessingError(
      processingStatus.stage,
      error instanceof Error ? error.message : 'Unknown error occurred',
      error
    );
  }
} 