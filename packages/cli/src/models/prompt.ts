import fs from 'fs';

export interface Prompt {
  id: string;
  name: string;
  content: string;
  description?: string;
  created_at: string;
  updated_at: string;
  metadata?: Record<string, any>;
}

/**
 * Read a prompt template from a file
 * @param filePath Path to the prompt template file
 * @returns The prompt template as a string
 */
export async function readPromptFromFile(filePath: string): Promise<string> {
  return fs.readFileSync(filePath, 'utf-8');
}