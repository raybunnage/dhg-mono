import { z } from 'zod';

export const ClassificationResponseSchema = z.object({
  typeId: z.string().uuid(),
  documentType: z.string(),
  confidence: z.number().min(0).max(1),
  reasoning: z.string()
});

export type ClassificationResponse = z.infer<typeof ClassificationResponseSchema>; 