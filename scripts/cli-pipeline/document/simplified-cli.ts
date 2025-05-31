#!/usr/bin/env ts-node

/**
 * Simplified Document CLI
 * 
 * Core commands for document management without complex AI features
 */

import { Command } from 'commander';
import * as path from 'path';
import * as fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
import { documentClassifier } from '../../../packages/shared/services/prompt-service/prompt-service';
import { Database } from '../../../supabase/types';

type DocFile = Database['public']['Tables']['doc_files']['Row'];
type DocumentType = Database['public']['Tables']['document_types']['Row'];

const program = new Command();
const supabase = SupabaseClientService.getInstance().getClient();

// Helper to get root directory
const getRootDir = (): string => {
  return path.resolve(__dirname, '../../..');
};

program
  .name('doc-cli')
  .description('Simplified document management CLI')
  .version('1.0.0');

// sync-docs command
program
  .command('sync-docs')
  .description('Sync filesystem with doc_files table')
  .option('--full', 'Perform full sync including metadata updates')
  .action(async (options) => {
    console.log('🔄 Syncing documents with database...');
    
    try {
      // Get all documents from database
      const { data: dbDocs, error: fetchError } = await supabase
        .from('doc_files')
        .select('id, file_path, file_hash, file_size');
      
      if (fetchError) throw fetchError;
      
      const rootDir = getRootDir();
      let removed = 0;
      let updated = 0;
      let exists = 0;
      
      // Check each document
      for (const doc of dbDocs || []) {
        const fullPath = path.join(rootDir, doc.file_path);
        
        if (!fs.existsSync(fullPath)) {
          // Remove from database if file doesn't exist
          const { error: deleteError } = await supabase
            .from('doc_files')
            .delete()
            .eq('id', doc.id);
          
          if (!deleteError) {
            console.log(`❌ Removed: ${doc.file_path}`);
            removed++;
          }
        } else if (options.full) {
          // Update metadata if requested
          const stats = fs.statSync(fullPath);
          const { error: updateError } = await supabase
            .from('doc_files')
            .update({
              file_size: stats.size,
              last_synced_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq('id', doc.id);
          
          if (!updateError) {
            updated++;
          }
        } else {
          exists++;
        }
      }
      
      console.log(`\n✅ Sync complete:`);
      console.log(`   - ${exists} files exist`);
      console.log(`   - ${updated} files updated`);
      console.log(`   - ${removed} files removed`);
      
    } catch (error) {
      console.error('❌ Error syncing documents:', error);
      process.exit(1);
    }
  });

// classify-doc command
program
  .command('classify-doc <file-path>')
  .description('Classify a single document using prompt service')
  .action(async (filePath: string) => {
    console.log(`🏷️  Classifying document: ${filePath}`);
    
    try {
      const rootDir = getRootDir();
      const fullPath = path.join(rootDir, filePath);
      
      // Check if file exists
      if (!fs.existsSync(fullPath)) {
        console.error(`❌ File not found: ${filePath}`);
        process.exit(1);
      }
      
      // Read file content
      const content = fs.readFileSync(fullPath, 'utf-8');
      const title = path.basename(filePath, path.extname(filePath));
      
      // Get document types
      const { data: docTypes, error: typesError } = await supabase
        .from('document_types')
        .select('id, name, description')
        .eq('is_general_type', false);
      
      if (typesError) throw typesError;
      
      // Use document classifier for classification
      const classificationResult = await documentClassifier.classifyDocument({
        title,
        content: content.substring(0, 3000), // First 3000 chars
        filePath,
        documentTypes: docTypes || []
      });
      
      if (classificationResult && classificationResult.document_type_id) {
        // Check if document exists in database
        const { data: existingDoc } = await supabase
          .from('doc_files')
          .select('id')
          .eq('file_path', filePath)
          .single();
        
        if (existingDoc) {
          // Update existing document
          const { error: updateError } = await supabase
            .from('doc_files')
            .update({
              document_type_id: classificationResult.document_type_id,
              updated_at: new Date().toISOString()
            })
            .eq('id', existingDoc.id);
          
          if (updateError) throw updateError;
          console.log(`✅ Updated classification: ${classificationResult.document_type}`);
        } else {
          // Insert new document
          const stats = fs.statSync(fullPath);
          const { error: insertError } = await supabase
            .from('doc_files')
            .insert({
              id: uuidv4(),
              file_path: filePath,
              title,
              document_type_id: classificationResult.document_type_id,
              file_size: stats.size,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            });
          
          if (insertError) throw insertError;
          console.log(`✅ Created and classified: ${classificationResult.document_type}`);
        }
      } else {
        console.error('❌ Could not determine document type');
      }
      
    } catch (error) {
      console.error('❌ Error classifying document:', error);
      process.exit(1);
    }
  });

// tag-doc command
program
  .command('tag-doc <file-path> <tags...>')
  .description('Add tags to a document')
  .action(async (filePath: string, tags: string[]) => {
    console.log(`🏷️  Tagging document: ${filePath}`);
    console.log(`   Tags: ${tags.join(', ')}`);
    
    try {
      // Update document tags
      const { error } = await supabase
        .from('doc_files')
        .update({
          tags,
          updated_at: new Date().toISOString()
        })
        .eq('file_path', filePath);
      
      if (error) throw error;
      
      console.log('✅ Tags updated successfully');
      
    } catch (error) {
      console.error('❌ Error tagging document:', error);
      process.exit(1);
    }
  });

// mark-important command
program
  .command('mark-important <file-path> <score>')
  .description('Set importance score for a document (1-5)')
  .action(async (filePath: string, score: string) => {
    const scoreNum = parseInt(score);
    
    if (isNaN(scoreNum) || scoreNum < 1 || scoreNum > 5) {
      console.error('❌ Score must be between 1 and 5');
      process.exit(1);
    }
    
    console.log(`⭐ Setting importance score: ${scoreNum}`);
    
    try {
      const { error } = await supabase
        .from('doc_files')
        .update({
          importance_score: scoreNum,
          updated_at: new Date().toISOString()
        })
        .eq('file_path', filePath);
      
      if (error) throw error;
      
      console.log('✅ Importance score updated');
      
    } catch (error) {
      console.error('❌ Error updating importance:', error);
      process.exit(1);
    }
  });

// enable-auto-update command
program
  .command('enable-auto-update <file-path> <source> <frequency>')
  .description('Enable auto-updates for a document')
  .option('--disable', 'Disable auto-updates')
  .action(async (filePath: string, source: string, frequency: string, options) => {
    console.log(`🔄 ${options.disable ? 'Disabling' : 'Enabling'} auto-update for: ${filePath}`);
    
    try {
      const updateData: any = {
        auto_update_enabled: !options.disable,
        updated_at: new Date().toISOString()
      };
      
      if (!options.disable) {
        updateData.update_source = source;
        updateData.update_frequency = frequency; // e.g., '1 day', '12 hours'
      } else {
        updateData.update_source = null;
        updateData.update_frequency = null;
      }
      
      const { error } = await supabase
        .from('doc_files')
        .update(updateData)
        .eq('file_path', filePath);
      
      if (error) throw error;
      
      console.log(`✅ Auto-update ${options.disable ? 'disabled' : 'enabled'}`);
      
    } catch (error) {
      console.error('❌ Error updating auto-update settings:', error);
      process.exit(1);
    }
  });

// find-new command
program
  .command('find-new')
  .description('Find and add new markdown files to the database')
  .option('--dir <directory>', 'Directory to scan', 'docs')
  .action(async (options) => {
    console.log(`🔍 Scanning for new markdown files in: ${options.dir}`);
    
    try {
      const rootDir = getRootDir();
      const scanDir = path.join(rootDir, options.dir);
      
      // Get existing file paths
      const { data: existingDocs } = await supabase
        .from('doc_files')
        .select('file_path');
      
      const existingPaths = new Set((existingDocs || []).map(d => d.file_path));
      
      // Recursively find markdown files
      const findMarkdownFiles = (dir: string, baseDir: string): string[] => {
        const files: string[] = [];
        const items = fs.readdirSync(dir);
        
        for (const item of items) {
          const fullPath = path.join(dir, item);
          const relativePath = path.relative(rootDir, fullPath);
          
          if (fs.statSync(fullPath).isDirectory()) {
            // Skip node_modules and hidden directories
            if (!item.startsWith('.') && item !== 'node_modules') {
              files.push(...findMarkdownFiles(fullPath, baseDir));
            }
          } else if (item.endsWith('.md')) {
            files.push(relativePath);
          }
        }
        
        return files;
      };
      
      const allFiles = findMarkdownFiles(scanDir, scanDir);
      const newFiles = allFiles.filter(f => !existingPaths.has(f));
      
      console.log(`Found ${allFiles.length} total files, ${newFiles.length} are new`);
      
      // Add new files to database
      for (const filePath of newFiles) {
        const fullPath = path.join(rootDir, filePath);
        const stats = fs.statSync(fullPath);
        const title = path.basename(filePath, '.md')
          .replace(/-/g, ' ')
          .replace(/_/g, ' ')
          .replace(/\b\w/g, l => l.toUpperCase());
        
        const { error } = await supabase
          .from('doc_files')
          .insert({
            id: uuidv4(),
            file_path: filePath,
            title,
            file_size: stats.size,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
        
        if (!error) {
          console.log(`✅ Added: ${filePath}`);
        } else {
          console.error(`❌ Failed to add ${filePath}:`, error.message);
        }
      }
      
      console.log('\n✅ Scan complete');
      
    } catch (error) {
      console.error('❌ Error scanning for new files:', error);
      process.exit(1);
    }
  });

program.parse(process.argv);