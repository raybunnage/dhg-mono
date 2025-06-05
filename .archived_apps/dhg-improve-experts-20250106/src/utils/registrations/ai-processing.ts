import { functionRegistry } from '../function-registry';
import { z } from 'zod';

// Define validation schema
const AIResponseSchema = z.object({
  areas: z.array(z.object({
    name: z.string(),
    confidence: z.number(),
    evidence: z.array(z.string())
  })),
  summary: z.string()
});

// AI Processing Functions
functionRegistry.register('processDocumentWithAI', {
  description: 'Main entry point for AI document processing',
  status: 'experimental',
  location: 'src/utils/ai-processing.ts',
  category: 'AI_PROCESSING',
  dependencies: ['anthropic', 'supabase', 'zod'],
  usedIn: ['SourceButtons'],
  targetPackage: 'ai-processing',
  notes: 'Uses Claude API for content extraction and analysis'
});

functionRegistry.register('validateAIResponse', {
  description: 'Validates AI response against schema',
  status: 'active',
  location: 'src/utils/ai-processing.ts',
  category: 'AI_PROCESSING',
  dependencies: ['zod'],
  usedIn: ['processDocumentWithAI'],
  targetPackage: 'ai-processing'
});

// ... other AI processing functions 