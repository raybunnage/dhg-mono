import { loadPromptFromMarkdown } from './prompt-loader';
import { generateCompletion, processDocument } from '@/services/claudeApiService';

// Define template types
export type PromptTemplateType = 'extraction' | 'classification' | 'analysis';

export interface PromptFile {
  name: string;
  path: string;
  lastModified: Date;
  documentType?: string;
}

/**
 * Load all available prompt files from the filesystem
 */
export const getPromptFiles = async (): Promise<PromptFile[]> => {
  try {
    // In a browser environment, we'd need to use an API endpoint to get this information
    // This is a placeholder for that functionality
    // In a Node.js environment, we could use fs.readdir
    
    // Mock data for now
    return [
      { name: 'code-analysis-prompt.md', path: '/docs/prompts/code-analysis-prompt.md', lastModified: new Date('2025-02-28') },
      { name: 'document-classification-prompt.md', path: '/docs/prompts/document-classification-prompt.md', lastModified: new Date('2025-02-25') },
      { name: 'react-component-analysis-prompt.md', path: '/docs/prompts/react-component-analysis-prompt.md', lastModified: new Date('2025-02-20') },
      { name: 'expert-extraction-prompt.md', path: '/docs/prompts/expert-extraction-prompt.md', lastModified: new Date('2025-02-15') },
    ];
  } catch (error) {
    console.error('Error loading prompt files:', error);
    return [];
  }
};

/**
 * Load the content of a specific prompt file
 */
export const loadPromptContent = async (promptPath: string): Promise<string> => {
  try {
    // Use the existing prompt loader utility
    return await loadPromptFromMarkdown(promptPath);
  } catch (error) {
    console.error(`Error loading prompt content from ${promptPath}:`, error);
    throw new Error(`Failed to load prompt: ${error.message}`);
  }
};

/**
 * Save prompt content to a file
 */
export const savePromptContent = async (promptPath: string, content: string): Promise<boolean> => {
  try {
    // In a browser environment, we'd need to use an API endpoint to save this
    // This is a placeholder for that functionality
    
    // Mock implementation
    console.log(`Would save to ${promptPath}:`, content);
    return true;
  } catch (error) {
    console.error(`Error saving prompt content to ${promptPath}:`, error);
    return false;
  }
};

/**
 * Create a new prompt file with the given name and content
 */
export const createPromptFile = async (
  name: string, 
  content: string, 
  documentTypeId?: string
): Promise<PromptFile | null> => {
  try {
    // Ensure the name has a .md extension
    const fileName = name.endsWith('.md') ? name : `${name}.md`;
    const promptPath = `/docs/prompts/${fileName}`;
    
    // Save the content
    const success = await savePromptContent(promptPath, content);
    
    if (success) {
      return {
        name: fileName,
        path: promptPath,
        lastModified: new Date(),
        documentType: documentTypeId
      };
    }
    
    return null;
  } catch (error) {
    console.error('Error creating prompt file:', error);
    return null;
  }
};

/**
 * Generate a prompt using Claude API by providing context files
 */
export const generatePromptWithContext = async (
  files: string[],
  templateType: PromptTemplateType = 'extraction'
): Promise<string> => {
  try {
    // In a real implementation, this would:
    // 1. Read the contents of all the context files
    // 2. Make an API call to Claude with those contents to generate a prompt
    
    // For now, we'll use templates but in a real implementation 
    // we would send the file contents to Claude to help generate a better prompt
    const templateDescriptions = {
      extraction: "a prompt for extracting structured information from documents about people into JSON format",
      classification: "a prompt for classifying documents based on their content and structure",
      analysis: "a prompt for analyzing code to extract its purpose, structure, and key functionalities"
    };
    
    // This would be replaced with actual file contents in production
    const fileContextPlaceholder = files.map(file => `Content from: ${file}`).join('\n\n');
    
    // Meta-prompt to generate a prompt
    const metaPrompt = `
# Prompt Engineering Task

## Context
I need you to create ${templateDescriptions[templateType]}.

I have the following ${files.length} files that provide context for what information is important and how it should be structured:

${fileContextPlaceholder}

## Instructions
1. Create a comprehensive prompt that I can use with Claude to process similar documents
2. The prompt should use markdown formatting with clear sections
3. Include a system instruction section explaining the task
4. Include a detailed output schema in JSON format with comments explaining each field
5. The prompt should be self-contained with all necessary instructions

## Format
Please structure the prompt with these sections:
- Title (# Heading)
- System (## Heading)
- Context/Instructions (## Heading)
- Output Schema (## Heading) with JSON example in a code block

`;

    // In a real implementation, we would use the Claude API here
    // For now we'll use template placeholders
    // const generatedPrompt = await generateCompletion(metaPrompt, 0);
    
    // For demonstration: templates similar to what Claude would generate
    const templates = {
      extraction: `# Expert Extraction Prompt

## System

You are an expert at extracting structured information from documents about people. You'll receive content about an expert and your task is to extract key information into a consistent JSON format.

## Instructions

1. Carefully read the provided document content
2. Extract all available information about the expert
3. Format the information according to the output schema
4. For missing information, use null values rather than making things up
5. Be precise and accurate with the extraction

## Output Schema

\`\`\`json
{
  "name": "Expert's full name",
  "title": "Professional title",
  "organization": "Current organization",
  "expertise": ["List", "of", "expertise", "areas"],
  "bio": "Short biography",
  "education": [
    {
      "degree": "Degree name",
      "institution": "Institution name",
      "year": "Year (if available)"
    }
  ],
  "contact": {
    "email": "Email if available",
    "phone": "Phone if available",
    "social": {
      "linkedin": "LinkedIn URL if available",
      "twitter": "Twitter handle if available"
    }
  }
}
\`\`\`

## Document Content

{{DOCUMENT_CONTENT}}
`,
      
      classification: `# Document Classification Prompt

## System

You are an expert at classifying documents based on their content and structure. You'll receive content from a document and your task is to determine its type and extract key metadata.

## Instructions

1. Carefully read the provided document
2. Determine the most appropriate document type
3. Extract relevant metadata
4. Assign a confidence score to your classification
5. Format the output according to the schema below

## Output Schema

\`\`\`json
{
  "document_type": "The type of document",
  "confidence": 0.95,
  "metadata": {
    "title": "Document title",
    "author": "Document author (if available)",
    "date": "Document date (if available)",
    "key_topics": ["List", "of", "main", "topics"]
  }
}
\`\`\`

## Document Content

{{DOCUMENT_CONTENT}}
`,
      
      analysis: `# Code Analysis Prompt

## System

You are an expert at analyzing code to extract its purpose, structure, and key functionalities. You'll receive source code and your task is to provide a detailed analysis.

## Instructions

1. Carefully review the provided code
2. Identify the primary purpose and functionality
3. Extract key components, functions, and dependencies
4. Note any potential issues or areas for improvement
5. Format your analysis according to the output schema

## Output Schema

\`\`\`json
{
  "code_type": "Type of code (component, utility, etc.)",
  "primary_function": "Main purpose of the code",
  "dependencies": ["List", "of", "dependencies"],
  "key_functions": [
    {
      "name": "Function name",
      "purpose": "What the function does",
      "parameters": ["List", "of", "parameters"]
    }
  ],
  "potential_issues": ["Any", "identified", "issues"],
  "optimization_suggestions": ["Suggestions", "for", "improvement"]
}
\`\`\`

## Source Code

{{DOCUMENT_CONTENT}}
`,
    };
    
    return templates[templateType];
  } catch (error) {
    console.error('Error generating prompt with context:', error);
    throw new Error(`Failed to generate prompt: ${error.message}`);
  }
};

/**
 * Apply a prompt to a list of files using the Claude API
 */
export const applyPromptToFiles = async (
  promptContent: string,
  files: string[],
  temperature: number = 0
): Promise<{
  results: Array<{
    filePath: string;
    output: {
      success: boolean;
      data?: Record<string, unknown>;
      error?: string;
    }
  }>
}> => {
  try {
    // In a real implementation, this would:
    // 1. Read the contents of all the files
    // 2. Apply the prompt to each file using the Claude API
    // 3. Return the structured results
    
    // This simulates processing multiple files - in production would use actual file contents
    const results = await Promise.all(files.map(async (file) => {
      try {
        // In production, we would read the actual file content here
        const mockDocumentContent = `Sample content from file: ${file}`;
        
        // Process document with Claude API
        const result = await processDocument(mockDocumentContent, promptContent, temperature);
        
        return {
          filePath: file,
          output: {
            success: true,
            data: result
          }
        };
      } catch (error) {
        console.error(`Error processing file ${file}:`, error);
        return {
          filePath: file,
          output: {
            success: false,
            error: error.message
          }
        };
      }
    }));
    
    return { results };
  } catch (error) {
    console.error('Error applying prompt to files:', error);
    throw new Error(`Failed to apply prompt: ${error.message}`);
  }
};