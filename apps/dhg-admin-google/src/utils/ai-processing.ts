/**
 * AI Processing utilities wrapper
 * 
 * This file wraps the shared AI processing service for backward compatibility
 */

import { aiProcessing } from '@shared/services/ai-processing-service';

// Re-export functions with the same signatures for backward compatibility
export const processWithAI = (prompt: string) => 
  aiProcessing.processWithAI(prompt);

export const processDocumentWithAI = (
  content: string,
  documentTypes: any[],
  promptTemplate: string
) => aiProcessing.classifyDocument(content, documentTypes, promptTemplate);

export const validateExpertProfile = (profileData: any) => 
  aiProcessing.validateData(profileData, 'Validate this expert profile for completeness and accuracy');

export const extractKeyInfo = (content: string) => 
  aiProcessing.extractKeyInfo(content);