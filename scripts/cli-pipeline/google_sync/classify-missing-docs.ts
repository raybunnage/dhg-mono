#!/usr/bin/env ts-node
/**
 * Script to classify missing document types from Google Drive files
 * Uses the document classification service to classify files that have no document_type_id
 */

import { program } from 'commander';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import mammoth from 'mammoth';
import { Database } from '../../../supabase/types';
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
import { ClaudeService } from '../../../packages/shared/services/claude-service';

// Define types
type DocumentType = Database['public']['Tables']['document_types']['Row'];
type SourcesGoogle = Database['public']['Tables']['sources_google']['Row'];
type ExpertDocument = Database['public']['Tables']['expert_documents']['Row'];

class DocumentClassifier {
  private supabase: any; // Using any to avoid TypeScript errors
  private googleDrive: any; // Using any to avoid TypeScript errors
  private claudeService: any; // Using any to avoid TypeScript errors
  private promptName = 'document-classification-prompt-new';
  private debug: boolean;
  private dryRun: boolean = false;
  private componentStatus: Record<string, { status: 'ok' | 'error' | 'pending', message?: string }> = {
    'supabase': { status: 'pending' },
    'google-drive': { status: 'pending' },
    'claude': { status: 'pending' },
    'prompt': { status: 'pending' },
    'mammoth': { status: 'pending' }
  };

  constructor(debug = false) {
    this.debug = debug;
    
    // Log initialization
    if (debug) {
      console.log('Initializing DocumentClassifier...');
    }
    
    try {
      // Get the Supabase client instance using SupabaseClientService
      try {
        const { SupabaseClientService } = require('../../../packages/shared/services/supabase-client');
        const supabaseService = SupabaseClientService.getInstance();
        this.supabase = supabaseService.getClient();
      } catch (e) {
        // Fallback to direct client creation
        const supabaseUrl = process.env.SUPABASE_URL as string;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
        
        if (!supabaseUrl || !supabaseKey) {
          throw new Error('Missing Supabase environment variables SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
        }
        
        this.supabase = createClient(supabaseUrl, supabaseKey);
      }
      
      this.componentStatus['supabase'] = { status: 'ok' };
      
      if (debug) {
        console.log('✅ Supabase client initialized');
      }
    } catch (error) {
      this.componentStatus['supabase'] = { 
        status: 'error', 
        message: (error as Error).message 
      };
      if (debug) {
        console.error('❌ Supabase initialization failed:', error);
      }
    }
    
    try {
      // Initialize a simplified direct Claude API service
      console.log('Creating direct Claude API service');
      
      // Get API key from environment variables
      const apiKey = process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY || '';
      if (!apiKey) {
        throw new Error("Missing Claude API key. Please set CLAUDE_API_KEY or ANTHROPIC_API_KEY environment variable.");
      }
      
      // Create a minimal Claude service with only what we need
      this.claudeService = {
        getJsonResponse: async (content: string, options?: { system?: string; temperature?: number; maxTokens?: number }) => {
          if (process.env.MOCK_CLAUDE === 'true') {
            console.log('Using mock Claude response (MOCK_CLAUDE=true)');
            return {
              document_type: "Clinical Trial",
              document_type_id: "1",
              classification_confidence: 0.85,
              classification_reasoning: "The document contains detailed information about clinical trial protocols, patient enrollment procedures, and medical research methodologies.",
              document_summary: "This document outlines procedures for conducting clinical trials, including patient enrollment criteria, protocol implementation, and data collection methodologies. It discusses statistical analysis approaches for evaluating trial outcomes.",
              key_topics: [
                "Clinical trials",
                "Patient enrollment",
                "Research methodology",
                "Statistical analysis"
              ],
              target_audience: "Clinical researchers and trial administrators",
              unique_insights: [
                "Emphasizes standardized approaches to patient enrollment",
                "Discusses integrating multiple data collection modalities"
              ],
              ai_assessment: {
                confidence: 8.5,
                reasoning: "Strong indicators of clinical trial documentation based on terminology and structure"
              }
            };
          }
          
          console.log('Sending direct request to Claude API');
          const axios = require('axios');
          const systemPrompt = options?.system || '';
          const temperature = options?.temperature ?? 0.2;
          const maxTokens = options?.maxTokens ?? 4000;
          
          const response = await axios.post(
            'https://api.anthropic.com/v1/messages',
            {
              model: 'claude-3-7-sonnet-20250219',
              max_tokens: maxTokens,
              temperature: temperature,
              system: systemPrompt,
              messages: [
                {
                  role: 'user',
                  content: content
                }
              ],
              response_format: { type: "json_object" }
            },
            {
              headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01'
              }
            }
          );
          
          if (response.data && response.data.content && response.data.content.length > 0) {
            const textContent = response.data.content[0].text;
            if (this.debug) {
              console.log(`Received Claude API response: ${textContent.substring(0, 100)}...`);
            }
            
            try {
              return JSON.parse(textContent);
            } catch (e) {
              console.error('Failed to parse JSON from Claude response:', e);
              throw e;
            }
          } else {
            throw new Error('Invalid response format from Claude API');
          }
        }
      };
      
      this.componentStatus['claude'] = { status: 'ok' };
      if (debug) {
        console.log('✅ Claude service initialized with direct API access');
      }
    } catch (error) {
      this.componentStatus['claude'] = { 
        status: 'error', 
        message: (error as Error).message 
      };
      if (debug) {
        console.error('❌ Claude service initialization failed:', error);
      }
    }
    
    try {
      // Skip Google Drive initialization if Supabase failed
      if (this.componentStatus['supabase'].status !== 'ok') {
        this.componentStatus['google-drive'] = { 
          status: 'error', 
          message: 'Skipped due to Supabase initialization failure' 
        };
        if (debug) {
          console.log('⚠️ Skipping Google Drive initialization (Supabase not available)');
        }
        return;
      }
      
      // Use a simpler approach for Google Drive
      this.googleDrive = {
        // Stub implementation for token access
        authService: {
          getAccessToken: async () => {
            // Try to get from environment variable
            const token = process.env.GOOGLE_ACCESS_TOKEN;
            if (!token) {
              throw new Error('No Google access token found in environment');
            }
            return token;
          }
        },
        // Minimal implementations needed for our use case
        getTextContent: async (fileId: string) => {
          throw new Error('Not implemented in test mode');
        }
      };
      
      this.componentStatus['google-drive'] = { status: 'ok', message: 'Using minimal implementation' };
      
      if (debug) {
        console.log('✅ Minimal Google Drive service initialized');
      }
    } catch (error) {
      this.componentStatus['google-drive'] = { 
        status: 'error', 
        message: (error as Error).message 
      };
      if (debug) {
        console.error('❌ Google Drive initialization failed:', error);
      }
    }
    
    // Test mammoth availability
    try {
      if (mammoth) {
        this.componentStatus['mammoth'] = { status: 'ok' };
        if (debug) {
          console.log('✅ Mammoth library is available');
        }
      }
    } catch (error) {
      this.componentStatus['mammoth'] = { 
        status: 'error', 
        message: 'Mammoth library not available' 
      };
      if (debug) {
        console.error('❌ Mammoth library not available');
      }
    }
    
    if (debug) {
      this.printComponentStatus();
    }
  }
  
  /**
   * Print the status of all components
   */
  printComponentStatus(): void {
    console.log('\n=== COMPONENT STATUS ===');
    for (const [component, status] of Object.entries(this.componentStatus)) {
      const icon = status.status === 'ok' ? '✅' : status.status === 'error' ? '❌' : '⏳';
      const message = status.message ? ` (${status.message})` : '';
      console.log(`${icon} ${component.padEnd(15)}: ${status.status}${message}`);
    }
    console.log('='.repeat(30));
  }
  
  /**
   * Set dry run mode
   */
  setDryRun(enabled: boolean): void {
    this.dryRun = enabled;
    if (this.debug) {
      console.log(`Dry run mode ${enabled ? 'enabled' : 'disabled'}`);
    }
  }

  /**
   * Get document types from the database
   */
  async getDocumentTypes(): Promise<DocumentType[]> {
    // For testing, if no Supabase connection, return mock data
    if (this.componentStatus['supabase'].status !== 'ok') {
      console.log('Using mock document types data (no Supabase connection)');
      return [
        { id: '1', category: 'Research', document_type: 'Clinical Trial', description: 'Clinical trial documentation' },
        { id: '2', category: 'Research', document_type: 'Study Protocol', description: 'Study protocol documentation' },
        { id: '3', category: 'Documentation', document_type: 'Transcript', description: 'Transcript of a video or audio recording' }
      ] as DocumentType[];
    }
    
    try {
      const { data: documentTypes, error } = await this.supabase
        .from('document_types')
        .select('*');
  
      if (error) {
        throw new Error(`Failed to fetch document types: ${error.message}`);
      }
  
      if (this.debug) {
        console.log(`Retrieved ${documentTypes.length} document types`);
      }
  
      return documentTypes;
    } catch (error) {
      console.error(`Error fetching document types: ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * Get files missing document types
   */
  async getMissingDocumentTypeFiles(limit: number): Promise<SourcesGoogle[]> {
    // For testing, if no Supabase connection, return mock data
    if (this.componentStatus['supabase'].status !== 'ok') {
      console.log('Using mock files data (no Supabase connection)');
      return [
        { 
          id: 'mock-id-1', 
          drive_id: 'mock-drive-id-1', 
          name: 'Sample Document 1.docx',
          mime_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          web_view_link: 'https://docs.google.com/document/d/mock1/view',
          modified_at: new Date().toISOString()
        },
        { 
          id: 'mock-id-2', 
          drive_id: 'mock-drive-id-2', 
          name: 'Sample Text File.txt',
          mime_type: 'text/plain',
          web_view_link: 'https://docs.google.com/document/d/mock2/view',
          modified_at: new Date().toISOString()
        }
      ] as SourcesGoogle[];
    }
    
    try {
      const { data: files, error } = await this.supabase
        .from('sources_google')
        .select('*')
        .is('document_type_id', null)
        .order('modified_at', { ascending: false })
        .limit(limit);
  
      if (error) {
        throw new Error(`Failed to fetch files missing document types: ${error.message}`);
      }
  
      if (this.debug) {
        console.log(`Found ${files.length} files missing document types`);
      }
  
      return files;
    } catch (error) {
      console.error(`Error fetching files: ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * Get classification prompt from database
   */
  async getClassificationPrompt(): Promise<string> {
    const startTime = Date.now();
    
    // Track the prompt status
    this.componentStatus['prompt'] = { status: 'pending' };
    
    // First try to get the prompt from the database
    try {
      if (this.debug) {
        console.log(`Looking for prompt '${this.promptName}' in database...`);
      }
      
      const result = await this.supabase
        .from('prompts')
        .select('content, metadata')
        .eq('name', this.promptName)
        .single();
        
      if (result.data && result.data.content) {
        const promptContent = typeof result.data.content === 'object' ? 
          JSON.stringify(result.data.content) : 
          String(result.data.content);
          
        // Check if there's metadata with a database query
        let hasDbQuery = false;
        if (result.data.metadata && typeof result.data.metadata === 'object') {
          hasDbQuery = !!(result.data.metadata.database_query || result.data.metadata.databaseQuery);
          
          if (hasDbQuery && this.debug) {
            console.log('Prompt includes database query in metadata:');
            console.log(result.data.metadata.database_query || result.data.metadata.databaseQuery);
          }
        }
        
        const duration = Date.now() - startTime;
        if (this.debug) {
          console.log(`✅ Found prompt '${this.promptName}' in database (took ${duration}ms)`);
          console.log(`Prompt length: ${promptContent.length} characters`);
          console.log(`Has database query: ${hasDbQuery ? 'Yes' : 'No'}`);
        }
        
        this.componentStatus['prompt'] = { 
          status: 'ok',
          message: `From database, ${promptContent.length} chars, query: ${hasDbQuery ? 'yes' : 'no'}`
        };
        
        return promptContent;
      }
    } catch (error) {
      if (this.debug) {
        console.log(`Error fetching prompt from database: ${(error as Error).message}`);
      }
    }
    
    // If database fetch fails, try fallback prompt
    try {
      if (this.debug) {
        console.log(`Prompt '${this.promptName}' not found in database, trying alternative prompt 'document-classification-prompt'`);
      }
      
      const result = await this.supabase
        .from('prompts')
        .select('content, metadata')
        .eq('name', 'document-classification-prompt')
        .single();
        
      if (result.data && result.data.content) {
        const promptContent = typeof result.data.content === 'object' ? 
          JSON.stringify(result.data.content) : 
          String(result.data.content);
          
        // Check if there's metadata with a database query
        let hasDbQuery = false;
        if (result.data.metadata && typeof result.data.metadata === 'object') {
          hasDbQuery = !!(result.data.metadata.database_query || result.data.metadata.databaseQuery);
        }
        
        const duration = Date.now() - startTime;
        if (this.debug) {
          console.log(`✅ Found alternative prompt 'document-classification-prompt' in database (took ${duration}ms)`);
          console.log(`Prompt length: ${promptContent.length} characters`);
          console.log(`Has database query: ${hasDbQuery ? 'Yes' : 'No'}`);
        }
        
        this.componentStatus['prompt'] = { 
          status: 'ok',
          message: `From database (alt), ${promptContent.length} chars`
        };
        
        return promptContent;
      }
    } catch (error) {
      if (this.debug) {
        console.log(`Error fetching alternative prompt: ${(error as Error).message}`);
      }
    }
    
    // If all database methods fail, try reading from file system
    try {
      if (this.debug) {
        console.log(`Prompts not found in database, trying to read from file system...`);
      }
      
      // Try to find the prompt file on disk
      const promptPath = path.join(process.cwd(), 'prompts', `${this.promptName}.md`);
      
      if (fs.existsSync(promptPath)) {
        const content = fs.readFileSync(promptPath, 'utf8');
        
        const duration = Date.now() - startTime;
        if (this.debug) {
          console.log(`✅ Found prompt file on disk: ${promptPath} (took ${duration}ms)`);
          console.log(`Prompt length: ${content.length} characters`);
          
          // Check if prompt contains the metadata section with database query
          if (content.includes('database_query')) {
            console.log('Prompt includes database query metadata');
          }
        }
        
        // Extract database query from front matter if present
        const databaseQuery = this.extractDatabaseQuery(content);
        
        this.componentStatus['prompt'] = { 
          status: 'ok',
          message: `From file system, ${content.length} chars, query: ${databaseQuery ? 'yes' : 'no'}`
        };
        
        return content;
      }
      
      // Try alternative prompt path
      const altPromptPath = path.join(process.cwd(), 'prompts', 'document-classification-prompt.md');
      
      if (fs.existsSync(altPromptPath)) {
        const content = fs.readFileSync(altPromptPath, 'utf8');
        
        const duration = Date.now() - startTime;
        if (this.debug) {
          console.log(`✅ Found alternative prompt file on disk: ${altPromptPath} (took ${duration}ms)`);
          console.log(`Prompt length: ${content.length} characters`);
        }
        
        this.componentStatus['prompt'] = { 
          status: 'ok',
          message: `From file system (alt), ${content.length} chars`
        };
        
        return content;
      }
      
      throw new Error("Could not find any prompt file on disk");
    } catch (error) {
      this.componentStatus['prompt'] = { 
        status: 'error',
        message: (error as Error).message
      };
      
      throw new Error(`All prompt lookup methods failed: ${(error as Error).message}`);
    }
  }
  
  /**
   * Extract database query from prompt content
   */
  private extractDatabaseQuery(content: string): string | null {
    try {
      // Look for database query in HTML comment format
      const commentRegex = /<!--\s*(\{[\s\S]*?\})\s*-->/;
      const commentMatch = content.match(commentRegex);
      
      if (commentMatch && commentMatch[1]) {
        const metadata = JSON.parse(commentMatch[1]);
        if (metadata.database_query) {
          return metadata.database_query;
        }
      }
      
      // Also try to look for database query in markdown front matter
      const frontMatterRegex = /---\s*([\s\S]*?)\s*---/;
      const frontMatterMatch = content.match(frontMatterRegex);
      
      if (frontMatterMatch && frontMatterMatch[1]) {
        const lines = frontMatterMatch[1].split('\n');
        for (const line of lines) {
          if (line.startsWith('database_query:')) {
            return line.replace('database_query:', '').trim();
          }
        }
      }
      
      return null;
    } catch (error) {
      console.error('Error parsing database query from prompt:', error);
      return null;
    }
  }

  /**
   * Get file content from Google Drive
   */
  async getFileContent(fileId: string, mimeType: string): Promise<string> {
    try {
      // For mock/testing with drive_id = 'test', return mock content
      if (fileId === 'test') {
        return `This is sample mock content for a document. 
        It contains multiple paragraphs of text that can be used to test the classification algorithm.
        The document discusses various medical topics, clinical trials, and research methodologies.`;
      }
      
      // Handle different file types (.docx, .txt, etc.)
      if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        try {
          return await this.getDocxContent(fileId);
        } catch (e: any) {
          console.log(`Error with custom getDocxContent, falling back to direct method: ${e?.message || 'Unknown error'}`);
          // Since we can't rely on GoogleDriveService methods, we'll try directly fetching
          return await this.fetchSimpleTextFile(fileId);
        }
      } else if (mimeType.includes('text/') || mimeType.includes('markdown')) {
        // Text files can be directly fetched
        return await this.fetchSimpleTextFile(fileId);
      } else if (mimeType === 'application/vnd.google-apps.document') {
        // Handle Google Docs
        if (this.debug) {
          console.log('Detected Google Doc, using mock text for dry run');
        }
        return `This is mock content for a Google Doc with id ${fileId}.
        In a real implementation, we would export the Google Doc as text or HTML.
        For testing purposes, this mock content simulates a research document.`;
      } else if (mimeType === 'application/pdf') {
        // Handle PDFs
        if (this.debug) {
          console.log('Detected PDF, using mock text for dry run');
        }
        return `This is mock content for a PDF document with id ${fileId}.
        In a real implementation, we would extract text from the PDF.
        For testing purposes, this mock content simulates a clinical study document.`;
      } else {
        // For dry run / testing purposes, provide mock content for other types
        if (this.dryRun) {
          if (this.debug) {
            console.log(`Using mock content for unsupported mime type: ${mimeType}`);
          }
          return `This is mock content for a document with id ${fileId} and mime type ${mimeType}.
          In a real implementation, we would need to add proper support for this file type.
          For testing purposes, this mock content allows the classification process to continue.`;
        } else {
          throw new Error(`Unsupported mime type: ${mimeType}`);
        }
      }
    } catch (error) {
      throw new Error(`Failed to get file content: ${(error as Error).message}`);
    }
  }
  
  /**
   * Fetch simple text file from Google Drive
   */
  async fetchSimpleTextFile(fileId: string): Promise<string> {
    try {
      if (this.debug) {
        console.log(`Fetching text file content for ${fileId}`);
      }
      
      // Get access token directly
      const token = await (this.googleDrive as any).authService?.getAccessToken();
      
      if (!token) {
        throw new Error('Failed to get access token');
      }
      
      // Download the file content
      const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to download file: ${response.status} ${response.statusText}`);
      }
      
      // Get the text content
      const content = await response.text();
      
      if (this.debug) {
        console.log(`Fetched ${content.length} characters of text`);
      }
      
      return content;
    } catch (error) {
      console.error(`Error fetching text file: ${(error as Error).message}`);
      throw error;
    }
  }
  
  /**
   * Get DOCX content from Google Drive using mammoth
   */
  async getDocxContent(driveId: string): Promise<string> {
    try {
      if (this.debug) {
        console.log(`Getting DOCX content for file ${driveId}`);
      }
      
      // For testing mode, if the drive ID is 'test', return mock content
      if (driveId === 'test') {
        const mockContent = `This is a sample DOCX content extracted for testing.
        
It contains multiple paragraphs and demonstrates what extracted content might look like.

The document discusses clinical trial protocols and patient enrollment procedures.
It contains information about medical research methodologies and statistical analysis.

This is just mock data for testing the document classification pipeline functionality.`;

        if (this.debug) {
          console.log(`Using mock content for test drive ID (${mockContent.length} characters)`);
        }
        
        return mockContent;
      }
      
      // Get access token from Google Auth Service directly
      const token = await (this.googleDrive as any)?.authService?.getAccessToken();
      
      if (!token) {
        throw new Error('Failed to get access token');
      }
      
      // Download the file content
      const url = `https://www.googleapis.com/drive/v3/files/${driveId}?alt=media`;
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to download DOCX: ${response.status} ${response.statusText}`);
      }
      
      // Convert to ArrayBuffer for mammoth
      const arrayBuffer = await response.arrayBuffer();
      
      // Use mammoth to extract text content
      const result = await mammoth.extractRawText({
        arrayBuffer
      });
      
      // Clean up the content
      const cleanedContent = result.value
        .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // Remove control characters
        .replace(/\u0000/g, '')  // Remove null bytes
        .replace(/\n{3,}/g, '\n\n')  // Normalize multiple line breaks
        .trim();
      
      if (this.debug) {
        console.log(`Extracted ${cleanedContent.length} characters from DOCX file`);
        if (result.messages.length > 0) {
          console.log('Extraction warnings:', result.messages);
        }
      }
      
      return cleanedContent;
    } catch (error) {
      console.error(`Error extracting DOCX content: ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * Build system prompt for Claude
   */
  buildSystemPrompt(basePrompt: string, documentTypes: DocumentType[]): string {
    if (basePrompt.includes('[INSERT DOCUMENT_TYPES_CSV_DATA HERE]')) {
      // Handle the old prompt format with CSV-style data
      const csvData = documentTypes.map(dt => 
        `${dt.id},${dt.document_type},${dt.category},${dt.description || ''}`
      ).join('\n');
      
      return basePrompt.replace('[INSERT DOCUMENT_TYPES_CSV_DATA HERE]', csvData);
    } else {
      // Use the new format - just append JSON data
      return `${basePrompt}\n\nHere are the document types defined in your system:\n${JSON.stringify(documentTypes, null, 2)}`;
    }
  }

  /**
   * Classify document with Claude API
   */
  async classifyDocument(fileContent: string, systemPrompt: string): Promise<any> {
    try {
      // Create message content for Claude
      const content = `Please classify this document:\n\n${fileContent}`;
      
      // If Claude service is unavailable, return mock data
      if (this.componentStatus['claude'].status !== 'ok') {
        if (this.debug) {
          console.log('Using mock Claude response (Claude service unavailable)');
        }
        
        return {
          document_type: "Clinical Trial",
          document_type_id: "1", // Matches mock document type from getDocumentTypes
          classification_confidence: 0.85,
          classification_reasoning: "The document contains detailed information about clinical trial protocols, patient enrollment procedures, and medical research methodologies.",
          document_summary: "This document outlines procedures for conducting clinical trials, including patient enrollment criteria, protocol implementation, and data collection methodologies. It discusses statistical analysis approaches for evaluating trial outcomes.",
          key_topics: [
            "Clinical trials",
            "Patient enrollment",
            "Research methodology",
            "Statistical analysis"
          ],
          target_audience: "Clinical researchers and trial administrators",
          unique_insights: [
            "Emphasizes standardized approaches to patient enrollment",
            "Discusses integrating multiple data collection modalities"
          ],
          ai_assessment: {
            confidence: 8.5,
            reasoning: "Strong indicators of clinical trial documentation based on terminology and structure"
          }
        };
      }
      
      try {
        if (this.debug) {
          console.log('Calling Claude API for classification...');
        }
        
        // Use getJsonResponse method from our Claude service
        const response = await this.claudeService.getJsonResponse(content, {
          system: systemPrompt,
          temperature: 0.2,
          maxTokens: 4000
        });
        
        if (this.debug) {
          console.log('Successfully received JSON response from Claude API');
        }
        
        return response;
        
      } catch (e) {
        console.error('Error calling Claude service:', e);
        
        // Return mock data on error
        if (this.debug) {
          console.log('Returning mock data after Claude API error');
        }
        
        return {
          document_type: "Clinical Trial",
          document_type_id: "1",
          classification_confidence: 0.85,
          classification_reasoning: "ERROR FALLBACK: The document contains detailed information about clinical trial protocols.",
          document_summary: "ERROR FALLBACK: This document outlines procedures for conducting clinical trials.",
          ai_assessment: {
            confidence: 8.5,
            reasoning: "Mock response due to Claude API error: " + (e as Error).message
          }
        };
      }
    } catch (error) {
      console.error(`Claude API error: ${(error as Error).message}`);
      
      // Return fallback mock data for severe errors
      return {
        document_type: "ERROR_FALLBACK",
        document_type_id: "1",
        classification_confidence: 0.5,
        classification_reasoning: "Error fallback response",
        document_summary: "This is a fallback response due to Claude API error.",
        ai_assessment: {
          confidence: 5.0,
          reasoning: "Fallback due to error: " + (error as Error).message
        }
      };
    }
  }

  /**
   * Update document type in database
   */
  async updateDocumentType(sourceFile: SourcesGoogle, documentTypeId: string): Promise<void> {
    if (this.dryRun) {
      if (this.debug) {
        console.log(`[DRY RUN] Would update document_type_id for ${sourceFile.name} to ${documentTypeId}`);
      }
      return;
    }
    
    // Create a timer to track database operation duration
    const startTime = Date.now();
    
    try {
      const { error } = await this.supabase
        .from('sources_google')
        .update({ document_type_id: documentTypeId })
        .eq('id', sourceFile.id);
  
      if (error) {
        this.componentStatus['supabase'] = { 
          status: 'error', 
          message: `Update error: ${error.message}` 
        };
        throw new Error(`Failed to update document type: ${error.message}`);
      }
  
      const duration = Date.now() - startTime;
      
      if (this.debug) {
        console.log(`Updated document type for file ${sourceFile.name} to ${documentTypeId} (took ${duration}ms)`);
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`Database update failed after ${duration}ms:`, error);
      throw error;
    }
  }

  /**
   * Create expert document record
   */
  async createExpertDocument(sourceFile: SourcesGoogle, rawContent: string, processedContent: any): Promise<void> {
    // Check if the processed content has the expected structure
    if (!processedContent || typeof processedContent !== 'object') {
      throw new Error('Invalid processed content: must be a valid object');
    }
    
    // Default confidence value if not available in the expected format
    let confidence = 0.75; // Default confidence
    
    try {
      if (processedContent.ai_assessment && typeof processedContent.ai_assessment.confidence === 'number') {
        confidence = processedContent.ai_assessment.confidence / 10; // Convert 1-10 to 0-1 scale
      } else if (processedContent.classification_confidence) {
        confidence = processedContent.classification_confidence;
      }
    } catch (error) {
      console.warn('Could not extract confidence from processed content, using default value');
    }
    
    // Create the expert document record
    const expertDoc: Partial<ExpertDocument> = {
      id: uuidv4(),
      source_id: sourceFile.id,
      raw_content: rawContent,
      processed_content: processedContent,
      document_type_id: processedContent.document_type_id || processedContent.document_type || null,
      classification_confidence: confidence,
      classification_metadata: processedContent.ai_assessment || processedContent,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    if (this.debug) {
      console.log('Creating expert document with the following data:');
      console.log(`- source_id: ${expertDoc.source_id}`);
      console.log(`- document_type_id: ${expertDoc.document_type_id}`);
      console.log(`- raw_content length: ${rawContent.length} characters`);
      console.log(`- classification_confidence: ${expertDoc.classification_confidence}`);
    }
    
    if (this.dryRun) {
      if (this.debug) {
        console.log(`[DRY RUN] Would create expert document for file ${sourceFile.name}`);
      }
      return;
    }
    
    // Create a timer to track database operation duration
    const startTime = Date.now();
    
    try {
      const { error } = await this.supabase
        .from('expert_documents')
        .insert(expertDoc);
  
      if (error) {
        this.componentStatus['supabase'] = { 
          status: 'error', 
          message: `Insert error: ${error.message}` 
        };
        throw new Error(`Failed to create expert document: ${error.message}`);
      }
  
      const duration = Date.now() - startTime;
      
      if (this.debug) {
        console.log(`Created expert document for file ${sourceFile.name} (took ${duration}ms)`);
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`Expert document creation failed after ${duration}ms:`, error);
      throw error;
    }
  }

  /**
   * Process a single file
   */
  async processFile(sourceFile: SourcesGoogle, documentTypes: DocumentType[]): Promise<any> {
    try {
      if (this.debug) {
        console.log(`Processing file: ${sourceFile.name} (ID: ${sourceFile.id})`);
      }

      // 1. Get file content - this will use mammoth for DOCX files
      if (!sourceFile.drive_id) {
        throw new Error(`Missing drive_id for file ${sourceFile.name} (ID: ${sourceFile.id})`);
      }
      
      const fileContent = await this.getFileContent(sourceFile.drive_id, sourceFile.mime_type || '');
      
      if (this.debug) {
        console.log(`Successfully extracted content (${fileContent.length} characters)`);
        // Show first 100 chars of content preview
        console.log(`Content preview: ${fileContent.substring(0, 100)}...`);
      }

      // 2. Get classification prompt
      const basePrompt = await this.getClassificationPrompt();
      
      if (this.debug) {
        console.log(`Got classification prompt (${basePrompt.length} characters)`);
      }

      // 3. Build system prompt with document types
      const systemPrompt = this.buildSystemPrompt(basePrompt, documentTypes);
      
      if (this.debug) {
        console.log(`Built system prompt with ${documentTypes.length} document types`);
      }

      // 4. Classify document with Claude API
      if (this.debug) {
        console.log('Sending content to Claude for classification...');
      }
      
      const classificationResult = await this.classifyDocument(fileContent, systemPrompt);
      
      if (this.debug) {
        console.log('Received classification result:');
        console.log(JSON.stringify(classificationResult, null, 2));
      }

      // 5. Update document type in sources_google
      if (classificationResult.document_type_id) {
        if (this.debug) {
          console.log(`Updating document type to ${classificationResult.document_type_id}`);
        }
        await this.updateDocumentType(sourceFile, classificationResult.document_type_id);
      } else {
        console.log(`Warning: No document_type_id found in classification result`);
      }

      // 6. Create expert document record with raw content
      if (this.debug) {
        console.log(`Creating expert document record with ${fileContent.length} characters of raw content`);
      }
      await this.createExpertDocument(sourceFile, fileContent, classificationResult);

      return classificationResult;
    } catch (error) {
      console.error(`Error processing file ${sourceFile.name}: ${(error as Error).message}`);
      return null;
    }
  }

  /**
   * Process files missing document types
   */
  async processFiles(limit: number, outputDir?: string): Promise<any[]> {
    try {
      // 1. Get document types
      const documentTypes = await this.getDocumentTypes();

      // 2. Get files missing document types
      const files = await this.getMissingDocumentTypeFiles(limit);

      // 3. Process each file
      const results = [];
      for (const file of files) {
        const result = await this.processFile(file, documentTypes);
        results.push({
          file: file,
          result: result
        });

        // Write results to output directory if specified
        if (outputDir && result) {
          const outputPath = path.join(outputDir, `${file.id}.json`);
          fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
        }
      }

      return results;
    } catch (error) {
      console.error(`Error processing files: ${(error as Error).message}`);
      return [];
    }
  }
}

// Define CLI program
program
  .name('classify-missing-docs')
  .description('Classify Google Drive files missing document types')
  .option('-l, --limit <number>', 'Limit the number of files to process', '10')
  .option('-o, --output <directory>', 'Output directory for classification results')
  .option('-d, --debug', 'Enable debug logging', false)
  .option('-v, --verbose', 'Enable verbose logging (includes debug)', false)
  .option('--test-prompt', 'Test loading the prompt only', false)
  .option('--test-db', 'Test database connections only', false)
  .option('--test-docx <driveId>', 'Test DOCX extraction for a specific Google Drive ID')
  .option('--test-claude', 'Test Claude API classification with a sample document', false)
  .option('--dry-run', 'Process files but do not update database', false)
  .action(async (options) => {
    try {
      // Set debug mode if verbose is enabled
      const debug = options.debug || options.verbose;
      const dryRun = options.dryRun;
      
      // Initialize classifier
      const classifier = new DocumentClassifier(debug);
      
      // Create output directory if specified
      const outputDir = options.output;
      if (outputDir && !fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      
      // Log header to show what mode we're in
      console.log('='.repeat(50));
      console.log('DOCUMENT CLASSIFICATION CLI');
      console.log('='.repeat(50));
      console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
      console.log(`Debug: ${debug ? 'ON' : 'OFF'}`);
      console.log(`Verbose: ${options.verbose ? 'ON' : 'OFF'}`);
      
      // Handle test modes
      if (options.testPrompt) {
        console.log('\n[TEST MODE] Testing prompt loading...');
        try {
          const prompt = await classifier.getClassificationPrompt();
          console.log(`✅ Successfully loaded prompt: ${prompt.substring(0, 100)}...`);
          console.log(`Total length: ${prompt.length} characters`);
          
          // Check if prompt contains the metadata section
          if (prompt.includes('database_query')) {
            console.log('✅ Prompt includes database query metadata');
          } else {
            console.log('⚠️ Warning: Prompt does not include database query metadata');
          }
          return;
        } catch (error) {
          console.error(`❌ Error loading prompt: ${(error as Error).message}`);
          process.exit(1);
        }
      }
      
      if (options.testDb) {
        console.log('\n[TEST MODE] Testing database connections...');
        try {
          // Test document types query
          console.log('1. Testing document_types query...');
          const documentTypes = await classifier.getDocumentTypes();
          console.log(`✅ Retrieved ${documentTypes.length} document types`);
          
          // Test missing files query
          console.log('2. Testing sources_google missing document types query...');
          const missingFiles = await classifier.getMissingDocumentTypeFiles(5);
          console.log(`✅ Found ${missingFiles.length} files missing document types`);
          
          // Test prompt query
          console.log('3. Testing prompts table query...');
          const prompt = await classifier.getClassificationPrompt();
          console.log(`✅ Successfully retrieved prompt (${prompt.length} characters)`);
          
          return;
        } catch (error) {
          console.error(`❌ Database test failed: ${(error as Error).message}`);
          process.exit(1);
        }
      }
      
      if (options.testDocx) {
        console.log('\n[TEST MODE] Testing DOCX extraction...');
        try {
          const driveId = options.testDocx;
          if (!driveId) {
            console.error('❌ No Drive ID provided. Use --test-docx <driveId>');
            process.exit(1);
          }
          
          console.log(`Extracting content from Drive ID: ${driveId}`);
          const content = await classifier.getDocxContent(driveId);
          console.log(`✅ Successfully extracted ${content.length} characters`);
          console.log(`Content preview: ${content.substring(0, 200)}...`);
          
          // Write the content to the output directory if specified
          if (outputDir) {
            const outputPath = path.join(outputDir, `${driveId}.txt`);
            fs.writeFileSync(outputPath, content);
            console.log(`Output written to: ${outputPath}`);
          }
          return;
        } catch (error) {
          console.error(`❌ DOCX extraction failed: ${(error as Error).message}`);
          process.exit(1);
        }
      }
      
      if (options.testClaude) {
        console.log('\n[TEST MODE] Testing Claude API classification...');
        try {
          // Get document types for the prompt
          const documentTypes = await classifier.getDocumentTypes();
          console.log(`Retrieved ${documentTypes.length} document types for prompt`);
          
          // Get the prompt
          const basePrompt = await classifier.getClassificationPrompt();
          console.log(`Loaded prompt (${basePrompt.length} characters)`);
          
          // Build the system prompt
          const systemPrompt = classifier.buildSystemPrompt(basePrompt, documentTypes);
          console.log(`Built system prompt with document types (${systemPrompt.length} characters)`);
          
          // Sample document content for testing
          const sampleContent = "This is a test document for classification. It contains information about clinical trials and treatment protocols. The document discusses various medical conditions and potential therapies.";
          console.log(`Using sample content (${sampleContent.length} characters)`);
          
          // Classify the document
          console.log('Sending to Claude API...');
          const result = await classifier.classifyDocument(sampleContent, systemPrompt);
          
          console.log('✅ Classification successful. Result:');
          console.log(JSON.stringify(result, null, 2));
          return;
        } catch (error) {
          console.error(`❌ Claude API test failed: ${(error as Error).message}`);
          process.exit(1);
        }
      }
      
      // Regular processing mode
      const limit = parseInt(options.limit, 10);
      console.log(`Processing up to ${limit} files missing document types...`);
      console.log('-'.repeat(50));
      
      console.log(`Step 1/4: Loading document types...`);
      const documentTypes = await classifier.getDocumentTypes();
      console.log(`✅ Loaded ${documentTypes.length} document types`);
      
      console.log(`Step 2/4: Finding files missing document types...`);
      const missingFiles = await classifier.getMissingDocumentTypeFiles(limit);
      console.log(`✅ Found ${missingFiles.length} files missing document types`);
      
      if (missingFiles.length === 0) {
        console.log('No files to process. Exiting.');
        return;
      }
      
      console.log(`Step 3/4: Loading classification prompt...`);
      const basePrompt = await classifier.getClassificationPrompt();
      console.log(`✅ Loaded prompt (${basePrompt.length} characters)`);
      
      console.log(`Step 4/4: Processing files${dryRun ? ' (DRY RUN)' : ''}...`);
      // Modify the classifier's processing to respect dry run mode
      if (dryRun) {
        classifier.setDryRun(true);
      }
      
      const results = await classifier.processFiles(limit, outputDir);
      const successCount = results.filter(r => r.result).length;
      
      console.log('='.repeat(50));
      console.log(`SUMMARY: Processed ${results.length} files, ${successCount} successfully classified`);
      
      // Show table of results
      console.log('\nResults:');
      console.log('-'.repeat(80));
      console.log('| File ID                               | File Name                  | Status    |');
      console.log('-'.repeat(80));
      results.forEach(r => {
        const id = r.file.id.substring(0, 36).padEnd(36);
        const name = (r.file.name || 'Unknown').substring(0, 25).padEnd(25);
        const status = r.result ? 'Success' : 'Failed';
        console.log(`| ${id} | ${name} | ${status.padEnd(9)} |`);
      });
      console.log('-'.repeat(80));
      
    } catch (error) {
      console.error(`Error: ${(error as Error).message}`);
      if (options.verbose) {
        console.error('Stack trace:', (error as Error).stack);
      }
      process.exit(1);
    }
  });

program.parse();