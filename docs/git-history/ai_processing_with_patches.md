## 62aae8f
**Date:** 2025-02-17 10:38:30 -0800
**Message:** a lot of changes for the function registry iut looks like

**Changes:**



diff --git a/apps/dhg-improve-experts/src/utils/ai-processing.ts b/apps/dhg-improve-experts/src/utils/ai-processing.ts
index 203fb1b..6754465 100644
--- a/apps/dhg-improve-experts/src/utils/ai-processing.ts
+++ b/apps/dhg-improve-experts/src/utils/ai-processing.ts
@@ -1,7 +1,8 @@
 import { supabase } from '@/integrations/supabase/client';
 import type { Database } from '../types/supabase';
 import { toast } from 'react-hot-toast';
-import { Anthropic } from '@anthropic-ai/sdk';
+import Anthropic from '@anthropic-ai/sdk';
+import { z } from 'zod';
 
 // Debugging utility
 const debug = {
@@ -62,6 +63,21 @@ interface ProcessWithAIOptions {
   signal?: AbortSignal;
 }
 
+const anthropic = new Anthropic({
+  apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY,
+  dangerouslyAllowBrowser: true
+});
+
+// Response validation schema
+const ExpertiseSchema = z.object({
+  areas: z.array(z.object({
+    name: z.string(),
+    confidence: z.number(),
+    evidence: z.array(z.string())
+  })),
+  summary: z.string()
+});
+
 export async function processWithAI({
   systemPrompt,
   userMessage,
@@ -166,225 +182,91 @@ export async function processWithAI({
   }
 }
 
-export async function processDocumentWithAI(documentId: string): Promise<ExpertProfile> {
-  const processingStatus: ProcessingStatus = {
-    stage: 'init',
-    documentId,
-    startTime: new Date().toISOString()
-  };
-
+export async function processDocumentWithAI(documentId: string) {
   try {
-    // 1. Environment check
-    debug.log('init', { documentId });
-    if (!import.meta.env.VITE_ANTHROPIC_API_KEY) {
-      throw new AIProcessingError('init', 'VITE_ANTHROPIC_API_KEY is not set');
-    }
-
-    // 2. Check current processing status
-    processingStatus.stage = 'status-check';
-    const { data: currentDoc, error: statusError } = await supabase
-      .from('expert_documents')
-      .select('processing_status, processed_at')
+    // Get document content from Supabase
+    const { data: doc, error } = await supabase
+      .from('sources_google')
+      .select('content, metadata')
       .eq('id', documentId)
       .single();
 
-    if (statusError) {
-      debug.error('status-check', statusError);
-      throw new AIProcessingError('status-check', `Failed to check document status: ${statusError.message}`);
+    if (error || !doc) {
+      throw new Error('Document not found');
     }
 
-    debug.log('status-check', { currentStatus: currentDoc?.processing_status });
+    // Extract document structure
+    const structure = await extractDocumentStructure(doc.content);
     
-    if (currentDoc?.processing_status === 'processing') {
-      const lastProcessed = new Date(currentDoc.processed_at || 0);
-      const processingTime = Date.now() - lastProcessed.getTime();
-      
-      // If processing for more than 5 minutes, allow retry
-      if (processingTime < 5 * 60 * 1000) {
-        throw new AIProcessingError('status-check', 'Document is already being processed');
-      }
-      debug.log('status-check', 'Processing timeout detected, allowing retry');
-    }
+    // Identify expertise
+    const expertise = await identifyExpertise(structure);
+    
+    // Validate AI response
+    const validatedExpertise = validateAIResponse(expertise);
 
-    // 3. Update status to processing
-    processingStatus.stage = 'status-update';
-    const { error: updateError } = await supabase
-      .from('expert_documents')
+    // Update document with AI analysis
+    await supabase
+      .from('sources_google')
       .update({
-        processing_status: 'processing',
-        processed_at: new Date().toISOString()
+        ai_analysis: validatedExpertise,
+        ai_processed: true,
+        ai_processed_at: new Date().toISOString()
       })
       .eq('id', documentId);
 
-    if (updateError) {
-      debug.error('status-update', updateError);
-      throw new AIProcessingError('status-update', `Failed to update processing status: ${updateError.message}`);
-    }
-
-    // 4. Fetch document content
-    processingStatus.stage = 'fetch-document';
-    const { data: doc, error: docError } = await supabase
-      .from('expert_documents')
-      .select(`
-        id,
-        raw_content,
-        source:source_id (
-          name,
-          mime_type
-        )
-      `)
-      .eq('id', documentId)
-      .single();
-
-    if (docError) {
-      debug.error('fetch-document', docError);
-      throw new AIProcessingError('fetch-document', `Failed to fetch document: ${docError.message}`);
-    }
+    return validatedExpertise;
 
-    if (!doc?.raw_content) {
-      throw new AIProcessingError('fetch-document', 'Document content is empty');
-    }
-
-    debug.log('fetch-document', {
-      contentLength: doc.raw_content.length,
-      sourceType: doc.source?.mime_type
-    });
-
-    // 5. Call Claude API
-    processingStatus.stage = 'ai-processing';
-    debug.log('ai-processing', 'Initiating Claude API call');
-    
-    const response = await fetch('https://api.anthropic.com/v1/messages', {
-      method: 'POST',
-      headers: {
-        'Content-Type': 'application/json',
-        'anthropic-version': '2024-01-01',
-        'x-api-key': import.meta.env.VITE_ANTHROPIC_API_KEY
-      },
-      body: JSON.stringify({
-        model: "claude-3-5-sonnet-20241022",
-        messages: [
-          {
-            role: "user",
-            content: `You are tasked with extracting specific information about a medical expert from the provided document. Please return ONLY a JSON object with the following fields (omit any fields where information is not clearly stated in the document):
-
-            {
-              "name": "Expert's full name",
-              "specialties": ["Array of specialties"],
-              "education": ["Array of educational background"],
-              "experience": "Professional experience description",
-              "bio": "Professional biography"
-            }
+  } catch (error) {
+    console.error('AI processing failed:', error);
+    throw error;
+  }
+}
 
-            Document content:
-            ${doc.raw_content}
-            `
-          }
-        ],
-        max_tokens: 4000,
-        temperature: 0
-      })
+async function extractDocumentStructure(content: string) {
+  const response = await retryWithAI(async () => {
+    const message = await anthropic.messages.create({
+      model: 'claude-3-sonnet-20240229',
+      max_tokens: 1024,
+      messages: [{
+        role: 'user',
+        content: `Analyze this document and identify its main sections and structure: ${content}`
+      }]
     });
+    return message.content;
+  });
 
-    if (!response.ok) {
-      const errorText = await response.text();
-      debug.error('ai-processing', {
-        status: response.status,
-        statusText: response.statusText,
-        error: errorText
-      });
-      throw new AIProcessingError('ai-processing', `API error ${response.status}: ${errorText}`);
-    }
-
-    const aiResponse = await response.json();
-    debug.log('ai-processing', { responseStructure: Object.keys(aiResponse) });
-
-    // 6. Parse and validate AI response
-    processingStatus.stage = 'response-parsing';
-    let expertProfile: ExpertProfile;
-    try {
-      const responseText = aiResponse.content[0].text;
-      debug.log('response-parsing', { rawResponse: responseText });
-      
-      expertProfile = JSON.parse(responseText);
-      
-      if (!expertProfile.name) {
-        throw new AIProcessingError('response-parsing', 'AI response missing required name field');
-      }
-
-      debug.log('response-parsing', { 
-        parsedProfile: {
-          name: expertProfile.name,
-          hasSpecialties: !!expertProfile.specialties?.length,
-          hasEducation: !!expertProfile.education?.length,
-          hasExperience: !!expertProfile.experience,
-          hasBio: !!expertProfile.bio
-        }
-      });
-
-    } catch (parseError) {
-      debug.error('response-parsing', parseError);
-      throw new AIProcessingError('response-parsing', 'Failed to parse AI response', parseError);
-    }
-
-    // 7. Update expert profile
-    processingStatus.stage = 'database-update';
-    const { error: expertUpdateError } = await supabase
-      .from('experts')
-      .upsert({
-        expert_name: expertProfile.name,
-        specialties: expertProfile.specialties || [],
-        education: expertProfile.education || [],
-        experience: expertProfile.experience || '',
-        bio: expertProfile.bio || '',
-        updated_at: new Date().toISOString()
-      });
-
-    if (expertUpdateError) {
-      debug.error('database-update', expertUpdateError);
-      throw new AIProcessingError('database-update', `Failed to update expert profile: ${expertUpdateError.message}`);
-    }
-
-    // 8. Mark processing as complete
-    processingStatus.stage = 'completion';
-    await supabase
-      .from('expert_documents')
-      .update({
-        processing_status: 'completed',
-        processed_at: new Date().toISOString()
-      })
-      .eq('id', documentId);
+  return response;
+}
 
-    debug.log('completion', {
-      documentId,
-      processingTime: Date.now() - new Date(processingStatus.startTime).getTime(),
-      status: 'success'
-    });
+async function identifyExpertise(structuredContent: string) {
+  const response = await anthropic.messages.create({
+    model: 'claude-3-sonnet-20240229',
+    max_tokens: 1024,
+    messages: [{
+      role: 'user',
+      content: `Identify areas of expertise from this content. Return as JSON with areas array containing name, confidence (0-1), and evidence array: ${structuredContent}`
+    }]
+  });
+
+  return response.content;
+}
 
-    return expertProfile;
+function validateAIResponse(response: any) {
+  return ExpertiseSchema.parse(JSON.parse(response));
+}
 
-  } catch (error) {
-    // Detailed error logging
-    debug.error(processingStatus.stage, error);
-    
-    // Update document status to failed
+async function retryWithAI<T>(
+  operation: () => Promise<T>, 
+  maxRetries = 3,
+  delay = 1000
+): Promise<T> {
+  for (let i = 0; i < maxRetries; i++) {
     try {
-      await supabase
-        .from('expert_documents')
-        .update({
-          processing_status: 'failed',
-          processed_at: new Date().toISOString()
-        })
-        .eq('id', documentId);
-    } catch (statusError) {
-      debug.error('error-handling', statusError);
+      return await operation();
+    } catch (error) {
+      if (i === maxRetries - 1) throw error;
+      await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
     }
-
-    // Rethrow with context
-    throw new AIProcessingError(
-      processingStatus.stage,
-      error instanceof Error ? error.message : 'Unknown error occurred',
-      error
-    );
   }
+  throw new Error('Max retries exceeded');
 } 
\ No newline at end of file

## 0fa5705
**Date:** 2025-02-16 13:17:30 -0800
**Message:** added cursor rules for vite and for the cursor model

**Changes:**



diff --git a/apps/dhg-improve-experts/src/utils/ai-processing.ts b/apps/dhg-improve-experts/src/utils/ai-processing.ts
index e13a204..203fb1b 100644
--- a/apps/dhg-improve-experts/src/utils/ai-processing.ts
+++ b/apps/dhg-improve-experts/src/utils/ai-processing.ts
@@ -107,7 +107,9 @@ export async function processWithAI({
       throw new Error('Processing aborted by user');
     }
 
-    const content = response.content[0].text;
+    const content = response.content[0].type === 'text' 
+      ? response.content[0].text 
+      : '';
 
     if (requireJsonOutput) {
       try {

## 048d831
**Date:** 2025-02-16 11:43:38 -0800
**Message:** major checkin of reworked experts_profile with a better prompt:

**Changes:**



diff --git a/apps/dhg-improve-experts/src/utils/ai-processing.ts b/apps/dhg-improve-experts/src/utils/ai-processing.ts
index 372a5b5..e13a204 100644
--- a/apps/dhg-improve-experts/src/utils/ai-processing.ts
+++ b/apps/dhg-improve-experts/src/utils/ai-processing.ts
@@ -54,29 +54,28 @@ interface ProcessingStatus {
   error?: any;
 }
 
-interface AIProcessingOptions {
+interface ProcessWithAIOptions {
   systemPrompt: string;
   userMessage: string;
   temperature?: number;
   requireJsonOutput?: boolean;
-  maxTokens?: number;
+  signal?: AbortSignal;
 }
 
-export const processWithAI = async ({
+export async function processWithAI({
   systemPrompt,
   userMessage,
-  temperature = 0.0,
+  temperature = 0.7,
   requireJsonOutput = false,
-  maxTokens = 4000
-}: AIProcessingOptions) => {
+  signal
+}: ProcessWithAIOptions) {
   const startTime = Date.now();
   
   try {
     debug.log('init', {
       messageLength: userMessage.length,
       systemPromptLength: systemPrompt.length,
-      temperature,
-      maxTokens
+      temperature
     });
 
     const anthropic = new Anthropic({
@@ -90,23 +89,23 @@ export const processWithAI = async ({
       systemPromptPreview: systemPrompt.slice(0, 100) + '...'
     });
 
+    // Remove signal from request if it causes issues
     const response = await anthropic.messages.create({
       model: 'claude-3-5-sonnet-20241022',
-      max_tokens: maxTokens,
+      max_tokens: 4096,
       temperature,
       system: systemPrompt,
       messages: [{
         role: 'user',
         content: userMessage
       }]
+      // Remove signal here as it's causing the 400 error
     });
 
-    // Log successful response
-    debug.log('response', {
-      processingTime: `${Date.now() - startTime}ms`,
-      contentLength: response.content[0].text.length,
-      preview: response.content[0].text.slice(0, 100) + '...'
-    });
+    // Check for abort after the request
+    if (signal?.aborted) {
+      throw new Error('Processing aborted by user');
+    }
 
     const content = response.content[0].text;
 
@@ -131,6 +130,9 @@ export const processWithAI = async ({
     return content;
 
   } catch (error) {
+    if (signal?.aborted) {
+      throw new Error('Processing aborted by user');
+    }
     // Detailed error logging based on error type
     if (error instanceof AIProcessingError) {
       debug.error(error.name, {
@@ -160,7 +162,7 @@ export const processWithAI = async ({
     toast.error(errorMessage);
     throw error;
   }
-};
+}
 
 export async function processDocumentWithAI(documentId: string): Promise<ExpertProfile> {
   const processingStatus: ProcessingStatus = {

## 460f46d
**Date:** 2025-02-15 15:58:27 -0800
**Message:** now working profiles - on the fly seems to work

**Changes:**



diff --git a/apps/dhg-improve-experts/src/utils/ai-processing.ts b/apps/dhg-improve-experts/src/utils/ai-processing.ts
index a08474a..372a5b5 100644
--- a/apps/dhg-improve-experts/src/utils/ai-processing.ts
+++ b/apps/dhg-improve-experts/src/utils/ai-processing.ts
@@ -1,5 +1,7 @@
 import { supabase } from '@/integrations/supabase/client';
 import type { Database } from '../types/supabase';
+import { toast } from 'react-hot-toast';
+import { Anthropic } from '@anthropic-ai/sdk';
 
 // Debugging utility
 const debug = {
@@ -52,6 +54,114 @@ interface ProcessingStatus {
   error?: any;
 }
 
+interface AIProcessingOptions {
+  systemPrompt: string;
+  userMessage: string;
+  temperature?: number;
+  requireJsonOutput?: boolean;
+  maxTokens?: number;
+}
+
+export const processWithAI = async ({
+  systemPrompt,
+  userMessage,
+  temperature = 0.0,
+  requireJsonOutput = false,
+  maxTokens = 4000
+}: AIProcessingOptions) => {
+  const startTime = Date.now();
+  
+  try {
+    debug.log('init', {
+      messageLength: userMessage.length,
+      systemPromptLength: systemPrompt.length,
+      temperature,
+      maxTokens
+    });
+
+    const anthropic = new Anthropic({
+      apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY,
+      dangerouslyAllowBrowser: true
+    });
+
+    debug.log('request', {
+      model: 'claude-3-5-sonnet-20241022',
+      messagePreview: userMessage.slice(0, 100) + '...',
+      systemPromptPreview: systemPrompt.slice(0, 100) + '...'
+    });
+
+    const response = await anthropic.messages.create({
+      model: 'claude-3-5-sonnet-20241022',
+      max_tokens: maxTokens,
+      temperature,
+      system: systemPrompt,
+      messages: [{
+        role: 'user',
+        content: userMessage
+      }]
+    });
+
+    // Log successful response
+    debug.log('response', {
+      processingTime: `${Date.now() - startTime}ms`,
+      contentLength: response.content[0].text.length,
+      preview: response.content[0].text.slice(0, 100) + '...'
+    });
+
+    const content = response.content[0].text;
+
+    if (requireJsonOutput) {
+      try {
+        const parsed = JSON.parse(content);
+        debug.log('json-parsing', {
+          successful: true,
+          keys: Object.keys(parsed)
+        });
+        return parsed;
+      } catch (parseError) {
+        debug.error('json-parsing', {
+          error: parseError,
+          content: content.slice(0, 500) + '...',
+          message: 'Failed to parse AI response as JSON'
+        });
+        throw new AIProcessingError('json-parsing', 'AI response was not valid JSON', parseError);
+      }
+    }
+
+    return content;
+
+  } catch (error) {
+    // Detailed error logging based on error type
+    if (error instanceof AIProcessingError) {
+      debug.error(error.name, {
+        stage: error.message.split(']')[0].slice(1),
+        message: error.message,
+        cause: error.cause
+      });
+    } else if (error instanceof Error) {
+      debug.error('anthropic-api', {
+        name: error.name,
+        message: error.message,
+        stack: error.stack,
+        processingTime: `${Date.now() - startTime}ms`
+      });
+    } else {
+      debug.error('unknown', {
+        error,
+        processingTime: `${Date.now() - startTime}ms`
+      });
+    }
+
+    // User-friendly error message
+    const errorMessage = error instanceof Error 
+      ? `AI processing failed: ${error.message}`
+      : 'An unknown error occurred during AI processing';
+    
+    toast.error(errorMessage);
+    throw error;
+  }
+};
+
 export async function processDocumentWithAI(documentId: string): Promise<ExpertProfile> {
   const processingStatus: ProcessingStatus = {
     stage: 'init',

## a339927
**Date:** 2025-02-15 12:25:37 -0800
**Message:** changes for document-testing

**Changes:**



diff --git a/apps/dhg-improve-experts/src/utils/ai-processing.ts b/apps/dhg-improve-experts/src/utils/ai-processing.ts
index 89f8c0b..a08474a 100644
--- a/apps/dhg-improve-experts/src/utils/ai-processing.ts
+++ b/apps/dhg-improve-experts/src/utils/ai-processing.ts
@@ -1,5 +1,5 @@
 import { supabase } from '@/integrations/supabase/client';
-import { Database } from '@/types/supabase'; // Update to correct path
+import type { Database } from '../types/supabase';
 
 // Debugging utility
 const debug = {
@@ -16,18 +16,8 @@ const debug = {
   }
 };
 
-// Add type definitions for database tables
-interface ExpertDocument {
-  id: string;
-  raw_content: string;
-  source_id: string;
-  processed_at?: string;
-  processing_status?: 'pending' | 'processing' | 'completed' | 'failed';
-  source?: {
-    name: string;
-    mime_type: string;
-  }
-}
+// Update type to use Database type
+type ExpertDocument = Database['public']['Tables']['expert_documents']['Row'];
 
 interface Expert {
   id?: string;

## afbaa17
**Date:** 2025-02-15 12:03:46 -0800
**Message:** build testing of content extraction

**Changes:**



diff --git a/apps/dhg-improve-experts/src/utils/ai-processing.ts b/apps/dhg-improve-experts/src/utils/ai-processing.ts
index 9c31355..89f8c0b 100644
--- a/apps/dhg-improve-experts/src/utils/ai-processing.ts
+++ b/apps/dhg-improve-experts/src/utils/ai-processing.ts
@@ -1,4 +1,43 @@
 import { supabase } from '@/integrations/supabase/client';
+import { Database } from '@/types/supabase'; // Update to correct path
+
+// Debugging utility
+const debug = {
+  log: (stage: string, data: any) => {
+    console.log(`[AI Processing][${stage}]`, data);
+  },
+  error: (stage: string, error: any) => {
+    console.error(`[AI Processing][${stage}] Error:`, {
+      message: error.message,
+      cause: error.cause,
+      stack: error.stack,
+      details: error
+    });
+  }
+};
+
+// Add type definitions for database tables
+interface ExpertDocument {
+  id: string;
+  raw_content: string;
+  source_id: string;
+  processed_at?: string;
+  processing_status?: 'pending' | 'processing' | 'completed' | 'failed';
+  source?: {
+    name: string;
+    mime_type: string;
+  }
+}
+
+interface Expert {
+  id?: string;
+  expert_name: string; // Changed from 'name' to match schema
+  specialties?: string[];
+  education?: string[];
+  experience?: string;
+  bio?: string;
+  updated_at?: string;
+}
 
 interface ExpertProfile {
   name: string;
@@ -8,113 +47,240 @@ interface ExpertProfile {
   bio?: string;
 }
 
-export async function processDocumentWithAI(documentId: string): Promise<ExpertProfile> {
-  if (!import.meta.env.VITE_ANTHROPIC_API_KEY) {
-    throw new Error('VITE_ANTHROPIC_API_KEY is not set in environment variables');
+// Custom error types for better error handling
+class AIProcessingError extends Error {
+  constructor(stage: string, message: string, public cause?: unknown) {
+    super(`[${stage}] ${message}`);
+    this.name = 'AIProcessingError';
   }
+}
 
-  console.log('Starting AI processing for document:', documentId);
-  
-  // 1. Get document content
-  const { data: doc, error: docError } = await supabase
-    .from('expert_documents')
-    .select(`
-      id,
-      raw_content,
-      source:source_id (
-        name,
-        mime_type
-      )
-    `)
-    .eq('id', documentId)
-    .single();
-
-  if (docError) {
-    console.error('Database error:', docError);
-    throw new Error(`Failed to fetch document: ${docError.message}`);
-  }
-  if (!doc) throw new Error('Document not found');
+interface ProcessingStatus {
+  stage: string;
+  documentId: string;
+  startTime: string;
+  error?: any;
+}
 
-  console.log('Retrieved document:', {
-    id: doc.id,
-    sourceName: doc.source?.name,
-    contentLength: doc.raw_content?.length
-  });
+export async function processDocumentWithAI(documentId: string): Promise<ExpertProfile> {
+  const processingStatus: ProcessingStatus = {
+    stage: 'init',
+    documentId,
+    startTime: new Date().toISOString()
+  };
 
-  // 2. Prepare prompt for Claude
-  const prompt = `
-    Please analyze this document about a medical expert and extract the following information in JSON format:
-    - name: The expert's full name
-    - specialties: Array of their specialties/expertise areas
-    - education: Array of their educational background
-    - experience: Text describing their professional experience
-    - bio: A brief professional biography
+  try {
+    // 1. Environment check
+    debug.log('init', { documentId });
+    if (!import.meta.env.VITE_ANTHROPIC_API_KEY) {
+      throw new AIProcessingError('init', 'VITE_ANTHROPIC_API_KEY is not set');
+    }
 
-    Document content:
-    ${doc.raw_content}
+    // 2. Check current processing status
+    processingStatus.stage = 'status-check';
+    const { data: currentDoc, error: statusError } = await supabase
+      .from('expert_documents')
+      .select('processing_status, processed_at')
+      .eq('id', documentId)
+      .single();
 
-    Please respond with only the JSON object containing these fields. If a field cannot be determined, omit it from the JSON.
-  `;
+    if (statusError) {
+      debug.error('status-check', statusError);
+      throw new AIProcessingError('status-check', `Failed to check document status: ${statusError.message}`);
+    }
 
-  try {
-    // 3. Call Claude API
-    console.log('Calling Claude API...');
+    debug.log('status-check', { currentStatus: currentDoc?.processing_status });
+    
+    if (currentDoc?.processing_status === 'processing') {
+      const lastProcessed = new Date(currentDoc.processed_at || 0);
+      const processingTime = Date.now() - lastProcessed.getTime();
+      
+      // If processing for more than 5 minutes, allow retry
+      if (processingTime < 5 * 60 * 1000) {
+        throw new AIProcessingError('status-check', 'Document is already being processed');
+      }
+      debug.log('status-check', 'Processing timeout detected, allowing retry');
+    }
+
+    // 3. Update status to processing
+    processingStatus.stage = 'status-update';
+    const { error: updateError } = await supabase
+      .from('expert_documents')
+      .update({
+        processing_status: 'processing',
+        processed_at: new Date().toISOString()
+      })
+      .eq('id', documentId);
+
+    if (updateError) {
+      debug.error('status-update', updateError);
+      throw new AIProcessingError('status-update', `Failed to update processing status: ${updateError.message}`);
+    }
+
+    // 4. Fetch document content
+    processingStatus.stage = 'fetch-document';
+    const { data: doc, error: docError } = await supabase
+      .from('expert_documents')
+      .select(`
+        id,
+        raw_content,
+        source:source_id (
+          name,
+          mime_type
+        )
+      `)
+      .eq('id', documentId)
+      .single();
+
+    if (docError) {
+      debug.error('fetch-document', docError);
+      throw new AIProcessingError('fetch-document', `Failed to fetch document: ${docError.message}`);
+    }
+
+    if (!doc?.raw_content) {
+      throw new AIProcessingError('fetch-document', 'Document content is empty');
+    }
+
+    debug.log('fetch-document', {
+      contentLength: doc.raw_content.length,
+      sourceType: doc.source?.mime_type
+    });
+
+    // 5. Call Claude API
+    processingStatus.stage = 'ai-processing';
+    debug.log('ai-processing', 'Initiating Claude API call');
+    
     const response = await fetch('https://api.anthropic.com/v1/messages', {
       method: 'POST',
       headers: {
         'Content-Type': 'application/json',
-        'x-api-key': import.meta.env.VITE_ANTHROPIC_API_KEY,
-        'anthropic-version': '2023-06-01'
+        'anthropic-version': '2024-01-01',
+        'x-api-key': import.meta.env.VITE_ANTHROPIC_API_KEY
       },
       body: JSON.stringify({
-        model: "claude-3-sonnet-20241022",
+        model: "claude-3-5-sonnet-20241022",
         messages: [
           {
             role: "user",
-            content: prompt
+            content: `You are tasked with extracting specific information about a medical expert from the provided document. Please return ONLY a JSON object with the following fields (omit any fields where information is not clearly stated in the document):
+
+            {
+              "name": "Expert's full name",
+              "specialties": ["Array of specialties"],
+              "education": ["Array of educational background"],
+              "experience": "Professional experience description",
+              "bio": "Professional biography"
+            }
+
+            Document content:
+            ${doc.raw_content}
+            `
           }
         ],
-        max_tokens: 1000,
-        temperature: 0.7
+        max_tokens: 4000,
+        temperature: 0
       })
     });
 
     if (!response.ok) {
       const errorText = await response.text();
-      console.error('Claude API error:', {
+      debug.error('ai-processing', {
         status: response.status,
         statusText: response.statusText,
         error: errorText
       });
-      throw new Error(`AI API error: ${errorText}`);
+      throw new AIProcessingError('ai-processing', `API error ${response.status}: ${errorText}`);
     }
 
     const aiResponse = await response.json();
-    console.log('Claude response:', aiResponse);
+    debug.log('ai-processing', { responseStructure: Object.keys(aiResponse) });
 
-    const expertProfile: ExpertProfile = JSON.parse(aiResponse.content[0].text);
-    console.log('Parsed expert profile:', expertProfile);
+    // 6. Parse and validate AI response
+    processingStatus.stage = 'response-parsing';
+    let expertProfile: ExpertProfile;
+    try {
+      const responseText = aiResponse.content[0].text;
+      debug.log('response-parsing', { rawResponse: responseText });
+      
+      expertProfile = JSON.parse(responseText);
+      
+      if (!expertProfile.name) {
+        throw new AIProcessingError('response-parsing', 'AI response missing required name field');
+      }
 
-    // 4. Update experts table
-    const { error: updateError } = await supabase
+      debug.log('response-parsing', { 
+        parsedProfile: {
+          name: expertProfile.name,
+          hasSpecialties: !!expertProfile.specialties?.length,
+          hasEducation: !!expertProfile.education?.length,
+          hasExperience: !!expertProfile.experience,
+          hasBio: !!expertProfile.bio
+        }
+      });
+
+    } catch (parseError) {
+      debug.error('response-parsing', parseError);
+      throw new AIProcessingError('response-parsing', 'Failed to parse AI response', parseError);
+    }
+
+    // 7. Update expert profile
+    processingStatus.stage = 'database-update';
+    const { error: expertUpdateError } = await supabase
       .from('experts')
       .upsert({
-        name: expertProfile.name,
-        specialties: expertProfile.specialties,
-        education: expertProfile.education,
-        experience: expertProfile.experience,
-        bio: expertProfile.bio,
+        expert_name: expertProfile.name,
+        specialties: expertProfile.specialties || [],
+        education: expertProfile.education || [],
+        experience: expertProfile.experience || '',
+        bio: expertProfile.bio || '',
         updated_at: new Date().toISOString()
       });
 
-    if (updateError) {
-      console.error('Database update error:', updateError);
-      throw new Error(`Failed to update expert profile: ${updateError.message}`);
+    if (expertUpdateError) {
+      debug.error('database-update', expertUpdateError);
+      throw new AIProcessingError('database-update', `Failed to update expert profile: ${expertUpdateError.message}`);
     }
 
+    // 8. Mark processing as complete
+    processingStatus.stage = 'completion';
+    await supabase
+      .from('expert_documents')
+      .update({
+        processing_status: 'completed',
+        processed_at: new Date().toISOString()
+      })
+      .eq('id', documentId);
+
+    debug.log('completion', {
+      documentId,
+      processingTime: Date.now() - new Date(processingStatus.startTime).getTime(),
+      status: 'success'
+    });
+
     return expertProfile;
+
   } catch (error) {
-    console.error('AI processing error:', error);
-    throw error;
+    // Detailed error logging
+    debug.error(processingStatus.stage, error);
+    
+    // Update document status to failed
+    try {
+      await supabase
+        .from('expert_documents')
+        .update({
+          processing_status: 'failed',
+          processed_at: new Date().toISOString()
+        })
+        .eq('id', documentId);
+    } catch (statusError) {
+      debug.error('error-handling', statusError);
+    }
+
+    // Rethrow with context
+    throw new AIProcessingError(
+      processingStatus.stage,
+      error instanceof Error ? error.message : 'Unknown error occurred',
+      error
+    );
   }
 } 
\ No newline at end of file

## 55f1bdb
**Date:** 2025-02-15 11:43:09 -0800
**Message:** first changes for the ai test

**Changes:**



diff --git a/apps/dhg-improve-experts/src/utils/ai-processing.ts b/apps/dhg-improve-experts/src/utils/ai-processing.ts
new file mode 100644
index 0000000..9c31355
--- /dev/null
+++ b/apps/dhg-improve-experts/src/utils/ai-processing.ts
@@ -0,0 +1,120 @@
+import { supabase } from '@/integrations/supabase/client';
+
+interface ExpertProfile {
+  name: string;
+  specialties?: string[];
+  education?: string[];
+  experience?: string;
+  bio?: string;
+}
+
+export async function processDocumentWithAI(documentId: string): Promise<ExpertProfile> {
+  if (!import.meta.env.VITE_ANTHROPIC_API_KEY) {
+    throw new Error('VITE_ANTHROPIC_API_KEY is not set in environment variables');
+  }
+
+  console.log('Starting AI processing for document:', documentId);
+  
+  // 1. Get document content
+  const { data: doc, error: docError } = await supabase
+    .from('expert_documents')
+    .select(`
+      id,
+      raw_content,
+      source:source_id (
+        name,
+        mime_type
+      )
+    `)
+    .eq('id', documentId)
+    .single();
+
+  if (docError) {
+    console.error('Database error:', docError);
+    throw new Error(`Failed to fetch document: ${docError.message}`);
+  }
+  if (!doc) throw new Error('Document not found');
+
+  console.log('Retrieved document:', {
+    id: doc.id,
+    sourceName: doc.source?.name,
+    contentLength: doc.raw_content?.length
+  });
+
+  // 2. Prepare prompt for Claude
+  const prompt = `
+    Please analyze this document about a medical expert and extract the following information in JSON format:
+    - name: The expert's full name
+    - specialties: Array of their specialties/expertise areas
+    - education: Array of their educational background
+    - experience: Text describing their professional experience
+    - bio: A brief professional biography
+
+    Document content:
+    ${doc.raw_content}
+
+    Please respond with only the JSON object containing these fields. If a field cannot be determined, omit it from the JSON.
+  `;
+
+  try {
+    // 3. Call Claude API
+    console.log('Calling Claude API...');
+    const response = await fetch('https://api.anthropic.com/v1/messages', {
+      method: 'POST',
+      headers: {
+        'Content-Type': 'application/json',
+        'x-api-key': import.meta.env.VITE_ANTHROPIC_API_KEY,
+        'anthropic-version': '2023-06-01'
+      },
+      body: JSON.stringify({
+        model: "claude-3-sonnet-20241022",
+        messages: [
+          {
+            role: "user",
+            content: prompt
+          }
+        ],
+        max_tokens: 1000,
+        temperature: 0.7
+      })
+    });
+
+    if (!response.ok) {
+      const errorText = await response.text();
+      console.error('Claude API error:', {
+        status: response.status,
+        statusText: response.statusText,
+        error: errorText
+      });
+      throw new Error(`AI API error: ${errorText}`);
+    }
+
+    const aiResponse = await response.json();
+    console.log('Claude response:', aiResponse);
+
+    const expertProfile: ExpertProfile = JSON.parse(aiResponse.content[0].text);
+    console.log('Parsed expert profile:', expertProfile);
+
+    // 4. Update experts table
+    const { error: updateError } = await supabase
+      .from('experts')
+      .upsert({
+        name: expertProfile.name,
+        specialties: expertProfile.specialties,
+        education: expertProfile.education,
+        experience: expertProfile.experience,
+        bio: expertProfile.bio,
+        updated_at: new Date().toISOString()
+      });
+
+    if (updateError) {
+      console.error('Database update error:', updateError);
+      throw new Error(`Failed to update expert profile: ${updateError.message}`);
+    }
+
+    return expertProfile;
+  } catch (error) {
+    console.error('AI processing error:', error);
+    throw error;
+  }
+} 
\ No newline at end of file
