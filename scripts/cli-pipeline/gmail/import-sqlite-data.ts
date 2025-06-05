#!/usr/bin/env ts-node

import { SupabaseClientService } from '../../../../packages/shared/services/supabase-client';
import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';

interface ImportMapping {
  csvFile: string;
  tableName: string;
  columns: string[];
}

// Define the mapping between CSV files and import tables
const importMappings: ImportMapping[] = [
  {
    csvFile: 'important_email_addresses.csv',
    tableName: 'import_important_email_addresses',
    columns: ['important_email_address_id', 'email_address', 'is_important']
  },
  {
    csvFile: 'emails.csv',
    tableName: 'import_emails',
    columns: ['email_id', 'date', 'sender', 'subject', 'to_recipients', 'content', 
              'attachment_cnt', 'url_cnt', 'is_ai_process_for_concepts', 'contents_length', 
              'is_in_contents', 'is_in_concepts', 'created_at', 'is_valid']
  },
  {
    csvFile: 'email_contents.csv',
    tableName: 'import_email_contents',
    columns: ['email_content_id', 'email_id', 'how_many_participants', 'participants',
              'summary_of_the_email', 'is_science_discussion', 'is_science_material',
              'is_meeting_focused', 'good_quotes']
  },
  {
    csvFile: 'email_concepts.csv',
    tableName: 'import_email_concepts',
    columns: ['email_concept_id', 'email_id', 'email_content_id', 'concept', 'category',
              'summary', 'example', 'url', 'date', 'citation', 'section_info', 'reference_info',
              'source_name', 'actual_quote', 'quote_author', 'created_at', 'backup_category',
              'master_category', 'is_valid', 'auto_learning_grade', 'subject_classifications', 'year']
  },
  {
    csvFile: 'attachments.csv',
    tableName: 'import_attachments',
    columns: ['attachment_id', 'email_id', 'filename', 'size', 'newpdf_id', 'created_at']
  },
  {
    csvFile: 'all_email_urls.csv',
    tableName: 'import_all_email_urls',
    columns: ['all_email_url_id', 'email_id', 'url', 'created_at']
  },
  {
    csvFile: 'rolled_up_emails.csv',
    tableName: 'import_rolled_up_emails',
    columns: ['rolled_up_email_id', 'subject', 'count', 'first_date', 'last_date',
              'senders', 'total_attachments', 'total_urls', 'is_likely_url', 'email_ids', 'content_lengths']
  },
  {
    csvFile: 'urls.csv',
    tableName: 'import_urls',
    columns: ['url_id', 'url', 'email_ids_count', 'email_ids_text', 'earliest_id_datetime',
              'latest_id_datetime', 'email_senders', 'email_subjects', 'is_process_concepts_with_ai',
              'is_openable_url', 'article_year', 'article_month', 'article_day', 'title', 'authors',
              'summary', 'keywords', 'url_source', 'url_type', 'created_at', 'is_in_source',
              'is_extract_concepts_from_url']
  },
  {
    csvFile: 'web_concepts.csv',
    tableName: 'import_web_concepts',
    columns: ['web_concept_id', 'url_id', 'concept', 'category', 'summary', 'example', 'url',
              'date', 'citation', 'section', 'header', 'reference_info', 'source_name', 'quote',
              'learning_grade', 'created_at', 'quote_author', 'subject_classifications',
              'auto_learning_grade', 'learning_grade_reason', 'master_category', 'is_valid',
              'mixed_case_category', 'backup_category', 'year']
  }
];

async function importCSVToSupabase(csvPath: string, tableName: string, columns: string[]) {
  const supabase = SupabaseClientService.getInstance().getClient();
  
  console.log(`\nImporting ${path.basename(csvPath)} to ${tableName}...`);
  
  try {
    // Read CSV file
    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    
    // Parse CSV
    const records = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      cast: (value, context) => {
        // Handle empty strings
        if (value === '') return null;
        
        // Handle boolean fields
        const columnName = String(context.column);
        if (columnName === 'is_important' || 
            columnName === 'is_valid' ||
            columnName.includes('is_')) {
          if (value === '1' || value === 'true' || value === 'TRUE') return true;
          if (value === '0' || value === 'false' || value === 'FALSE') return false;
          return null;
        }
        
        // Handle integer fields
        if (columnName.includes('_id') || 
            columnName.includes('_cnt') ||
            columnName.includes('count') ||
            columnName === 'size' ||
            columnName === 'year' ||
            columnName.includes('grade') ||
            columnName.includes('article_')) {
          const num = parseInt(value, 10);
          return isNaN(num) ? null : num;
        }
        
        // Handle datetime fields
        if (columnName === 'date' || 
            columnName === 'created_at' ||
            columnName.includes('datetime')) {
          // Return as string, let PostgreSQL handle conversion
          return value;
        }
        
        return value;
      }
    });
    
    console.log(`Parsed ${records.length} records`);
    
    if (records.length === 0) {
      console.log('No records to import');
      return;
    }
    
    // Import in batches of 500
    const batchSize = 500;
    let totalImported = 0;
    
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      
      // Clean up records - remove any fields not in our columns list
      const cleanedBatch = batch.map((record: any) => {
        const cleaned: any = {};
        columns.forEach(col => {
          if (record.hasOwnProperty(col)) {
            cleaned[col] = record[col];
          }
        });
        return cleaned;
      });
      
      const { error } = await supabase
        .from(tableName)
        .insert(cleanedBatch);
      
      if (error) {
        console.error(`Error importing batch ${i / batchSize + 1}:`, error);
        throw error;
      }
      
      totalImported += batch.length;
      console.log(`Imported ${totalImported}/${records.length} records`);
    }
    
    console.log(`✅ Successfully imported ${totalImported} records to ${tableName}`);
    
  } catch (error) {
    console.error(`❌ Failed to import ${csvPath}:`, error);
    throw error;
  }
}

async function main() {
  console.log('SQLite to Supabase Data Import');
  console.log('=' .repeat(50));
  
  const csvDir = '/Users/raybunnage/Documents/github/dhg-mono/file_types/csv/imported_sqllite';
  
  // Check if directory exists
  if (!fs.existsSync(csvDir)) {
    console.error(`❌ CSV directory not found: ${csvDir}`);
    process.exit(1);
  }
  
  // Process command line arguments
  const args = process.argv.slice(2);
  const specificTable = args.find(arg => !arg.startsWith('--'));
  const forceReimport = args.includes('--force');
  
  if (args.includes('--help')) {
    console.log('\nUsage: import-sqlite-data [table-name] [options]');
    console.log('\nOptions:');
    console.log('  --force    Clear existing data before importing');
    console.log('  --help     Show this help message');
    console.log('\nAvailable tables:');
    importMappings.forEach(mapping => {
      console.log(`  ${mapping.tableName} (from ${mapping.csvFile})`);
    });
    process.exit(0);
  }
  
  const supabase = SupabaseClientService.getInstance().getClient();
  
  // Filter mappings if specific table requested
  const mappingsToProcess = specificTable
    ? importMappings.filter(m => m.tableName === specificTable || m.csvFile === specificTable)
    : importMappings;
  
  if (specificTable && mappingsToProcess.length === 0) {
    console.error(`❌ Unknown table or file: ${specificTable}`);
    console.log('\nAvailable options:');
    importMappings.forEach(m => {
      console.log(`  ${m.tableName} or ${m.csvFile}`);
    });
    process.exit(1);
  }
  
  // Process each mapping
  for (const mapping of mappingsToProcess) {
    const csvPath = path.join(csvDir, mapping.csvFile);
    
    if (!fs.existsSync(csvPath)) {
      console.log(`⚠️  Skipping ${mapping.csvFile} - file not found`);
      continue;
    }
    
    // Check if table has data
    const { count } = await supabase
      .from(mapping.tableName)
      .select('*', { count: 'exact', head: true });
    
    if (count && count > 0 && !forceReimport) {
      console.log(`\n⚠️  Table ${mapping.tableName} already has ${count} records`);
      console.log('   Use --force to reimport');
      continue;
    }
    
    if (forceReimport && count && count > 0) {
      console.log(`\nClearing ${count} existing records from ${mapping.tableName}...`);
      const { error } = await supabase
        .from(mapping.tableName)
        .delete()
        .gte(mapping.columns[0], 0); // Delete all records
      
      if (error) {
        console.error(`Failed to clear table: ${error.message}`);
        continue;
      }
    }
    
    await importCSVToSupabase(csvPath, mapping.tableName, mapping.columns);
  }
  
  // Show summary
  console.log('\n' + '=' .repeat(50));
  console.log('Import Summary:');
  
  for (const mapping of mappingsToProcess) {
    const { count } = await supabase
      .from(mapping.tableName)
      .select('*', { count: 'exact', head: true });
    
    console.log(`${mapping.tableName}: ${count || 0} records`);
  }
  
  console.log('\n✅ Import process completed!');
  console.log('\nNext steps:');
  console.log('1. Review the imported data for accuracy');
  console.log('2. Run data migration scripts to map to new schema');
  console.log('3. The import_ tables can be dropped after successful migration');
}

// Run the import
main().catch(console.error);