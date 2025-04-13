#!/usr/bin/env node

/**
 * Documentation Queue Processor
 * 
 * This script processes items in the documentation_processing_queue table.
 * It can be run as a background job or cron task to provide continuous processing.
 * 
 * Usage:
 *   node process-docs-queue.js [options]
 * 
 * Options:
 *   --limit N      Process up to N items (default: 10)
 *   --interval N   Wait N seconds between items (default: 3)
 *   --once         Run once and exit (default: false)
 *   --verbose      Show detailed logs (default: false)
 */

const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  limit: 10,
  interval: 3,
  once: false,
  verbose: false
};

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '--limit' && i + 1 < args.length) {
    options.limit = parseInt(args[++i], 10);
  } else if (arg === '--interval' && i + 1 < args.length) {
    options.interval = parseInt(args[++i], 10);
  } else if (arg === '--once') {
    options.once = true;
  } else if (arg === '--verbose') {
    options.verbose = true;
  }
}

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: SUPABASE_URL and SUPABASE_KEY environment variables must be set');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Function to generate a file hash
function generateFileHash(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

// Extract a simple summary from markdown content
function extractSummary(content) {
  // Find first paragraph after headings
  const lines = content.split('\n');
  let inParagraph = false;
  let paragraphLines = [];
  
  for (const line of lines) {
    // Skip heading lines
    if (line.startsWith('#')) {
      continue;
    }
    
    // Skip empty lines
    if (!line.trim()) {
      if (inParagraph) {
        // End of paragraph
        break;
      }
      continue;
    }
    
    // Found paragraph text
    inParagraph = true;
    paragraphLines.push(line.trim());
  }
  
  // Join paragraph lines
  const paragraph = paragraphLines.join(' ');
  
  // Limit to a reasonable length
  return paragraph.length > 200 ? paragraph.substring(0, 197) + '...' : paragraph;
}

// Extract headings from content
function extractSections(content, fileId) {
  const sections = [];
  const lines = content.split('\n');
  const headingRegex = /^(#{1,6})\s+(.+)$/;
  
  let position = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(headingRegex);
    
    if (match) {
      const level = match[1].length;
      const heading = match[2].trim();
      const anchorId = heading
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-');
      
      sections.push({
        id: crypto.randomUUID(),
        file_id: fileId,
        heading,
        level,
        position: position++,
        anchor_id: anchorId,
        summary: null
      });
    }
  }
  
  return sections;
}

// Extract potential tags from content
function extractPotentialTags(content) {
  const tags = new Set();
  
  // Extract headings as potential tags
  const headingRegex = /^#{1,3}\s+(.+)$/gm;
  let match;
  
  while ((match = headingRegex.exec(content)) !== null) {
    const heading = match[1].trim();
    if (heading.length > 3 && heading.length < 30) {
      tags.add(heading.toLowerCase());
    }
  }
  
  // Extract tech terms using a simple regex
  const techTerms = [
    'api', 'react', 'vue', 'angular', 'javascript', 'typescript',
    'node', 'database', 'supabase', 'postgres', 'sql', 'authentication',
    'markdown', 'documentation', 'frontend', 'backend', 'deployment',
    'security', 'testing', 'configuration', 'component', 'state',
    'hook', 'function', 'interface', 'type', 'class'
  ];
  
  for (const term of techTerms) {
    const termRegex = new RegExp(`\\b${term}\\b`, 'i');
    if (termRegex.test(content)) {
      tags.add(term.toLowerCase());
    }
  }
  
  return Array.from(tags).slice(0, 10); // Limit to 10 tags
}

// Read a markdown file from disk
function readMarkdownFile(filePath) {
  try {
    const normalizedPath = filePath.startsWith('/') 
      ? filePath.substring(1) 
      : filePath;
    
    // Try to find the file in several common locations
    const possiblePaths = [
      path.join(process.cwd(), normalizedPath),
      path.join(process.cwd(), '..', normalizedPath),
      path.join(process.cwd(), '..', '..', normalizedPath),
      path.join(process.cwd(), 'public', normalizedPath),
      path.join(process.cwd(), '..', 'public', normalizedPath)
    ];
    
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        console.log(`Found file at: ${p}`);
        const content = fs.readFileSync(p, 'utf-8');
        const stats = fs.statSync(p);
        
        return {
          content,
          lastModified: stats.mtime.toISOString(),
          size: stats.size
        };
      }
    }
    
    throw new Error(`File not found: ${filePath}`);
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error.message);
    return null;
  }
}

// Process a single queue item
async function processQueueItem(queueItem) {
  console.log(`Processing queue item: ${queueItem.id} for file: ${queueItem.file_id}`);
  
  try {
    // Mark item as processing
    await supabase
      .from('documentation_processing_queue')
      .update({
        status: 'processing',
        attempts: queueItem.attempts + 1,
        last_attempt_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', queueItem.id);
    
    // Get the file record
    const { data: fileData, error: fileError } = await supabase
      .from('documentation_files')
      .select('*')
      .eq('id', queueItem.file_id)
      .single();
    
    if (fileError || !fileData) {
      throw new Error(`File not found: ${queueItem.file_id}`);
    }
    
    // Read file content
    const fileResult = readMarkdownFile(fileData.file_path);
    
    if (!fileResult || !fileResult.content) {
      throw new Error(`No content for file: ${fileData.file_path}`);
    }
    
    // Extract summary and tags
    const summary = extractSummary(fileResult.content);
    const tags = extractPotentialTags(fileResult.content);
    
    // Update file record with this information
    await supabase
      .from('documentation_files')
      .update({
        summary,
        ai_generated_tags: tags,
        updated_at: new Date().toISOString()
      })
      .eq('id', fileData.id);
    
    // Update or add sections
    const sections = extractSections(fileResult.content, fileData.id);
    
    if (sections.length > 0) {
      // Delete existing sections
      await supabase
        .from('documentation_sections')
        .delete()
        .eq('file_id', fileData.id);
      
      // Add new sections
      await supabase
        .from('documentation_sections')
        .insert(sections);
    }
    
    // Mark as completed
    await supabase
      .from('documentation_processing_queue')
      .update({
        status: 'completed',
        updated_at: new Date().toISOString()
      })
      .eq('id', queueItem.id);
    
    console.log(`✅ Successfully processed file: ${fileData.file_path}`);
    return true;
    
  } catch (error) {
    console.error(`Error processing queue item:`, error.message);
    
    // Mark as failed (or pending if under retry limit)
    await supabase
      .from('documentation_processing_queue')
      .update({
        status: queueItem.attempts >= 3 ? 'failed' : 'pending',
        error_message: error.message,
        updated_at: new Date().toISOString()
      })
      .eq('id', queueItem.id);
    
    return false;
  }
}

// Main processing function
async function processQueue() {
  console.log(`Starting documentation queue processing (${options.once ? 'once' : 'continuous'})`);
  console.log(`Processing up to ${options.limit} items with ${options.interval}s interval`);
  
  let processedCount = 0;
  let successCount = 0;
  
  try {
    do {
      // Get the next item from the queue
      const { data: queueItems, error: fetchError } = await supabase
        .from('documentation_processing_queue')
        .select('*')
        .eq('status', 'pending')
        .order('priority', { ascending: false })
        .order('created_at', { ascending: true })
        .limit(1);
      
      if (fetchError) {
        console.error('Error fetching queue item:', fetchError.message);
        break;
      }
      
      if (!queueItems || queueItems.length === 0) {
        console.log('No pending items in the queue');
        if (options.once) break;
        
        // Wait before checking again
        await new Promise(resolve => setTimeout(resolve, options.interval * 1000));
        continue;
      }
      
      const queueItem = queueItems[0];
      
      // Process the item
      const success = await processQueueItem(queueItem);
      processedCount++;
      if (success) successCount++;
      
      // Check if we've reached the limit
      if (processedCount >= options.limit) {
        console.log(`Processed ${processedCount} items (limit reached)`);
        break;
      }
      
      // Wait before processing the next item
      await new Promise(resolve => setTimeout(resolve, options.interval * 1000));
      
    } while (!options.once); // Continue if not running in "once" mode
    
    console.log(`Processing completed: ${successCount} succeeded, ${processedCount - successCount} failed`);
    
  } catch (error) {
    console.error('Unexpected error in queue processing:', error.message);
  }
}

// Run the processor
processQueue().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});