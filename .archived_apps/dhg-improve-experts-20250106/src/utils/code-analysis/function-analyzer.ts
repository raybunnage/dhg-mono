// Supabase import removed - function_registry table integration has been archived
import { processWithAI } from '@/utils/ai-processing';
import { functionRegistry, categories } from '@/utils/function-registry';
import { GutsTracker } from '@/utils/gutsTracker';
import path from 'path';

/**
 * Interface for a single function's metadata
 */
export interface FunctionMetadata {
  name: string;
  description: string;
  status: 'active' | 'deprecated' | 'experimental';
  location: string;
  category: string; 
  dependencies?: string[];
  usedIn?: string[];
  targetPackage?: string;
  notes?: string;
  isReactComponent?: boolean;
  isDashboardSpecific?: boolean;
  isUtilityCandidate?: boolean;
  implementation?: string;
  complexity?: 'low' | 'medium' | 'high';
}

/**
 * Interface for the entire analysis result
 */
interface FunctionAnalysisResult {
  fileName: string;
  filePath: string;
  functions: FunctionMetadata[];
  page?: string;
  reactComponent?: boolean;
}

/**
 * The function analyzer class that handles analyzing code files to extract functions 
 * and add them to the function registry
 */
export class FunctionAnalyzer {
  private debugMode: boolean;
  private prompt: string;

  constructor(prompt: string, debugMode = false) {
    this.prompt = prompt;
    this.debugMode = debugMode;
  }

  /**
   * Analyze a file and extract function metadata
   */
  async analyzeFile(filePath: string, fileContent: string): Promise<FunctionAnalysisResult> {
    this.log('analyzeFile', { filePath, contentLength: fileContent.length });

    // Extract the bare filename without extension
    const fileName = path.basename(filePath);
    const fileDir = path.dirname(filePath);
    const isComponent = this.isReactComponent(filePath, fileContent);
    const pageName = this.getPageName(filePath);

    try {
      // Build analysis prompt
      const analysisPrompt = `
Analyze this code file and extract all functions, methods and React components.
For each function, provide the following information:

File path: ${filePath}

\`\`\`typescript
${fileContent}
\`\`\`

Return a JSON object with the following structure:
{
  "fileName": "${fileName}",
  "filePath": "${filePath}",
  "functions": [
    {
      "name": "function name",
      "description": "brief description of what the function does",
      "status": "active or deprecated or experimental",
      "location": "${filePath}",
      "category": "one of: ${categories.join(', ')}",
      "dependencies": ["array of dependencies like libraries or other functions"],
      "usedIn": ["components or pages where this function is used, if detectable"],
      "targetPackage": "suggested package if this should be moved to a utility package",
      "notes": "any additional notes",
      "isReactComponent": true/false,
      "isDashboardSpecific": true/false (true if it's UI-specific),
      "isUtilityCandidate": true/false (true if it could be moved to a utils folder),
      "implementation": "brief description of implementation details",
      "complexity": "low, medium, or high"
    }
  ],
  "page": "${pageName || ''}",
  "reactComponent": ${isComponent}
}

Guidelines for categorization:
1. For UI-related functions, use UI_INTERACTION or UI_RENDERING
2. For data processing, use DATA_TRANSFORMATION
3. For API calls, use the most specific category
4. Utility candidates are general-purpose functions that could be used in multiple places
5. Dashboard-specific functions are tightly coupled to UI or specific page functionality
`;

      // Process with AI
      const result = await processWithAI({
        systemPrompt: "You are a code analysis system specializing in analyzing JavaScript/TypeScript code. You extract functions and provide detailed metadata about them. Your analysis is used to add functions to a function registry.",
        userMessage: analysisPrompt,
        temperature: 0,
        requireJsonOutput: true
      });

      this.log('AI analysis result', result);
      return result;
    } catch (error) {
      console.error('Error analyzing file:', error);
      throw new Error(`Failed to analyze ${filePath}: ${error.message}`);
    }
  }

  /**
   * Register extracted functions in the function registry
   */
  registerFunctions(analysis: FunctionAnalysisResult): string[] {
    this.log('registerFunctions', { fileName: analysis.fileName, functionCount: analysis.functions.length });
    
    const registeredFunctions: string[] = [];

    // Track usage in GUTS
    GutsTracker.trackFunctionUsage('registerFunctions', 'direct');
    
    try {
      // Iterate through functions and register each one
      analysis.functions.forEach(func => {
        // Clean up category to match one in the list
        const normalizedCategory = this.normalizeCategory(func.category);
        
        // Register the function
        functionRegistry.register(func.name, {
          description: func.description,
          status: func.status,
          location: func.location,
          category: normalizedCategory,
          dependencies: func.dependencies,
          usedIn: func.usedIn,
          targetPackage: func.targetPackage,
          notes: func.notes
        });

        // Function registry table integration has been removed
        // Previously saved to function_registry table here
        
        registeredFunctions.push(func.name);
      });

      return registeredFunctions;
    } catch (error) {
      console.error('Error registering functions:', error);
      throw new Error(`Failed to register functions: ${error.message}`);
    }
  }

  // saveToFunctionRegistry method has been archived
  // This functionality used the function_registry table which is being retired
  // See .archived_scripts/function-analyzer.20250127.ts for the original implementation

  /**
   * Determine if a file is a React component
   */
  private isReactComponent(filePath: string, content: string): boolean {
    // Check file extension
    const isReactFile = /\.(jsx|tsx)$/.test(filePath);
    
    // Check for React imports
    const hasReactImport = content.includes('import React') || content.includes('from "react"') || content.includes('from \'react\'');
    
    // Check for JSX syntax
    const hasJsx = content.includes('return (') && (content.includes('</') || content.includes('/>'));
    
    return isReactFile && (hasReactImport || hasJsx);
  }

  /**
   * Extract page name from file path
   */
  private getPageName(filePath: string): string | null {
    // Check if it's in the pages directory
    const pagesMatch = filePath.match(/\/pages\/([^\/]+)\//);
    if (pagesMatch) {
      return pagesMatch[1];
    }
    
    // Check if it's a page component
    const pageComponentMatch = filePath.match(/\/pages\/([^\/]+)\.(jsx|tsx)$/);
    if (pageComponentMatch) {
      return pageComponentMatch[1];
    }
    
    return null;
  }

  /**
   * Normalize category to match one in the registry
   */
  private normalizeCategory(category: string): string {
    // Convert to uppercase and replace spaces with underscores
    const normalized = category.toUpperCase().replace(/\s+/g, '_');
    
    // If it's already in the categories list, return it
    if (categories.includes(normalized)) {
      return normalized;
    }
    
    // Otherwise try to find a close match
    for (const validCategory of categories) {
      if (
        normalized.includes(validCategory) || 
        validCategory.includes(normalized) ||
        this.isSimilar(normalized, validCategory)
      ) {
        return validCategory;
      }
    }
    
    // Default to DATA_MANAGEMENT if no match
    return 'DATA_MANAGEMENT';
  }

  /**
   * Compare two strings for similarity
   */
  private isSimilar(a: string, b: string): boolean {
    // Simple check: if one contains a significant part of the other
    const aWords = a.split('_');
    const bWords = b.split('_');
    
    for (const aWord of aWords) {
      if (aWord.length > 3 && bWords.some(bWord => bWord.includes(aWord) || aWord.includes(bWord))) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Debug logging
   */
  private log(stage: string, data: any): void {
    if (this.debugMode) {
      console.log(`[FunctionAnalyzer][${stage}]`, data);
    }
  }
}

export default FunctionAnalyzer;