#!/usr/bin/env ts-node
/**
 * Documentation Processing Script
 * 
 * This script processes markdown files and registers them in the documentation database.
 * It can scan directories recursively and register individual files.
 * 
 * Usage:
 *   ts-node process-documentation.ts scan [directory]
 *   ts-node process-documentation.ts process [file]
 *   ts-node process-documentation.ts process-all
 */

import path from 'path';
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import { marked } from 'marked';
import { createHash } from 'crypto';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

// Constants
const BASE_DIR = path.resolve(process.cwd());
const DOCS_DIR = path.join(BASE_DIR, 'docs');
const PUBLIC_DOCS_DIR = path.join(BASE_DIR, 'public', 'docs');
const PUBLIC_PROMPTS_DIR = path.join(BASE_DIR, 'public', 'prompts');

// Interfaces
interface DocumentMetadata {
  title?: string;
  description?: string;
  tags?: string[];
  author?: string;
  date?: string;
  [key: string]: any;
}

interface DocumentSection {
  heading: string;
  level: number;
  content: string;
  anchor: string;
  position: number;
}

// Helper Functions
function calculateFileHash(content: string): string {
  return createHash('md5').update(content).digest('hex');
}

function extractFrontmatter(content: string): { metadata: DocumentMetadata; content: string } {
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

function extractSections(content: string): DocumentSection[] {
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

async function registerFile(filePath: string, relativePath: string): Promise<string | null> {
  try {
    console.log(`Processing file: ${relativePath}`);
    
    // Read file content
    const content = fs.readFileSync(filePath, 'utf-8');
    const fileHash = calculateFileHash(content);
    
    // Extract frontmatter and sections
    const { metadata, content: cleanContent } = extractFrontmatter(content);
    const sections = extractSections(cleanContent);
    
    // Register file in database
    const { data, error } = await supabase.rpc('register_markdown_file', {
      p_file_path: relativePath,
      p_title: metadata.title || path.basename(relativePath, path.extname(relativePath)),
      p_file_hash: fileHash,
      p_metadata: metadata
    });
    
    if (error) {
      console.error(`Error registering markdown file: ${error.message}`);
      return null;
    }
    
    const fileId = data as string;
    
    // Register sections
    for (const section of sections) {
      const { error: sectionError } = await supabase.rpc('register_document_section', {
        p_file_id: fileId,
        p_heading: section.heading,
        p_level: section.level,
        p_position: section.position,
        p_anchor_id: section.anchor,
        p_summary: section.content.substring(0, 150) + (section.content.length > 150 ? '...' : '')
      });
      
      if (sectionError) {
        console.error(`Error registering section: ${sectionError.message}`);
      }
    }
    
    console.log(`Successfully registered file: ${relativePath}`);
    return fileId;
  } catch (error) {
    console.error(`Error processing file ${relativePath}:`, error);
    return null;
  }
}

async function scanDirectory(directoryPath: string, baseDir: string): Promise<void> {
  try {
    console.log(`Scanning directory: ${path.relative(BASE_DIR, directoryPath)}`);
    
    const items = fs.readdirSync(directoryPath);
    
    for (const item of items) {
      const itemPath = path.join(directoryPath, item);
      const stats = fs.statSync(itemPath);
      
      if (stats.isDirectory()) {
        // Recursively scan subdirectories
        await scanDirectory(itemPath, baseDir);
      } else if (stats.isFile() && item.endsWith('.md')) {
        // Process markdown files
        const relativePath = path.relative(baseDir, itemPath);
        await registerFile(itemPath, relativePath);
      }
    }
  } catch (error) {
    console.error(`Error scanning directory ${directoryPath}:`, error);
  }
}

// Handle prompts between apps and public folders
async function processPrompts(): Promise<void> {
  try {
    console.log('Processing prompts and ensuring they are properly linked...');
    
    // Check if public/prompts directory exists, create if not
    if (!fs.existsSync(PUBLIC_PROMPTS_DIR)) {
      fs.mkdirSync(PUBLIC_PROMPTS_DIR, { recursive: true });
      console.log(`Created directory: ${PUBLIC_PROMPTS_DIR}`);
    }
    
    // Scan apps directory for prompt files
    const appsDir = path.join(BASE_DIR, '..');
    const apps = fs.readdirSync(appsDir);
    
    for (const app of apps) {
      const appPromptsDir = path.join(appsDir, app, 'public', 'prompts');
      
      if (fs.existsSync(appPromptsDir)) {
        console.log(`Found prompts in app: ${app}`);
        
        const promptFiles = fs.readdirSync(appPromptsDir);
        
        for (const file of promptFiles) {
          if (file.endsWith('.md')) {
            const sourcePath = path.join(appPromptsDir, file);
            const targetPath = path.join(PUBLIC_PROMPTS_DIR, file);
            const relativePath = `prompts/${file}`;
            
            // Copy file to public/prompts if it doesn't exist or is different
            if (!fs.existsSync(targetPath) || 
                calculateFileHash(fs.readFileSync(sourcePath, 'utf-8')) !== 
                calculateFileHash(fs.readFileSync(targetPath, 'utf-8'))) {
              
              fs.copyFileSync(sourcePath, targetPath);
              console.log(`Copied prompt file from ${sourcePath} to ${targetPath}`);
            }
            
            // Register the file
            await registerFile(sourcePath, relativePath);
          }
        }
      }
    }
  } catch (error) {
    console.error('Error processing prompts:', error);
  }
}

// Main function
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0]?.toLowerCase();

  if (!command) {
    console.log('No command specified. Use one of the following:');
    console.log('  scan [directory] - Scan a directory for markdown files');
    console.log('  process [file] - Process a single markdown file');
    console.log('  process-all - Process all markdown files in standard locations');
    console.log('  process-prompts - Process prompt files and link them');
    return;
  }

  // Make sure the docs directory exists
  if (!fs.existsSync(DOCS_DIR)) {
    fs.mkdirSync(DOCS_DIR, { recursive: true });
    console.log(`Created directory: ${DOCS_DIR}`);
  }

  // Make sure the public/docs directory exists
  if (!fs.existsSync(PUBLIC_DOCS_DIR)) {
    fs.mkdirSync(PUBLIC_DOCS_DIR, { recursive: true });
    console.log(`Created directory: ${PUBLIC_DOCS_DIR}`);
  }

  switch (command) {
    case 'scan': {
      const dirPath = args[1] ? path.resolve(args[1]) : DOCS_DIR;
      await scanDirectory(dirPath, dirPath === DOCS_DIR ? DOCS_DIR : BASE_DIR);
      break;
    }
    
    case 'process': {
      if (!args[1]) {
        console.error('No file specified for processing');
        return;
      }
      
      const filePath = path.resolve(args[1]);
      if (!fs.existsSync(filePath)) {
        console.error(`File not found: ${filePath}`);
        return;
      }
      
      const relativePath = path.relative(BASE_DIR, filePath);
      await registerFile(filePath, relativePath);
      break;
    }
    
    case 'process-all': {
      // Process docs directory
      if (fs.existsSync(DOCS_DIR)) {
        await scanDirectory(DOCS_DIR, DOCS_DIR);
      }
      
      // Process public/docs directory
      if (fs.existsSync(PUBLIC_DOCS_DIR)) {
        await scanDirectory(PUBLIC_DOCS_DIR, PUBLIC_DOCS_DIR);
      }
      
      // Process prompts
      await processPrompts();
      break;
    }
    
    case 'process-prompts': {
      await processPrompts();
      break;
    }
    
    default:
      console.error(`Unknown command: ${command}`);
      return;
  }

  console.log('Documentation processing completed');
}

// Run the script
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});