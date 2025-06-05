#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse');
const dotenv = require('dotenv');

// Load environment variables
const envPath = path.resolve(__dirname, '../../../.env.development');
if (fs.existsSync(envPath)) {
  console.log(`Loading environment from ${envPath}`);
  dotenv.config({ path: envPath });
}

// Create Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function importUrls() {
  console.log('Importing URLs table...\n');
  
  const csvPath = '/Users/raybunnage/Documents/github/dhg-mono/file_types/csv/imported_sqllite/urls.csv';
  
  // Use streaming parser to handle large files and problematic quotes
  const parser = fs.createReadStream(csvPath).pipe(
    parse({
      columns: true,
      skip_empty_lines: true,
      relax_quotes: true,
      relax_column_count: true,
      quote: '"',
      escape: '\\'
    })
  );
  
  let batch = [];
  const batchSize = 500;
  let totalImported = 0;
  let recordCount = 0;
  
  parser.on('data', async (row) => {
    recordCount++;
    
    // Process the row
    const processed = {
      url_id: parseInt(row.url_id) || null,
      url: row.url || null,
      email_ids_count: parseInt(row.email_ids_count) || null,
      email_ids_text: row.email_ids_text || null,
      earliest_id_datetime: processDateTime(row.earliest_id_datetime),
      latest_id_datetime: processDateTime(row.latest_id_datetime),
      email_senders: row.email_senders || null,
      email_subjects: row.email_subjects || null,
      is_process_concepts_with_ai: processInteger(row.is_process_concepts_with_ai),
      is_openable_url: processInteger(row.is_openable_url),
      article_year: parseInt(row.article_year) || null,
      article_month: parseInt(row.article_month) || null,
      article_day: parseInt(row.article_day) || null,
      title: row.title || null,
      authors: row.authors || null,
      summary: row.summary || null,
      keywords: row.keywords || null,
      url_source: row.url_source || null,
      url_type: row.url_type || null,
      created_at: processDateTime(row.created_at),
      is_in_source: processInteger(row.is_in_source),
      is_extract_concepts_from_url: processInteger(row.is_extract_concepts_from_url)
    };
    
    batch.push(processed);
    
    // Process batch when it reaches the size limit
    if (batch.length >= batchSize) {
      parser.pause();
      await processBatch(batch, totalImported);
      totalImported += batch.length;
      batch = [];
      parser.resume();
    }
  });
  
  parser.on('end', async () => {
    // Process final batch
    if (batch.length > 0) {
      await processBatch(batch, totalImported);
      totalImported += batch.length;
    }
    
    console.log(`\n✅ Successfully imported ${totalImported} records to import_urls`);
  });
  
  parser.on('error', (error) => {
    console.error('Parse error:', error);
  });
}

function processDateTime(value) {
  if (!value || value === '') return null;
  
  // Handle year-only values like "2020"
  if (/^\d{4}$/.test(value)) {
    return `${value}-01-01 00:00:00`;
  }
  
  // Handle cases where a number got into datetime field
  if (!isNaN(value) && value.length === 4) {
    return `${value}-01-01 00:00:00`;
  }
  
  return value;
}

function processInteger(value) {
  if (value === '' || value === null || value === undefined) return null;
  if (value === 'true' || value === 'TRUE' || value === '1') return 1;
  if (value === 'false' || value === 'FALSE' || value === '0') return 0;
  const num = parseInt(value);
  return isNaN(num) ? null : num;
}

async function processBatch(batch, currentTotal) {
  console.log(`Importing records ${currentTotal + 1} to ${currentTotal + batch.length}...`);
  
  const { error } = await supabase
    .from('import_urls')
    .insert(batch);
  
  if (error) {
    console.error('Error importing batch:', error);
    console.log('First record of failed batch:', JSON.stringify(batch[0], null, 2));
    throw error;
  }
}

// Run the import
importUrls().catch(console.error);