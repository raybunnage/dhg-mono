import { createClient } from '@supabase/supabase-js';
import { marked } from 'marked';
import { createHash } from 'crypto';
import fs from 'fs';
import path from 'path';
import type { Database } from '../../../../../supabase/types';

// Types
export interface DocumentMetadata {
  title?: string;
  description?: string;
  tags?: string[];
  author?: string;
  date?: string;
  [key: string]: any;
}

export interface DocumentSection {
  heading: string;
  level: number;
  content: string;
  anchor: string;
  position: number;
}

export interface DocumentFile {
  id: string;
  filePath: string;
  title: string;
  summary?: string;
  aiGeneratedTags?: string[];
  manualTags?: string[];
  sections?: DocumentSection[];
  metadata?: DocumentMetadata;
}

export interface DocumentRelation {
  sourceId: string;
  targetId: string;
  relationType: string;
}

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_ANON_KEY || '';
const supabase = createClient<Database>(supabaseUrl, supabaseKey);

/**
 * Documentation Service
 * Handles processing markdown files and interacting with the documentation database
 */
export class DocumentationService {
  private baseDocsPath: string;

  constructor(baseDocsPath: string = './docs') {
    this.baseDocsPath = baseDocsPath;
  }

  /**
   * Calculate MD5 hash of file content
   */
  private calculateFileHash(content: string): string {
    return createHash('md5').update(content).digest('hex');
  }

  /**
   * Extract frontmatter metadata from markdown content
   */
  private extractFrontmatter(content: string): { metadata: DocumentMetadata; content: string } {
    const metadata: DocumentMetadata = {};
    let updatedContent = content;

    // Check for YAML frontmatter between --- markers
    const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n/;
    const match = content.match(frontmatterRegex);

    if (match) {
      const frontmatter = match[1];
      updatedContent = content.slice(match[0].length);

      // Parse frontmatter lines
      frontmatter.split('\n').forEach(line => {
        const colonIndex = line.indexOf(':');
        if (colonIndex !== -1) {
          const key = line.slice(0, colonIndex).trim();
          let value = line.slice(colonIndex + 1).trim();

          // Handle arrays (comma-separated values)
          if (value.includes(',')) {
            metadata[key] = value.split(',').map(v => v.trim());
          } else {
            // Remove quotes if present
            if (value.startsWith('"') && value.endsWith('"')) {
              value = value.slice(1, -1);
            }
            metadata[key] = value;
          }
        }
      });
    }

    return { metadata, content: updatedContent };
  }

  /**
   * Extract sections from markdown content
   */
  private extractSections(content: string): DocumentSection[] {
    const sections: DocumentSection[] = [];
    const tokens = marked.lexer(content);
    let position = 0;

    tokens.forEach(token => {
      if (token.type === 'heading') {
        const heading = token.text;
        const level = token.depth;
        
        // Create anchor ID from heading
        const anchor = heading
          .toLowerCase()
          .replace(/[^\w\s-]/g, '')
          .replace(/\s+/g, '-');
        
        // Find content until next heading of same or higher level
        let sectionContent = '';
        let i = tokens.indexOf(token) + 1;
        while (
          i < tokens.length && 
          (tokens[i].type !== 'heading' || (tokens[i].type === 'heading' && (tokens[i] as marked.Tokens.Heading).depth > level))
        ) {
          if (tokens[i].type === 'paragraph') {
            sectionContent += (tokens[i] as marked.Tokens.Paragraph).text + '\n\n';
          } else if (tokens[i].type === 'code') {
            sectionContent += '```' + (tokens[i] as marked.Tokens.Code).lang + '\n';
            sectionContent += (tokens[i] as marked.Tokens.Code).text + '\n```\n\n';
          }
          i++;
        }

        sections.push({
          heading,
          level,
          content: sectionContent.trim(),
          anchor,
          position: position++
        });
      }
    });

    return sections;
  }

  /**
   * Process a markdown file and register it in the database
   */
  async processMarkdownFile(filePath: string): Promise<string> {
    try {
      const fullPath = path.join(this.baseDocsPath, filePath);
      const content = fs.readFileSync(fullPath, 'utf-8');
      const fileHash = this.calculateFileHash(content);
      
      // Extract frontmatter and sections
      const { metadata, content: cleanContent } = this.extractFrontmatter(content);
      const sections = this.extractSections(cleanContent);
      
      // Register file in database
      const { data, error } = await supabase.rpc('register_markdown_file', {
        p_file_path: filePath,
        p_title: metadata.title,
        p_file_hash: fileHash,
        p_metadata: metadata as any
      });
      
      if (error) throw new Error(`Error registering markdown file: ${error.message}`);
      
      const fileId = data;
      
      // Register sections
      for (const section of sections) {
        await supabase.rpc('register_document_section', {
          p_file_id: fileId,
          p_heading: section.heading,
          p_level: section.level,
          p_position: section.position,
          p_anchor_id: section.anchor
        });
      }
      
      return fileId;
    } catch (error) {
      console.error('Error processing markdown file:', error);
      throw error;
    }
  }

  /**
   * Scan a directory for markdown files and process them
   */
  async scanDirectory(dirPath: string = ''): Promise<string[]> {
    try {
      const fullPath = path.join(this.baseDocsPath, dirPath);
      const fileIds: string[] = [];
      
      const items = fs.readdirSync(fullPath);
      
      for (const item of items) {
        const itemPath = path.join(dirPath, item);
        const fullItemPath = path.join(this.baseDocsPath, itemPath);
        const stats = fs.statSync(fullItemPath);
        
        if (stats.isDirectory()) {
          // Recursively scan subdirectories
          const subDirFileIds = await this.scanDirectory(itemPath);
          fileIds.push(...subDirFileIds);
        } else if (stats.isFile() && item.endsWith('.md')) {
          // Process markdown files
          const fileId = await this.processMarkdownFile(itemPath);
          fileIds.push(fileId);
        }
      }
      
      return fileIds;
    } catch (error) {
      console.error('Error scanning directory:', error);
      throw error;
    }
  }

  /**
   * Process the next file in the AI processing queue
   */
  async processNextFileWithAI(): Promise<boolean> {
    try {
      // Get next file for processing
      const { data, error } = await supabase.rpc('get_next_file_for_processing');
      
      if (error) throw new Error(`Error getting next file for processing: ${error.message}`);
      if (!data || data.length === 0) return false; // No files to process
      
      const { queue_id, file_id, file_path } = data[0];
      
      // Read file content
      const fullPath = path.join(this.baseDocsPath, file_path);
      const content = fs.readFileSync(fullPath, 'utf-8');
      
      // Extract sections to get a better understanding of the document
      const { content: cleanContent } = this.extractFrontmatter(content);
      const sections = this.extractSections(cleanContent);
      
      // Generate summary and tags using AI
      const summary = await this.generateSummaryWithAI(cleanContent, sections);
      const tags = await this.generateTagsWithAI(cleanContent, sections);
      
      // Update document with AI-generated metadata
      await supabase.rpc('update_document_ai_metadata', {
        p_file_id: file_id,
        p_summary: summary,
        p_ai_generated_tags: tags
      });
      
      // Detect and register relations between documents
      await this.detectAndRegisterRelations(file_id, cleanContent);
      
      return true;
    } catch (error) {
      console.error('Error processing file with AI:', error);
      return false;
    }
  }

  /**
   * Generate a summary of a document using AI
   */
  private async generateSummaryWithAI(content: string, sections: DocumentSection[]): Promise<string> {
    try {
      // In a real implementation, this would call an AI service
      // For now, we'll return a placeholder
      
      // Extract the first paragraph as a simple summary
      const firstParagraph = content.split('\n\n')[0];
      return firstParagraph.length > 150 
        ? firstParagraph.substring(0, 147) + '...'
        : firstParagraph;
      
      // TODO: Replace with actual AI call
      // return await aiService.generateSummary(content, sections);
    } catch (error) {
      console.error('Error generating summary with AI:', error);
      return '';
    }
  }

  /**
   * Generate tags for a document using AI
   */
  private async generateTagsWithAI(content: string, sections: DocumentSection[]): Promise<string[]> {
    try {
      // In a real implementation, this would call an AI service
      // For now, we'll extract some keywords based on frequency
      
      // Simple keyword extraction
      const words = content
        .toLowerCase()
        .replace(/[^\w\s]/g, '')
        .split(/\s+/)
        .filter(word => word.length > 4);
      
      const wordFrequency: Record<string, number> = {};
      words.forEach(word => {
        wordFrequency[word] = (wordFrequency[word] || 0) + 1;
      });
      
      // Get top 5 most frequent words as tags
      return Object.entries(wordFrequency)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([word]) => word);
      
      // TODO: Replace with actual AI call
      // return await aiService.generateTags(content, sections);
    } catch (error) {
      console.error('Error generating tags with AI:', error);
      return [];
    }
  }

  /**
   * Detect and register relations between documents
   */
  private async detectAndRegisterRelations(fileId: string, content: string): Promise<void> {
    try {
      // Look for markdown links to other documents
      const linkRegex = /\[([^\]]+)\]\(([^)]+\.md[^)]*)\)/g;
      let match;
      
      while ((match = linkRegex.exec(content)) !== null) {
        const linkedPath = match[2];
        
        // Normalize path (handle relative paths)
        let normalizedPath = linkedPath.split('#')[0]; // Remove anchor
        
        // Find the target document
        const { data, error } = await supabase
          .from('documentation_files')
          .select('id')
          .eq('file_path', normalizedPath)
          .maybeSingle();
        
        if (error) throw new Error(`Error finding linked document: ${error.message}`);
        if (data) {
          // Register relation
          await supabase.rpc('register_document_relation', {
            p_source_id: fileId,
            p_target_id: data.id,
            p_relation_type: 'reference'
          });
        }
      }
    } catch (error) {
      console.error('Error detecting relations:', error);
    }
  }

  /**
   * Search documentation
   */
  async searchDocumentation(query: string, limit: number = 20): Promise<any[]> {
    try {
      const { data, error } = await supabase.rpc('search_documentation', {
        search_query: query,
        limit_results: limit
      });
      
      if (error) throw new Error(`Error searching documentation: ${error.message}`);
      
      return data || [];
    } catch (error) {
      console.error('Error searching documentation:', error);
      return [];
    }
  }

  /**
   * Find related documents
   */
  async findRelatedDocuments(documentId: string, limit: number = 10): Promise<any[]> {
    try {
      const { data, error } = await supabase.rpc('find_related_documents', {
        document_id: documentId,
        limit_results: limit
      });
      
      if (error) throw new Error(`Error finding related documents: ${error.message}`);
      
      return data || [];
    } catch (error) {
      console.error('Error finding related documents:', error);
      return [];
    }
  }

  /**
   * Search documents by tag
   */
  async searchDocumentsByTag(tag: string, limit: number = 20): Promise<any[]> {
    try {
      const { data, error } = await supabase.rpc('search_documents_by_tag', {
        tag_name: tag,
        limit_results: limit
      });
      
      if (error) throw new Error(`Error searching documents by tag: ${error.message}`);
      
      return data || [];
    } catch (error) {
      console.error('Error searching documents by tag:', error);
      return [];
    }
  }

  /**
   * Get document details
   */
  async getDocumentDetails(documentId: string): Promise<DocumentFile | null> {
    try {
      // Get document metadata
      const { data: fileData, error: fileError } = await supabase
        .from('documentation_files')
        .select('*')
        .eq('id', documentId)
        .single();
      
      if (fileError) throw new Error(`Error getting document: ${fileError.message}`);
      if (!fileData) return null;
      
      // Get document sections
      const { data: sectionData, error: sectionError } = await supabase
        .from('documentation_sections')
        .select('*')
        .eq('file_id', documentId)
        .order('position', { ascending: true });
      
      if (sectionError) throw new Error(`Error getting document sections: ${sectionError.message}`);
      
      // Map to DocumentFile interface
      const document: DocumentFile = {
        id: fileData.id,
        filePath: fileData.file_path,
        title: fileData.title,
        summary: fileData.summary || undefined,
        aiGeneratedTags: fileData.ai_generated_tags || undefined,
        manualTags: fileData.manual_tags || undefined,
        metadata: fileData.metadata || undefined,
        sections: sectionData?.map(section => ({
          heading: section.heading,
          level: section.level,
          content: '', // Content is not stored in the database
          anchor: section.anchor_id,
          position: section.position
        }))
      };
      
      return document;
    } catch (error) {
      console.error('Error getting document details:', error);
      return null;
    }
  }
}

export default DocumentationService; 