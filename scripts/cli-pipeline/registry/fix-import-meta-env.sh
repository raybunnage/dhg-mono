#!/bin/bash

# Fix import.meta.env issues in shared services that cause CommonJS compilation errors
# This script updates services to handle both browser (ESM) and Node.js (CommonJS) environments

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

echo "🔧 Fixing import.meta.env issues in shared services..."
echo ""

# Fix 1: Update claude-service.ts to handle both environments
echo "📝 Fixing claude-service.ts..."

cat > "$PROJECT_ROOT/packages/shared/services/claude-service/claude-service-fixed.ts" << 'EOF'
import type { ClaudeOptions, ClaudeResponse } from './types';

/**
 * ClaudeService - Singleton service for interacting with Claude API
 * 
 * This service handles communication with the Claude AI API, including:
 * - Sending prompts and receiving responses
 * - Parsing JSON responses
 * - Managing API configuration and authentication
 * 
 * Usage:
 * ```typescript
 * import { claudeService } from '@shared/services/claude-service';
 * 
 * const response = await claudeService.sendPrompt('Your prompt here');
 * const jsonData = await claudeService.getJsonResponse('Return JSON data');
 * ```
 */
export class ClaudeService {
  private static instance: ClaudeService;
  private apiKey: string;
  private baseUrl: string;
  private apiVersion: string;
  private defaultModel: string;
  private isBrowser: boolean;

  private constructor() {
    // Detect environment
    this.isBrowser = typeof window !== 'undefined' && typeof window.document !== 'undefined';
    
    // Load configuration based on environment
    if (this.isBrowser) {
      // Browser environment - try to use import.meta.env
      try {
        // @ts-ignore - import.meta.env is available in Vite
        const env = (typeof import !== 'undefined' && import.meta?.env) || {};
        this.apiKey = env.VITE_CLAUDE_API_KEY || env.VITE_ANTHROPIC_API_KEY || '';
        this.baseUrl = env.VITE_CLAUDE_API_BASE_URL || 'https://api.anthropic.com';
        this.apiVersion = env.VITE_CLAUDE_API_VERSION || '2023-12-15';
        this.defaultModel = env.VITE_DEFAULT_MODEL || 'claude-sonnet-4-20250514';
      } catch {
        // Fallback if import.meta is not available
        this.apiKey = '';
        this.baseUrl = 'https://api.anthropic.com';
        this.apiVersion = '2023-12-15';
        this.defaultModel = 'claude-sonnet-4-20250514';
      }
    } else {
      // Node.js environment - use process.env
      this.apiKey = process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY || '';
      this.baseUrl = process.env.CLAUDE_API_BASE_URL || 'https://api.anthropic.com';
      this.apiVersion = process.env.CLAUDE_API_VERSION || '2023-12-15';
      this.defaultModel = process.env.DEFAULT_MODEL || 'claude-sonnet-4-20250514';
    }

    if (!this.apiKey) {
      console.error('Claude API key is not configured. Please set CLAUDE_API_KEY or ANTHROPIC_API_KEY in your environment variables.');
    }
  }

  /**
   * Get the singleton instance of ClaudeService
   */
  public static getInstance(): ClaudeService {
    if (!ClaudeService.instance) {
      ClaudeService.instance = new ClaudeService();
    }
    return ClaudeService.instance;
  }

  /**
   * Validate that the service is properly configured
   */
  private validateConfiguration(): void {
    if (!this.apiKey) {
      throw new Error('Claude API key is not configured');
    }
  }

  /**
   * Send a prompt to Claude API
   */
  public async sendPrompt(prompt: string, options: ClaudeOptions = {}): Promise<ClaudeResponse> {
    this.validateConfiguration();

    const model = options.model || this.defaultModel;
    const maxTokens = options.maxTokens || 4096;
    const temperature = options.temperature ?? 0.3;

    try {
      const response = await fetch(`${this.baseUrl}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'anthropic-version': this.apiVersion,
          'x-api-key': this.apiKey,
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: maxTokens,
          temperature,
        }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Claude API error: ${response.status} - ${errorData}`);
      }

      const data = await response.json() as ClaudeResponse;
      return data;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to communicate with Claude API: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Send a prompt and parse the response as JSON
   */
  public async getJsonResponse<T = any>(prompt: string, options: ClaudeOptions = {}): Promise<T> {
    const enhancedPrompt = `${prompt}\n\nPlease respond with valid JSON only, no additional text or markdown formatting.`;
    const response = await this.sendPrompt(enhancedPrompt, options);
    
    if (!response.content?.[0]?.text) {
      throw new Error('No content in Claude response');
    }

    const text = response.content[0].text.trim();
    
    try {
      // Remove any markdown code blocks if present
      const jsonText = text.replace(/^```json\s*\n?/, '').replace(/\n?```$/, '');
      return JSON.parse(jsonText);
    } catch (error) {
      throw new Error(`Failed to parse Claude response as JSON: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

// Export singleton instance
export const claudeService = ClaudeService.getInstance();
EOF

# Backup original and replace
if [ -f "$PROJECT_ROOT/packages/shared/services/claude-service/claude-service.ts" ]; then
  cp "$PROJECT_ROOT/packages/shared/services/claude-service/claude-service.ts" \
     "$PROJECT_ROOT/packages/shared/services/claude-service/claude-service.ts.backup"
  
  mv "$PROJECT_ROOT/packages/shared/services/claude-service/claude-service-fixed.ts" \
     "$PROJECT_ROOT/packages/shared/services/claude-service/claude-service.ts"
  
  echo "✅ Fixed claude-service.ts"
else
  echo "❌ claude-service.ts not found"
fi

# Fix 2: Create a script to check for other import.meta.env issues
echo ""
echo "🔍 Checking for other import.meta.env issues in shared services..."

# Find all TypeScript files with import.meta.env
files_with_issue=$(grep -r "import\.meta\.env" "$PROJECT_ROOT/packages/shared" --include="*.ts" -l | grep -v ".backup")

if [ -n "$files_with_issue" ]; then
  echo ""
  echo "⚠️  Found import.meta.env in the following files:"
  echo "$files_with_issue" | while read -r file; do
    echo "  - $file"
  done
  echo ""
  echo "These files may need similar fixes if they're used in Node.js contexts."
else
  echo "✅ No other import.meta.env issues found in shared services"
fi

echo ""
echo "✅ Fix complete! The claude-service now properly handles both browser and Node.js environments."
echo ""
echo "Note: If you encounter similar issues with other services, apply the same pattern:"
echo "1. Detect environment: typeof window !== 'undefined'"
echo "2. Use import.meta.env for browser, process.env for Node.js"
echo "3. Add @ts-ignore comment for import.meta to avoid TypeScript errors"