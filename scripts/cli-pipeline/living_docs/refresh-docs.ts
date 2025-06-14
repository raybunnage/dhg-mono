#!/usr/bin/env ts-node

import { Command } from 'commander';
import * as fs from 'fs/promises';
import * as path from 'path';
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
import { formatISO } from 'date-fns';

const program = new Command();
const supabase = SupabaseClientService.getInstance().getClient();

interface DocumentMetadata {
  fileName: string;
  path: string;
  description: string;
  updateFrequency: 'daily' | 'weekly' | 'on-change';
  lastUpdated: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  status: 'active' | 'draft' | 'archived';
  category: string;
  fileSize: number;
  createdAt: string;
}

// Extract metadata from markdown content
async function extractMetadata(filePath: string, fileName: string): Promise<Partial<DocumentMetadata>> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.split('\n').slice(0, 50); // Check first 50 lines for metadata
    
    let title = fileName.replace('.md', '');
    let description = '';
    let category = 'general';
    let priority = 'medium';
    let updateFrequency = 'weekly';
    let status = 'active';
    
    // Extract title from first # heading
    const titleMatch = content.match(/^#\s+(.+)$/m);
    if (titleMatch) {
      title = titleMatch[1].trim();
    }
    
    // Extract metadata from frontmatter or special sections
    const metadataSection = content.match(/<!--\s*metadata([\s\S]*?)-->/i);
    if (metadataSection) {
      const metadata = metadataSection[1];
      const categoryMatch = metadata.match(/category:\s*(.+)/i);
      const priorityMatch = metadata.match(/priority:\s*(.+)/i);
      const frequencyMatch = metadata.match(/update-frequency:\s*(.+)/i);
      const statusMatch = metadata.match(/status:\s*(.+)/i);
      
      if (categoryMatch) category = categoryMatch[1].trim().toLowerCase();
      if (priorityMatch) priority = priorityMatch[1].trim().toLowerCase() as any;
      if (frequencyMatch) updateFrequency = frequencyMatch[1].trim().toLowerCase() as any;
      if (statusMatch) status = statusMatch[1].trim().toLowerCase() as any;
    }
    
    // Try to extract description from first paragraph after title
    const descMatch = content.match(/^#\s+.+\n\n(.+)/m);
    if (descMatch) {
      description = descMatch[1].trim().substring(0, 200);
    }
    
    // Categorize based on filename patterns
    if (fileName.includes('template')) category = 'template';
    else if (fileName.includes('architecture')) category = 'architecture';
    else if (fileName.includes('database')) category = 'database';
    else if (fileName.includes('test')) category = 'testing';
    else if (fileName.includes('claude')) category = 'ai';
    else if (fileName.includes('doc')) category = 'documentation';
    
    // Set priority based on certain keywords
    if (fileName.includes('claude.md') || fileName.includes('critical')) priority = 'critical';
    else if (fileName.includes('template') || fileName.includes('guide')) priority = 'high';
    
    return {
      description,
      category,
      priority,
      updateFrequency,
      status
    };
  } catch (error) {
    console.error(`Error extracting metadata from ${fileName}:`, error);
    return {};
  }
}

async function scanLivingDocs() {
  const docsDir = path.join(process.cwd(), 'docs', 'living-docs');
  
  try {
    // Ensure directory exists
    await fs.access(docsDir);
    
    // Get all markdown files
    const files = await fs.readdir(docsDir);
    const mdFiles = files.filter(f => f.endsWith('.md') && !f.startsWith('.'));
    
    console.log(`Found ${mdFiles.length} markdown files in living-docs folder`);
    
    const documents: DocumentMetadata[] = [];
    
    for (const fileName of mdFiles) {
      const filePath = path.join(docsDir, fileName);
      const stats = await fs.stat(filePath);
      
      // Extract metadata from file content
      const metadata = await extractMetadata(filePath, fileName);
      
      documents.push({
        fileName,
        path: `/docs/living-docs/${fileName}`,
        description: metadata.description || `Documentation for ${fileName.replace('.md', '')}`,
        updateFrequency: metadata.updateFrequency || 'weekly',
        lastUpdated: formatISO(stats.mtime),
        priority: metadata.priority || 'medium',
        status: metadata.status || 'active',
        category: metadata.category || 'general',
        fileSize: stats.size,
        createdAt: formatISO(stats.birthtime)
      });
    }
    
    // Sort by creation date (newest first)
    documents.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    // Store in database
    const { error } = await supabase
      .from('doc_living_docs_metadata')
      .upsert(
        documents.map(doc => ({
          file_name: doc.fileName,
          file_path: doc.path,
          description: doc.description,
          update_frequency: doc.updateFrequency,
          last_updated: doc.lastUpdated,
          priority: doc.priority,
          status: doc.status,
          category: doc.category,
          file_size: doc.fileSize,
          created_at: doc.createdAt,
          updated_at: new Date().toISOString()
        })),
        { onConflict: 'file_path' }
      );
    
    if (error) {
      console.error('Error updating database:', error);
      process.exit(1);
    }
    
    console.log(`✅ Successfully refreshed ${documents.length} living docs in database`);
    
    // Show newest documents
    console.log('\nNewest documents:');
    documents.slice(0, 5).forEach(doc => {
      console.log(`  - ${doc.fileName} (${doc.category}) - Created: ${new Date(doc.createdAt).toLocaleDateString()}`);
    });
    
  } catch (error) {
    console.error('Error scanning living docs:', error);
    process.exit(1);
  }
}

program
  .name('refresh-docs')
  .description('Scan living docs folder and update database with metadata')
  .action(scanLivingDocs);

program.parse(process.argv);