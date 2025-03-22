import { SupabaseClient } from '@supabase/supabase-js';
import { ClaudeService } from './claude-service';
import { FileService } from './file-service';
import { PromptDocumentClassifier } from './prompt-document-classifier';
import { PromptQueryService, PromptQueryResult, Prompt } from './prompt-query-service';
import { Logger } from '../utils/logger';
import fs from 'fs';
import path from 'path';

export interface ClassificationResult {
  success: boolean;
  document_type_id?: string;
  document_type_name?: string;
  confidence?: number;
  error?: string;
  rawResponse?: any;
  jsonResponse?: any;
  promptName?: string;
  filePath?: string;
  debugInfo?: Record<string, any>; // Debug information
}

export interface DocumentInfo {
  id: string;
  file_path: string;
  title?: string;
  document_type_id?: string;
}

export class DocumentClassificationService {
  private supabase: SupabaseClient;
  private claudeApiKey: string;
  private supabaseUrl: string;
  private supabaseKey: string;
  private fileService: FileService;
  private promptQueryService: PromptQueryService; // Added shared prompt query service
  private debug: boolean = true; // Enable debug mode by default
  
  // Default fallback Claude API key from environment - used if constructor param is missing or invalid
  private static DEFAULT_CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;
  
  constructor(supabase: SupabaseClient, claudeApiKey: string, supabaseUrl: string, supabaseKey: string, debug: boolean = true) {
    this.supabase = supabase;
    
    // Use provided API key or fallback to environment variable
    if (!claudeApiKey && DocumentClassificationService.DEFAULT_CLAUDE_API_KEY) {
      console.log('⚠️ Missing Claude API key in constructor, using environment variable fallback');
      this.claudeApiKey = DocumentClassificationService.DEFAULT_CLAUDE_API_KEY;
    } else {
      this.claudeApiKey = claudeApiKey;
    }
    
    // Ensure Supabase URL is valid
    if (supabaseUrl && !supabaseUrl.startsWith('http')) {
      console.log('⚠️ Supabase URL missing protocol, adding https://');
      this.supabaseUrl = 'https://' + supabaseUrl;
    } else {
      this.supabaseUrl = supabaseUrl;
    }
    
    this.supabaseKey = supabaseKey;
    this.fileService = new FileService();
    
    // Initialize the shared prompt query service
    this.promptQueryService = new PromptQueryService({
      url: this.supabaseUrl,
      key: this.supabaseKey
    });
    
    this.debug = debug;
    
    // Print critical API info to console
    console.log('\n===== DOCUMENT CLASSIFICATION SERVICE INITIALIZED =====');
    console.log(`Claude API Key Present: ${!!this.claudeApiKey} (${this.claudeApiKey ? this.claudeApiKey.substring(0, 5) + '...' : 'MISSING'})`);
    console.log(`Env Claude API Key Present: ${!!process.env.CLAUDE_API_KEY} (${process.env.CLAUDE_API_KEY ? process.env.CLAUDE_API_KEY.substring(0, 5) + '...' : 'MISSING'})`);
    console.log(`Using API Key From: ${this.claudeApiKey === DocumentClassificationService.DEFAULT_CLAUDE_API_KEY ? 'ENVIRONMENT' : 'CONSTRUCTOR'}`);
    console.log('======================================================\n');
    
    // Log detailed initialization with connection info
    this.logDebug('DocumentClassificationService initialized', {
      hasSupabaseClient: !!supabase,
      hasClaudeApiKey: !!claudeApiKey && claudeApiKey.length > 0,
      claudeApiKeyPrefix: claudeApiKey ? `${claudeApiKey.substring(0, 5)}...` : 'MISSING',
      supabaseUrl: supabaseUrl || 'MISSING_URL',
      supabaseUrlValid: this.isValidUrl(supabaseUrl),
      supabaseKeyPrefix: supabaseKey ? `${supabaseKey.substring(0, 5)}...` : 'MISSING_KEY',
      supabaseKeyLength: supabaseKey?.length || 0,
      environment: {
        SUPABASE_URL: process.env.SUPABASE_URL || 'NOT_SET',
        SUPABASE_URL_VALID: this.isValidUrl(process.env.SUPABASE_URL),
        SUPABASE_KEY_SET: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
        SUPABASE_KEY_PREFIX: process.env.SUPABASE_SERVICE_ROLE_KEY ? 
          `${process.env.SUPABASE_SERVICE_ROLE_KEY.substring(0, 5)}...` : 'NOT_SET',
        CLAUDE_API_KEY_SET: !!process.env.CLAUDE_API_KEY,
        CLAUDE_API_KEY_PREFIX: process.env.CLAUDE_API_KEY ? 
          `${process.env.CLAUDE_API_KEY.substring(0, 5)}...` : 'NOT_SET',
        NODE_ENV: process.env.NODE_ENV || 'not_set',
        PWD: process.env.PWD || 'unknown'
      }
    });
    
    // Check URLs and keys and log problems
    this.validateConnections();
  }
  
  /**
   * Check if a string is a valid URL
   */
  private isValidUrl(urlString?: string): boolean {
    if (!urlString) return false;
    
    try {
      new URL(urlString);
      return true;
    } catch (e) {
      return false;
    }
  }
  
  /**
   * Validate all connections and log problems
   */
  private validateConnections(): void {
    // Check Supabase URL
    if (!this.supabaseUrl) {
      this.logDebug('⚠️ CRITICAL ERROR: Supabase URL is missing', {
        fromEnv: process.env.SUPABASE_URL || 'NOT_SET',
        fromConstructor: this.supabaseUrl
      });
    } else if (!this.isValidUrl(this.supabaseUrl)) {
      this.logDebug('⚠️ CRITICAL ERROR: Supabase URL is invalid', {
        url: this.supabaseUrl,
        isValid: false,
        error: 'Not a valid URL format'
      });
    }
    
    // Check Supabase Key
    if (!this.supabaseKey) {
      this.logDebug('⚠️ CRITICAL ERROR: Supabase API key is missing', {
        fromEnv: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SET (but not passed to constructor)' : 'NOT_SET',
        keyLength: this.supabaseKey?.length || 0
      });
    } else if (this.supabaseKey.length < 20) {
      this.logDebug('⚠️ WARNING: Supabase API key looks too short', {
        keyLength: this.supabaseKey.length,
        keyPrefix: this.supabaseKey.substring(0, 5) + '...'
      });
    }
    
    // Check Claude API Key
    if (!this.claudeApiKey) {
      this.logDebug('⚠️ CRITICAL ERROR: Claude API key is missing', {
        fromEnv: process.env.CLAUDE_API_KEY ? 'SET (but not passed to constructor)' : 'NOT_SET',
        keyLength: this.claudeApiKey?.length || 0
      });
    } else if (this.claudeApiKey.length < 20) {
      this.logDebug('⚠️ WARNING: Claude API key looks too short', {
        keyLength: this.claudeApiKey.length,
        keyPrefix: this.claudeApiKey.substring(0, 5) + '...'
      });
    }
    
    // Test Supabase connection with a simple query
    this.testSupabaseConnection();
  }
  
  /**
   * Test the Supabase connection with a simple query
   */
  private async testSupabaseConnection(): Promise<void> {
    try {
      this.logDebug('Testing Supabase connection...', {
        url: this.supabaseUrl,
        isValidUrl: this.isValidUrl(this.supabaseUrl),
        keyPrefix: this.supabaseKey ? `${this.supabaseKey.substring(0, 5)}...` : 'missing'
      });
      
      // Try a simple query to test connection
      const { data, error } = await this.supabase.from('document_types').select('count').limit(1);
      
      if (error) {
        this.logDebug('⚠️ Supabase connection test FAILED', {
          error: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
          url: this.supabaseUrl
        });
      } else {
        this.logDebug('✅ Supabase connection test SUCCESS', {
          response: data
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorName = error instanceof Error ? error.name : 'Unknown error type';
      const errorStack = error instanceof Error ? error.stack : undefined;
      
      this.logDebug('⚠️ CRITICAL ERROR: Failed to connect to Supabase', {
        error: errorMessage,
        errorType: errorName,
        stack: errorStack,
        url: this.supabaseUrl,
        keyLength: this.supabaseKey?.length || 0
      });
      
      // Additional debugging for URL errors
      if (errorMessage.includes('Invalid URL') || errorName === 'TypeError') {
        this.logDebug('🔍 URL CONNECTION ERROR DETAILS', {
          supabaseUrl: this.supabaseUrl,
          isValidUrl: this.isValidUrl(this.supabaseUrl),
          errorMessage,
          errorType: errorName,
          envUrl: process.env.SUPABASE_URL || 'NOT_SET',
          allEnvKeys: Object.keys(process.env).filter(key => 
            key.includes('SUPABASE') || key.includes('URL') || key.includes('KEY')
          ),
          parsedUrl: this.parseUrlSafely(this.supabaseUrl)
        });
      }
    }
  }
  
  /**
   * Safely parse a URL for debugging without throwing errors
   */
  private parseUrlSafely(urlString?: string): Record<string, any> {
    if (!urlString) return { error: 'URL is empty or undefined' };
    
    try {
      const url = new URL(urlString);
      return {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port,
        pathname: url.pathname,
        searchParams: Object.fromEntries(url.searchParams.entries()),
        isValid: true
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Unknown error',
        originalString: urlString,
        startsWithHttp: urlString.startsWith('http://') || urlString.startsWith('https://'),
        length: urlString.length,
        isValid: false
      };
    }
  }

  /**
   * Enhanced logging with debug information written to file AND console
   */
  private logDebug(message: string, data?: any): void {
    if (!this.debug) return;
    
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${message}${data ? '\n' + JSON.stringify(data, null, 2) : ''}`;
    
    Logger.debug(logEntry);
    
    // IMPORTANT: Also log directly to console
    console.log(`🔍 ${message}`);
    if (data) {
      console.log(data);
    }
    
    // Also write to debug log file
    try {
      const debugDir = path.join(process.cwd(), 'debug-logs');
      if (!fs.existsSync(debugDir)) {
        fs.mkdirSync(debugDir, { recursive: true });
      }
      
      const logFile = path.join(debugDir, 'document-classification-debug.log');
      fs.appendFileSync(logFile, logEntry + '\n\n');
    } catch (err) {
      Logger.warn('Failed to write debug log to file:', err);
      console.error('Failed to write debug log to file:', err);
    }
  }

  /**
   * Get the newest document from the database
   */
  async getNewestDocument(): Promise<DocumentInfo | null> {
    try {
      this.logDebug('Fetching the newest document...');
      const { data: newestDocuments, error: fetchError } = await this.supabase
        .from('documentation_files')
        .select('id, file_path, title, document_type_id')
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })
        .limit(1);
        
      if (fetchError || !newestDocuments || newestDocuments.length === 0) {
        this.logDebug('Failed to fetch the newest document', {
          error: fetchError?.message || 'No documents found',
          errorDetails: fetchError
        });
        return null;
      }
      
      this.logDebug('Found newest document', newestDocuments[0]);
      return newestDocuments[0];
    } catch (error) {
      this.logDebug('Error fetching newest document', {
        error: error instanceof Error ? error.message : 'Unknown error',
        errorObject: error
      });
      return null;
    }
  }

  /**
   * Check if the prompt table is accessible
   */
  async checkPromptTableAccess(promptName: string): Promise<{
    isAccessible: boolean;
    promptExists: boolean;
    error?: string;
    debugData?: any;
  }> {
    try {
      this.logDebug(`Checking if prompt '${promptName}' exists in database...`);
      const { data: promptCheck, error: promptCheckError } = await this.supabase
        .from('prompts')
        .select('id, name')
        .eq('name', promptName)
        .limit(1);
        
      if (promptCheckError) {
        this.logDebug(`Error checking prompt table access`, {
          promptName,
          error: promptCheckError.message,
          errorDetails: promptCheckError
        });
        return {
          isAccessible: false,
          promptExists: false,
          error: promptCheckError.message,
          debugData: { promptCheckError }
        };
      }
      
      const exists = promptCheck && promptCheck.length > 0;
      this.logDebug(`Prompt table access check result`, {
        promptName,
        isAccessible: true,
        promptExists: exists,
        promptData: promptCheck
      });
      
      return {
        isAccessible: true,
        promptExists: exists,
        debugData: { promptCheck }
      };
    } catch (error) {
      this.logDebug(`Exception checking prompt table access`, {
        promptName,
        error: error instanceof Error ? error.message : 'Unknown error',
        errorObject: error
      });
      return {
        isAccessible: false,
        promptExists: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        debugData: { error }
      };
    }
  }
  
  /**
   * Get prompt with query results using the shared PromptQueryService
   * This wraps the shared service with local logging
   */
  async getPromptWithQuery(promptName: string): Promise<PromptQueryResult> {
    try {
      this.logDebug(`Getting prompt '${promptName}' with query execution...`);
      
      // Use the shared service
      const result = await this.promptQueryService.getPromptWithQueryResults(promptName);
      
      // Log the result for debugging
      if (result.prompt) {
        this.logDebug(`Found prompt '${promptName}' with shared service`, {
          promptId: result.prompt.id,
          hasMetadata: !!result.prompt.metadata,
          metadataKeys: result.prompt.metadata ? Object.keys(result.prompt.metadata) : [],
          queryResultsCount: result.databaseQueryResults?.length || 0
        });
      } else if (result.error) {
        this.logDebug(`Error getting prompt with shared service`, {
          error: result.error
        });
      }
      
      return result;
    } catch (error) {
      this.logDebug(`Exception in getPromptWithQuery`, {
        promptName,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      
      return {
        prompt: null,
        databaseQueryResults: null,
        error: `Exception: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Get document types directly from the database
   */
  async getDocumentTypes(category: string = 'Documentation'): Promise<any[] | null> {
    try {
      this.logDebug(`Getting document types for category: ${category}`);
      const { data: directTypes, error: typesError } = await this.supabase
        .from('document_types')
        .select('*')
        .eq('category', category);
        
      if (typesError) {
        this.logDebug(`Error fetching document types`, {
          category,
          error: typesError.message,
          errorDetails: typesError
        });
        return null;
      }
      
      if (!directTypes || directTypes.length === 0) {
        this.logDebug(`No document types found for category`, { category });
        return null;
      }
      
      this.logDebug(`Found ${directTypes.length} document types for category '${category}'`, {
        sampleTypes: directTypes.slice(0, 3),
        totalCount: directTypes.length
      });
      return directTypes;
    } catch (error) {
      this.logDebug(`Exception getting document types`, {
        category,
        error: error instanceof Error ? error.message : 'Unknown error',
        errorObject: error
      });
      return null;
    }
  }

  /**
   * Build a system prompt from document types
   */
  buildSystemPrompt(basePrompt: string, documentTypes: any[]): string {
    this.logDebug('Building system prompt', {
      basePromptLength: basePrompt?.length || 0,
      documentTypesCount: documentTypes?.length || 0,
      sampleDocTypes: documentTypes?.slice(0, 3) || []
    });

    let systemPrompt = `${basePrompt || ''}\n\n`;
    systemPrompt += `Here are the available document types you can choose from:\n`;
    
    if (Array.isArray(documentTypes) && documentTypes.length > 0) {
      documentTypes.forEach((type: any) => {
        systemPrompt += `- ${type.document_type || 'Unnamed'} (ID: ${type.id || 'unknown'}): ${type.description || 'No description'}\n`;
      });
    } else {
      systemPrompt += "No document types available.\n";
    }
    
    systemPrompt += `\nAnalyze the following document and classify it as one of these document types. Return your response as a JSON object with document_type_id, document_type_name, and confidence (0-1).`;
    
    this.logDebug('System prompt built', {
      promptLength: systemPrompt.length,
      promptFirstChars: systemPrompt.substring(0, 200) + '...',
      promptLastChars: '...' + systemPrompt.substring(systemPrompt.length - 200)
    });
    
    return systemPrompt;
  }

  /**
   * Extract JSON from Claude API response with enhanced error handling
   */
  extractJsonFromResponse(responseContent: any): { 
    success: boolean; 
    jsonData?: any; 
    jsonString?: string;
    error?: string;
    debugInfo?: any;
  } {
    const debugInfo: any = {
      responseType: typeof responseContent,
      responseStructure: null,
      contentToSearchType: null,
      contentToSearchSample: null,
      jsonMatchAttempts: []
    };
    
    try {
      let contentToSearch = '';
      
      // Log response structure
      if (typeof responseContent === 'object') {
        debugInfo.responseStructure = Object.keys(responseContent);
        if (responseContent.content) {
          debugInfo.hasContent = true;
          debugInfo.contentType = typeof responseContent.content;
          if (Array.isArray(responseContent.content)) {
            debugInfo.contentIsArray = true;
            debugInfo.contentLength = responseContent.content.length;
            debugInfo.contentItemTypes = responseContent.content.map((item: any) => typeof item);
          }
        }
      }
      
      // Extract content to search based on response structure
      if (typeof responseContent === 'string') {
        contentToSearch = responseContent;
        debugInfo.extraction = 'direct-string';
      } else if (typeof responseContent?.content?.[0]?.text === 'string') {
        contentToSearch = responseContent.content[0].text;
        debugInfo.extraction = 'content-array-text';
      } else if (typeof responseContent?.content === 'string') {
        contentToSearch = responseContent.content;
        debugInfo.extraction = 'content-string';
      } else if (responseContent?.result?.content?.[0]?.text) {
        contentToSearch = responseContent.result.content[0].text;
        debugInfo.extraction = 'result-content-array-text';
      } else {
        contentToSearch = JSON.stringify(responseContent);
        debugInfo.extraction = 'full-stringify';
      }
      
      debugInfo.contentToSearchType = typeof contentToSearch;
      debugInfo.contentToSearchLength = contentToSearch.length;
      debugInfo.contentToSearchSample = contentToSearch.substring(0, 300) + '...';
      
      this.logDebug('Searching for JSON in Claude response', debugInfo);
      
      // Try multiple regex patterns to extract JSON
      const patterns = [
        { name: 'code-block-json', regex: /```json\s*({[\s\S]*?})\s*```/ },
        { name: 'code-block-no-lang', regex: /```\s*({[\s\S]*?})\s*```/ },
        { name: 'bare-json-object', regex: /{[\s\S]*?}/ },
        { name: 'json-with-newlines', regex: /\{[\s\S]*?"document_type_id"[\s\S]*?\}/ }
      ];
      
      let jsonStr = null;
      let matchedPattern = null;
      
      for (const pattern of patterns) {
        const match = contentToSearch.match(pattern.regex);
        debugInfo.jsonMatchAttempts.push({
          pattern: pattern.name,
          matched: !!match,
          matchGroups: match ? match.length : 0
        });
        
        if (match) {
          jsonStr = match[1] || match[0];
          matchedPattern = pattern.name;
          break;
        }
      }
      
      if (!jsonStr) {
        this.logDebug('Failed to extract JSON from Claude response', debugInfo);
        return {
          success: false,
          error: 'Failed to extract JSON from Claude response',
          debugInfo
        };
      }
      
      debugInfo.matchedPattern = matchedPattern;
      debugInfo.extractedJsonLength = jsonStr.length;
      debugInfo.extractedJsonSample = jsonStr.substring(0, 100) + '...';
      
      try {
        const jsonData = JSON.parse(jsonStr);
        debugInfo.parsedJsonKeys = Object.keys(jsonData);
        debugInfo.hasRequiredFields = {
          document_type_id: 'document_type_id' in jsonData,
          document_type_name: 'document_type_name' in jsonData,
          confidence: 'confidence' in jsonData
        };
        
        this.logDebug('Successfully extracted and parsed JSON', debugInfo);
        
        return {
          success: true,
          jsonData,
          jsonString: jsonStr,
          debugInfo
        };
      } catch (parseError) {
        debugInfo.parseError = parseError instanceof Error ? parseError.message : 'Unknown parse error';
        this.logDebug('Failed to parse extracted JSON', debugInfo);
        
        return {
          success: false,
          error: `Failed to parse JSON: ${debugInfo.parseError}`,
          debugInfo
        };
      }
    } catch (error) {
      debugInfo.error = error instanceof Error ? error.message : 'Unknown error';
      this.logDebug('Exception extracting JSON from response', debugInfo);
      
      return {
        success: false,
        error: `Failed to extract or parse JSON: ${debugInfo.error}`,
        debugInfo
      };
    }
  }

  /**
   * Classify a document using Claude AI with enhanced debugging
   * @param documentPath The path to the document to classify
   * @param promptName The name of the prompt to use for classification
   * @param outputToMarkdown Whether to output results to a markdown file
   */
  async classifyDocument(documentPath: string, promptName: string, outputToMarkdown: boolean = false): Promise<ClassificationResult> {
    const debugInfo: Record<string, any> = {
      startTime: new Date().toISOString(),
      documentPath,
      promptName,
      outputToMarkdown,
      steps: []
    };
    
    try {
      // Step 1: Initialize the prompt document classifier
      debugInfo.steps.push({
        step: 'initialize_classifier',
        timestamp: new Date().toISOString(),
        supabaseUrlLength: this.supabaseUrl?.length || 0,
        supabaseKeyLength: this.supabaseKey?.length || 0,
        claudeApiKeyLength: this.claudeApiKey?.length || 0
      });
      
      const classifier = new PromptDocumentClassifier(this.supabaseUrl, this.supabaseKey, this.claudeApiKey);
      this.logDebug('Initialized prompt document classifier', debugInfo.steps[debugInfo.steps.length - 1]);
      
      // Step 2: Get document info for display
      debugInfo.steps.push({
        step: 'get_document_info',
        timestamp: new Date().toISOString(),
        documentPath
      });
      
      let documentInfo: DocumentInfo | null = null;
      try {
        const { data, error } = await this.supabase
          .from('documentation_files')
          .select('id, file_path, title, document_type_id')
          .eq('file_path', documentPath)
          .single();
          
        if (!error && data) {
          documentInfo = data;
          debugInfo.steps[debugInfo.steps.length - 1].success = true;
          debugInfo.steps[debugInfo.steps.length - 1].documentInfo = documentInfo;
        } else {
          debugInfo.steps[debugInfo.steps.length - 1].success = false;
          debugInfo.steps[debugInfo.steps.length - 1].error = error?.message || 'No data returned';
        }
      } catch (error) {
        debugInfo.steps[debugInfo.steps.length - 1].success = false;
        debugInfo.steps[debugInfo.steps.length - 1].error = error instanceof Error ? error.message : 'Unknown error';
        this.logDebug('Error getting document info', debugInfo.steps[debugInfo.steps.length - 1]);
      }
      
      // Step 3: Check if prompt exists in database
      debugInfo.steps.push({
        step: 'check_prompt_access',
        timestamp: new Date().toISOString(),
        promptName
      });
      
      const promptAccess = await this.checkPromptTableAccess(promptName);
      debugInfo.steps[debugInfo.steps.length - 1].promptAccess = promptAccess;
      
      if (!promptAccess.isAccessible) {
        this.logDebug('Could not access prompts table', {
          error: promptAccess.error,
          debugData: promptAccess.debugData
        });
      } else if (!promptAccess.promptExists) {
        this.logDebug('Prompt not found in database, will try local file', {
          promptName,
          debugData: promptAccess.debugData
        });
      } else {
        this.logDebug('Prompt found in database', {
          promptName,
          debugData: promptAccess.debugData
        });
      }
      
      // Step 4: Get prompt data including metadata - IMPROVED to use the more robust method
      debugInfo.steps.push({
        step: 'lookup_prompt',
        timestamp: new Date().toISOString(),
        promptName
      });
      
      this.logDebug(`Looking up prompt with robust query method: ${promptName}`);
      
      // Attempt to use the direct method first
      const promptQueryResult = await this.getPromptWithQuery(promptName);
      let promptData;
      
      // Check if the direct method worked
      if (promptQueryResult.prompt && (promptQueryResult.databaseQueryResults || promptQueryResult.databaseQuery2Results)) {
        this.logDebug(`Successfully got prompt and query results directly`, {
          promptName,
          hasPrompt: true,
          queryResultsCount: Array.isArray(promptQueryResult.databaseQueryResults) ? 
            promptQueryResult.databaseQueryResults.length : 0,
          query2ResultsCount: Array.isArray(promptQueryResult.databaseQuery2Results) ? 
            promptQueryResult.databaseQuery2Results.length : 0
        });
        
        // Convert to the format expected by the classifier
        promptData = {
          prompt: promptQueryResult.prompt,
          metadata: promptQueryResult.prompt.metadata || null,
          databaseQueryResults: promptQueryResult.databaseQueryResults,
          databaseQuery2Results: promptQueryResult.databaseQuery2Results,
          relationships: [],
          files: {}
        };
        
        debugInfo.steps[debugInfo.steps.length - 1].usedDirectMethod = true;
      }
      // Fall back to classifier method if direct method failed
      else {
        this.logDebug(`Direct method failed, falling back to classifier method`, {
          error: promptQueryResult.error
        });
        
        // Use the classifier's method as fallback
        promptData = await classifier.lookupPrompt(promptName, outputToMarkdown);
        debugInfo.steps[debugInfo.steps.length - 1].usedClassifierMethod = true;
      }
      
      // Record prompt data details
      debugInfo.steps[debugInfo.steps.length - 1].promptFound = !!promptData.prompt;
      debugInfo.steps[debugInfo.steps.length - 1].promptMetadataFound = !!promptData.metadata;
      debugInfo.steps[debugInfo.steps.length - 1].relationshipsCount = promptData.relationships?.length || 0;
      debugInfo.steps[debugInfo.steps.length - 1].filesCount = Object.keys(promptData.files || {}).length;
      debugInfo.steps[debugInfo.steps.length - 1].databaseQueryResultsCount = 
        Array.isArray(promptData.databaseQueryResults) ? promptData.databaseQueryResults.length : 0;
      debugInfo.steps[debugInfo.steps.length - 1].databaseQuery2ResultsCount = 
        Array.isArray(promptData.databaseQuery2Results) ? promptData.databaseQuery2Results.length : 0;
      
      if (!promptData.prompt) {
        this.logDebug(`Prompt not found with any method: ${promptName}`, {
          promptData: {
            hasPrompt: !!promptData.prompt,
            hasMetadata: !!promptData.metadata,
            relationshipsCount: promptData.relationships?.length || 0,
            filesCount: Object.keys(promptData.files || {}).length,
            databaseQueryResultsCount: Array.isArray(promptData.databaseQueryResults) ? 
              promptData.databaseQueryResults.length : 0
          }
        });
        
        return {
          success: false,
          error: `Prompt not found with any method: ${promptName}`,
          promptName,
          debugInfo
        };
      }
      
      // Step 5: Read the document content
      debugInfo.steps.push({
        step: 'read_document',
        timestamp: new Date().toISOString(),
        documentPath
      });
      
      this.logDebug(`Reading document content: ${documentPath}`);
      const fileResult = this.fileService.readFile(documentPath);
      debugInfo.steps[debugInfo.steps.length - 1].success = fileResult.success;
      
      if (!fileResult.success) {
        debugInfo.steps[debugInfo.steps.length - 1].error = fileResult.error;
        this.logDebug(`Failed to read document file`, {
          documentPath,
          error: fileResult.error
        });
        
        return {
          success: false,
          error: `Failed to read document file: ${fileResult.error}`,
          promptName,
          filePath: documentPath,
          debugInfo
        };
      }
      
      debugInfo.steps[debugInfo.steps.length - 1].contentLength = fileResult.content?.length || 0;
      debugInfo.steps[debugInfo.steps.length - 1].contentStats = fileResult.stats;
      
      // Get document content for classification
      const documentContent = fileResult.content || '';
      
      // Step 6: Get document types from prompt query or direct database query
      debugInfo.steps.push({
        step: 'get_document_types',
        timestamp: new Date().toISOString(),
        fromPromptQuery: !!promptData.databaseQueryResults && 
          (Array.isArray(promptData.databaseQueryResults) ? promptData.databaseQueryResults.length > 0 : true)
      });
      
      // Extract document types from prompt data - follow the pattern from prompt-lookup.ts
      let documentTypes = promptData.databaseQueryResults;
      
      // Log prompt data structure for debugging
      this.logDebug('Examining prompt data structure', {
        hasPrompt: !!promptData.prompt,
        hasMetadata: !!promptData.metadata,
        hasDbQueryResults: !!promptData.databaseQueryResults,
        dbQueryResultsCount: Array.isArray(promptData.databaseQueryResults) ? 
          promptData.databaseQueryResults.length : 0,
        dbQueryResultsType: typeof promptData.databaseQueryResults
      });
      
      if (!documentTypes || (Array.isArray(documentTypes) && documentTypes.length === 0)) {
        this.logDebug('No document types found in prompt query results, trying direct query...');
        debugInfo.steps[debugInfo.steps.length - 1].usingDirectQuery = true;
        
        // Get metadata query from prompt if available
        let metadataQuery = null;
        if (promptData.metadata && (promptData.metadata.database_query || promptData.metadata.databaseQuery)) {
          metadataQuery = promptData.metadata.database_query || promptData.metadata.databaseQuery;
          this.logDebug('Found database query in prompt metadata:', { query: metadataQuery });
        }
        
        // If we have a metadata query but no results, try executing it directly via queryExecutor
        if (metadataQuery && (!documentTypes || documentTypes.length === 0)) {
          try {
            // Create a query executor like the one in prompt-lookup.ts
            const { data: queryResults, error } = await this.supabase
              .from('document_types')
              .select('*')
              .eq('category', 'Documentation');
              
            if (!error && queryResults && queryResults.length > 0) {
              documentTypes = queryResults;
              this.logDebug('Successfully executed metadata query directly', {
                count: queryResults.length,
                sampleResults: queryResults.slice(0, 3)
              });
              debugInfo.steps[debugInfo.steps.length - 1].metadataQuerySuccess = true;
            } else {
              this.logDebug('Failed to execute metadata query directly', {
                error: error?.message || 'No results',
                fallbackToStandardQuery: true
              });
            }
          } catch (queryError) {
            this.logDebug('Error executing prompt metadata query', {
              error: queryError instanceof Error ? queryError.message : 'Unknown error',
              fallbackToStandardQuery: true
            });
          }
        }
        
        // Fall back to direct query if still no results
        if (!documentTypes || (Array.isArray(documentTypes) && documentTypes.length === 0)) {
          documentTypes = await this.getDocumentTypes('Documentation');
          debugInfo.steps[debugInfo.steps.length - 1].directQuerySuccess = !!documentTypes;
          debugInfo.steps[debugInfo.steps.length - 1].directQueryCount = 
            Array.isArray(documentTypes) ? documentTypes.length : 0;
            
          if (!documentTypes) {
            this.logDebug('Could not retrieve document types from direct query');
            return {
              success: false,
              error: 'Could not retrieve document types',
              promptName,
              filePath: documentPath,
              debugInfo
            };
          }
        }
      } else {
        debugInfo.steps[debugInfo.steps.length - 1].usingPromptQuery = true;
        this.logDebug('Using document types from prompt query results', {
          count: Array.isArray(documentTypes) ? documentTypes.length : 1,
          sampleTypes: Array.isArray(documentTypes) ? documentTypes.slice(0, 3) : documentTypes
        });
      }
      
      // Step 7: Build the system prompt for Claude
      debugInfo.steps.push({
        step: 'build_system_prompt',
        timestamp: new Date().toISOString(),
        promptContentLength: promptData.prompt.content?.length || 0,
        documentTypesCount: Array.isArray(documentTypes) ? documentTypes.length : 0
      });
      
      this.logDebug('Building prompt for Claude 3.7...');
      const systemPrompt = this.buildSystemPrompt(promptData.prompt.content, documentTypes);
      debugInfo.steps[debugInfo.steps.length - 1].systemPromptLength = systemPrompt.length;
      
      // Step 8: Initialize the context object for Claude
      debugInfo.steps.push({
        step: 'prepare_context',
        timestamp: new Date().toISOString()
      });
      
      const contextObj = { 
        documentTypes: Array.isArray(documentTypes) ? documentTypes.slice(0, 5) : documentTypes, 
        filePath: documentPath,
        databaseQueryResults: promptData.databaseQueryResults,
        databaseQuery2Results: promptData.databaseQuery2Results
      };
      
      // Log whether the context includes type information and database query results
      debugInfo.steps[debugInfo.steps.length - 1].contextHasDocumentTypes = 
        Array.isArray(contextObj.documentTypes) && contextObj.documentTypes.length > 0;
      debugInfo.steps[debugInfo.steps.length - 1].contextHasDbQuery1Results = 
        Array.isArray(contextObj.databaseQueryResults) && contextObj.databaseQueryResults?.length > 0;
      debugInfo.steps[debugInfo.steps.length - 1].contextHasDbQuery2Results = 
        Array.isArray(contextObj.databaseQuery2Results) && contextObj.databaseQuery2Results?.length > 0;
      
      // Step 9: Call Claude API for classification
      debugInfo.steps.push({
        step: 'call_claude_api',
        timestamp: new Date().toISOString(),
        documentContentLength: documentContent.length,
        systemPromptLength: systemPrompt.length,
        contextLength: JSON.stringify(contextObj).length,
        claudeApiKey: this.claudeApiKey ? {
          set: true,
          length: this.claudeApiKey.length,
          prefix: this.claudeApiKey.substring(0, 5) + '...'
        } : {
          set: false,
          envKeySet: !!process.env.CLAUDE_API_KEY
        }
      });
      
      // Detailed logging before Claude API call
      this.logDebug('Preparing to call Claude API for document classification...', {
        apiKeySet: !!this.claudeApiKey,
        apiKeyLength: this.claudeApiKey?.length || 0,
        documentContentLength: documentContent.length,
        systemPromptLength: systemPrompt.length,
        contextLength: JSON.stringify(contextObj).length,
        claudeBaseUrl: 'https://api.anthropic.com'  // Default Claude API URL
      });
      
      // Variable to store Claude API response
      let claudeResponse: any = null;
      
      try {
        // DIRECT CONSOLE OUTPUT - This is crucial for debugging "Invalid URL" error
        console.log('\n------- CLAUDE API DEBUG INFO -------');
        console.log(`API Key Present: ${!!this.claudeApiKey}`);
        console.log(`API Key Length: ${this.claudeApiKey?.length || 0}`);
        console.log(`API Key First 5 chars: ${this.claudeApiKey ? this.claudeApiKey.substring(0, 5) + '...' : 'MISSING'}`);
        console.log(`Document Content Length: ${documentContent.length}`);
        console.log(`System Prompt Length: ${systemPrompt.length}`);
        console.log(`Context Object: ${JSON.stringify(contextObj).substring(0, 100)}...`);
        console.log('---------------------------------------\n');
        
        // Create a fresh instance of the Claude service with explicit diagnostics
        console.log('⏳ Creating Claude service instance...');
        const claudeService = new ClaudeService(this.claudeApiKey);
        
        this.logDebug('Calling Claude API for document classification...');
        
        // Call API with detailed diagnostics - SHOW PROGRESS
        console.log('🚀 Sending request to Claude API...');
        claudeResponse = await claudeService.classifyDocument(
          documentContent,
          systemPrompt,
          JSON.stringify(contextObj)
        );
        
        // Log the Claude API response status with more details
        debugInfo.steps[debugInfo.steps.length - 1].claudeApiSuccess = claudeResponse.success;
        debugInfo.steps[debugInfo.steps.length - 1].claudeApiResponseType = typeof claudeResponse.result;
        debugInfo.steps[debugInfo.steps.length - 1].claudeApiResponseKeys = 
          claudeResponse.result && typeof claudeResponse.result === 'object' ? 
            Object.keys(claudeResponse.result) : [];
        
        if (!claudeResponse.success) {
          debugInfo.steps[debugInfo.steps.length - 1].claudeApiError = claudeResponse.error;
          
          // Enhanced error logging
          this.logDebug('⚠️ Claude API call failed', {
            error: claudeResponse.error,
            result: claudeResponse.result,
            apiKeySet: !!this.claudeApiKey,
            apiKeyPrefix: this.claudeApiKey ? this.claudeApiKey.substring(0, 5) + '...' : 'MISSING',
            errorType: claudeResponse.error?.includes('Invalid URL') ? 'URL_ERROR' : 
                      claudeResponse.error?.includes('401') ? 'AUTH_ERROR' : 
                      claudeResponse.error?.includes('429') ? 'RATE_LIMIT_ERROR' : 'OTHER_ERROR',
            possibleCauses: claudeResponse.error?.includes('Invalid URL') ? 
              ['Malformed URL', 'Missing protocol (https://)', 'DNS resolution failure'] :
              ['API key issue', 'Network connectivity', 'Service unavailable']
          });
          
          // Write special error report for URL errors
          if (claudeResponse.error?.includes('Invalid URL')) {
            try {
              const errorReport = {
                timestamp: new Date().toISOString(),
                error: claudeResponse.error,
                apiKeyPrefix: this.claudeApiKey ? this.claudeApiKey.substring(0, 5) + '...' : 'MISSING',
                apiKeyLength: this.claudeApiKey?.length || 0,
                claudeApiEnvSet: !!process.env.CLAUDE_API_KEY,
                envKeyPrefix: process.env.CLAUDE_API_KEY ? 
                  process.env.CLAUDE_API_KEY.substring(0, 5) + '...' : 'NOT_SET',
                baseUrl: 'https://api.anthropic.com',
                fullUrl: 'https://api.anthropic.com/v1/messages',
                environment: Object.keys(process.env)
                  .filter(key => key.includes('URL') || key.includes('KEY') || key.includes('API'))
                  .reduce((acc: Record<string, string>, key) => {
                    acc[key] = key.includes('KEY') || key.includes('TOKEN') ? 
                      `${(process.env[key] || '').substring(0, 5)}...` : 
                      process.env[key] || '';
                    return acc;
                  }, {})
              };
              
              const debugDir = path.join(process.cwd(), 'debug-logs');
              if (!fs.existsSync(debugDir)) {
                fs.mkdirSync(debugDir, { recursive: true });
              }
              
              const errorFile = path.join(debugDir, `claude-url-error-${Date.now()}.json`);
              fs.writeFileSync(errorFile, JSON.stringify(errorReport, null, 2), 'utf8');
              
              this.logDebug(`URL error report written to ${errorFile}`);
            } catch (err) {
              this.logDebug('Failed to write URL error report', {
                error: err instanceof Error ? err.message : 'Unknown error'
              });
            }
          }
          
          return {
            success: false,
            error: `Claude API error: ${claudeResponse.error}`,
            rawResponse: claudeResponse,
            promptName,
            filePath: documentPath,
            debugInfo
          };
        }
        
        // Log successful call details
        this.logDebug('Claude API call successful', {
          responseType: typeof claudeResponse.result,
          hasContent: claudeResponse.result && claudeResponse.result.content !== undefined,
          resultKeys: claudeResponse.result ? Object.keys(claudeResponse.result) : []
        });
        
      } catch (error) {
        // Handle any unexpected errors during Claude API call
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const errorStack = error instanceof Error ? error.stack : undefined;
        
        debugInfo.steps[debugInfo.steps.length - 1].unexpectedError = errorMessage;
        debugInfo.steps[debugInfo.steps.length - 1].errorStack = errorStack;
        
        this.logDebug('⚠️ Unexpected error during Claude API call', {
          error: errorMessage,
          stack: errorStack,
          apiKeySet: !!this.claudeApiKey,
          apiKeyPrefix: this.claudeApiKey ? this.claudeApiKey.substring(0, 5) + '...' : 'MISSING'
        });
        
        return {
          success: false,
          error: `Unexpected error calling Claude API: ${errorMessage}`,
          promptName,
          filePath: documentPath,
          debugInfo
        };
      }
      
      // Make sure we have a valid Claude response before proceeding
      if (!claudeResponse || !claudeResponse.success) {
        return {
          success: false,
          error: 'Failed to get valid response from Claude API',
          promptName,
          filePath: documentPath,
          debugInfo
        };
      }
      
      // Step 10: Extract JSON from Claude response
      debugInfo.steps.push({
        step: 'extract_json',
        timestamp: new Date().toISOString()
      });
      
      const responseContent = claudeResponse.result || '';
      const jsonExtraction = this.extractJsonFromResponse(responseContent);
      
      // Log the JSON extraction results
      debugInfo.steps[debugInfo.steps.length - 1].jsonExtractionSuccess = jsonExtraction.success;
      debugInfo.steps[debugInfo.steps.length - 1].jsonExtractionError = jsonExtraction.error;
      debugInfo.steps[debugInfo.steps.length - 1].jsonExtractionInfo = jsonExtraction.debugInfo;
      
      if (!jsonExtraction.success) {
        this.logDebug('Failed to extract JSON from Claude response', {
          error: jsonExtraction.error,
          debugInfo: jsonExtraction.debugInfo
        });
        
        // Generate a detailed debug report for investigation
        const debugReport = {
          timestamp: new Date().toISOString(),
          operation: 'classify_document',
          promptName,
          documentPath,
          claudeResponseSample: typeof responseContent === 'string' 
            ? responseContent.substring(0, 1000) 
            : JSON.stringify(responseContent).substring(0, 1000),
          extractionAttempt: jsonExtraction,
          fullDebugInfo: debugInfo
        };
        
        // Write debug report to file for further investigation
        try {
          const debugDir = path.join(process.cwd(), 'debug-logs');
          if (!fs.existsSync(debugDir)) {
            fs.mkdirSync(debugDir, { recursive: true });
          }
          
          const debugFile = path.join(debugDir, `json-extraction-failure-${Date.now()}.json`);
          fs.writeFileSync(debugFile, JSON.stringify(debugReport, null, 2), 'utf8');
          
          debugInfo.steps[debugInfo.steps.length - 1].debugReportFile = debugFile;
        } catch (err) {
          debugInfo.steps[debugInfo.steps.length - 1].debugReportWriteError = 
            err instanceof Error ? err.message : 'Unknown error';
        }
        
        return {
          success: false,
          error: jsonExtraction.error,
          rawResponse: claudeResponse,
          promptName,
          filePath: documentPath,
          debugInfo
        };
      }
      
      // Step 11: Return the successful classification result
      debugInfo.endTime = new Date().toISOString();
      this.logDebug('Successfully classified document', {
        documentPath,
        document_type_id: jsonExtraction.jsonData.document_type_id,
        document_type_name: jsonExtraction.jsonData.document_type_name,
        confidence: jsonExtraction.jsonData.confidence
      });
      
      // Return the classification result
      return {
        success: true,
        document_type_id: jsonExtraction.jsonData.document_type_id,
        document_type_name: jsonExtraction.jsonData.document_type_name,
        confidence: jsonExtraction.jsonData.confidence,
        rawResponse: claudeResponse,
        jsonResponse: jsonExtraction.jsonData,
        promptName,
        filePath: documentPath,
        debugInfo
      };
    } catch (error) {
      // Handle any unexpected errors
      debugInfo.fatalError = error instanceof Error ? error.message : 'Unknown error';
      debugInfo.fatalErrorStack = error instanceof Error ? error.stack : undefined;
      debugInfo.endTime = new Date().toISOString();
      
      this.logDebug('Error classifying document', {
        documentPath,
        promptName,
        error: debugInfo.fatalError,
        stack: debugInfo.fatalErrorStack
      });
      
      return {
        success: false,
        error: `Error classifying document: ${debugInfo.fatalError}`,
        promptName,
        filePath: documentPath,
        debugInfo
      };
    }
  }

  /**
   * Update a document's document type in the database
   */
  async updateDocumentType(documentId: string, documentTypeId: string): Promise<{
    success: boolean;
    error?: string;
    debugInfo?: any;
  }> {
    interface UpdateDebugInfo {
      startTime: string;
      documentId: string;
      documentTypeId: string;
      operation: string;
      error?: string;
      errorDetails?: any;
      endTime?: string;
      success?: boolean;
      errorObject?: any;
    }
    
    const debugInfo: UpdateDebugInfo = {
      startTime: new Date().toISOString(),
      documentId,
      documentTypeId,
      operation: 'update_document_type'
    };
    
    try {
      this.logDebug('Updating document type', { documentId, documentTypeId });
      
      const { error } = await this.supabase
        .from('documentation_files')
        .update({
          document_type_id: documentTypeId,
          updated_at: new Date().toISOString()
        })
        .eq('id', documentId);
        
      if (error) {
        debugInfo.error = error.message;
        debugInfo.errorDetails = error;
        debugInfo.endTime = new Date().toISOString();
        
        this.logDebug('Failed to update document type', debugInfo);
        
        return {
          success: false,
          error: `Failed to update document type: ${error.message}`,
          debugInfo
        };
      }
      
      debugInfo.success = true;
      debugInfo.endTime = new Date().toISOString();
      
      this.logDebug('Successfully updated document type', debugInfo);
      
      return { 
        success: true,
        debugInfo
      };
    } catch (error) {
      debugInfo.error = error instanceof Error ? error.message : 'Unknown error';
      debugInfo.errorObject = error;
      debugInfo.endTime = new Date().toISOString();
      
      this.logDebug('Error updating document type', debugInfo);
      
      return {
        success: false,
        error: `Error updating document type: ${debugInfo.error}`,
        debugInfo
      };
    }
  }

  /**
   * Get documents without document type assignments
   */
  async getDocumentsWithoutType(limit: number = 10): Promise<DocumentInfo[]> {
    interface DocTypeDebugInfo {
      startTime: string;
      limit: number;
      operation: string;
      error?: string;
      errorDetails?: any;
      count?: number;
      endTime?: string;
      errorObject?: any;
    }
    
    const debugInfo: DocTypeDebugInfo = {
      startTime: new Date().toISOString(),
      limit,
      operation: 'get_documents_without_type'
    };
    
    try {
      this.logDebug('Finding documents without type assignments', { limit });
      
      const { data, error } = await this.supabase
        .from('documentation_files')
        .select('id, file_path, title, document_type_id')
        .is('document_type_id', null)
        .eq('is_deleted', false)
        .order('file_path')
        .limit(limit);
        
      if (error) {
        debugInfo.error = error.message;
        debugInfo.errorDetails = error;
        
        this.logDebug('Error fetching documents without types', debugInfo);
        return [];
      }
      
      debugInfo.count = data?.length || 0;
      debugInfo.endTime = new Date().toISOString();
      
      this.logDebug('Found documents without type assignments', {
        count: debugInfo.count,
        sampleDocs: data?.slice(0, 3) || []
      });
      
      return data || [];
    } catch (error) {
      debugInfo.error = error instanceof Error ? error.message : 'Unknown error';
      debugInfo.errorObject = error;
      debugInfo.endTime = new Date().toISOString();
      
      this.logDebug('Error getting documents without type', debugInfo);
      return [];
    }
  }
}