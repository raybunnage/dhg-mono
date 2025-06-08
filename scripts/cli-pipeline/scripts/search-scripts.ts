#!/usr/bin/env ts-node
/**
 * Script: search-scripts.ts
 * Purpose: Search scripts by content, name, tags, or metadata
 * Pipeline: scripts
 * Tags: search, query, filter
 */

import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
import { format } from 'date-fns';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface SearchResult {
  file_path: string;
  title: string;
  language: string;
  metadata: any;
  document_type_id: string | null;
  ai_assessment: any;
  ai_generated_tags: string[] | null;
  matches: string[];
}

/**
 * Search for content in files using ripgrep
 */
async function searchFileContent(query: string, filePaths: string[]): Promise<Map<string, string[]>> {
  const matches = new Map<string, string[]>();
  
  if (filePaths.length === 0) return matches;
  
  try {
    // Use ripgrep for fast content search
    const rgPath = '/Users/raybunnage/Documents/github/dhg-mono/node_modules/@anthropic-ai/claude-code/vendor/ripgrep/arm64-darwin/rg';
    
    // Create a temporary file with the list of files to search
    const tempFile = `/tmp/script-search-${Date.now()}.txt`;
    await fs.writeFile(tempFile, filePaths.join('\n'));
    
    // Run ripgrep with context
    const cmd = `${rgPath} -i -C 2 --no-heading "${query}" --files-from="${tempFile}" 2>/dev/null || true`;
    const { stdout } = await execAsync(cmd);
    
    // Clean up temp file
    await fs.unlink(tempFile).catch(() => {});
    
    if (stdout) {
      // Parse ripgrep output
      const lines = stdout.split('\n');
      let currentFile = '';
      let currentMatches: string[] = [];
      
      for (const line of lines) {
        if (line.includes(':')) {
          const [filePath, ...rest] = line.split(':');
          if (filePath && fsSync.existsSync(filePath)) {
            if (currentFile && currentFile !== filePath) {
              matches.set(currentFile, currentMatches);
              currentMatches = [];
            }
            currentFile = filePath;
            currentMatches.push(rest.join(':').trim());
          }
        }
      }
      
      if (currentFile && currentMatches.length > 0) {
        matches.set(currentFile, currentMatches);
      }
    }
  } catch (error) {
    console.error('Error searching file content:', error);
  }
  
  return matches;
}

/**
 * Main search function
 */
async function searchScripts(query?: string) {
  if (!query) {
    query = process.argv.slice(2).join(' ');
  }
  
  if (!query) {
    console.error('❌ Error: Please provide a search query');
    console.log('Usage: ./scripts-cli.sh search <query>');
    process.exit(1);
  }
  
  const supabase = SupabaseClientService.getInstance().getClient();
  
  console.log(`🔍 Searching for: "${query}"\n`);
  
  // Search in database first (title, tags, purpose)
  const { data: scripts, error } = await supabase
    .from('registry_scripts')
    .select(`
      file_path,
      title,
      language,
      metadata,
      document_type_id,
      ai_assessment,
      ai_generated_tags,
      created_at,
      updated_at,
      last_modified_at
    `)
    .or(`title.ilike.%${query}%,ai_assessment->>purpose.ilike.%${query}%`)
    .order('last_modified_at', { ascending: false });
  
  if (error) {
    console.error('❌ Error searching scripts:', error);
    return;
  }
  
  // Also search for scripts with matching tags
  const { data: taggedScripts } = await supabase
    .from('registry_scripts')
    .select('*')
    .contains('ai_generated_tags', [query.toLowerCase()]);
  
  // Combine results and remove duplicates
  const allScripts = [...(scripts || []), ...(taggedScripts || [])];
  const uniqueScripts = Array.from(
    new Map(allScripts.map(s => [s.file_path, s])).values()
  );
  
  // Search file content
  const filePaths = uniqueScripts.map(s => s.file_path);
  const contentMatches = await searchFileContent(query, filePaths);
  
  // Prepare results
  const results: SearchResult[] = [];
  
  for (const script of uniqueScripts) {
    const matches: string[] = [];
    
    // Check for matches in metadata
    if (script.title.toLowerCase().includes(query.toLowerCase())) {
      matches.push(`Title: ${script.title}`);
    }
    
    if (script.ai_assessment?.purpose?.toLowerCase().includes(query.toLowerCase())) {
      matches.push(`Purpose: ${script.ai_assessment.purpose}`);
    }
    
    if (script.ai_generated_tags?.some((tag: string) => tag.toLowerCase().includes(query.toLowerCase()))) {
      matches.push(`Tags: ${script.ai_generated_tags.join(', ')}`);
    }
    
    // Add content matches
    const fileMatches = contentMatches.get(script.file_path);
    if (fileMatches) {
      matches.push(...fileMatches.slice(0, 3).map(m => `Content: ${m}`));
    }
    
    if (matches.length > 0) {
      results.push({
        ...script,
        matches
      });
    }
  }
  
  // Also search for files that might not be in the database yet
  try {
    const rgPath = '/Users/raybunnage/Documents/github/dhg-mono/node_modules/@anthropic-ai/claude-code/vendor/ripgrep/arm64-darwin/rg';
    const { stdout } = await execAsync(
      `${rgPath} -l -i "${query}" scripts/cli-pipeline --glob "*.{ts,js,sh,py}" 2>/dev/null || true`
    );
    
    if (stdout) {
      const foundFiles = stdout.split('\n').filter(Boolean);
      for (const filePath of foundFiles) {
        if (!results.some(r => r.file_path === filePath)) {
          const relativePath = path.relative(process.cwd(), filePath);
          results.push({
            file_path: relativePath,
            title: path.basename(filePath),
            language: path.extname(filePath).slice(1),
            metadata: {},
            document_type_id: null,
            ai_assessment: null,
            ai_generated_tags: null,
            matches: ['Found in file content (not in registry)']
          } as SearchResult);
        }
      }
    }
  } catch (error) {
    // Ignore errors from ripgrep
  }
  
  // Display results
  if (results.length === 0) {
    console.log('No scripts found matching your search query.');
    return;
  }
  
  console.log(`Found ${results.length} scripts:\n`);
  
  // Group by pipeline
  const byPipeline = results.reduce((acc, result) => {
    const pipeline = result.metadata?.cli_pipeline || 'unknown';
    if (!acc[pipeline]) acc[pipeline] = [];
    acc[pipeline].push(result);
    return acc;
  }, {} as Record<string, SearchResult[]>);
  
  Object.entries(byPipeline)
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([pipeline, pipelineResults]) => {
      console.log(`📁 ${pipeline}/`);
      console.log('─'.repeat(60));
      
      pipelineResults.forEach(result => {
        console.log(`\n  📄 ${result.title}`);
        console.log(`     Path: ${result.file_path}`);
        console.log(`     Language: ${result.language}`);
        
        if (result.document_type_id) {
          console.log(`     Type: ${result.document_type_id}`);
        }
        
        console.log(`\n     Matches:`);
        result.matches.forEach(match => {
          console.log(`       • ${match}`);
        });
      });
      
      console.log('');
    });
  
  console.log(`\n💡 Tip: Use 'classify' command to add AI-powered metadata to unclassified scripts.`);
}

// Run if called directly
if (require.main === module) {
  searchScripts().catch(console.error);
}

export { searchScripts };