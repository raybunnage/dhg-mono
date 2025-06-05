#!/usr/bin/env node

const fs = require('fs');
const { parse } = require('csv-parse/sync');

const csvPath = '/Users/raybunnage/Documents/github/dhg-mono/file_types/csv/imported_sqllite/urls.csv';

// Read just the first 100 lines
const lines = fs.readFileSync(csvPath, 'utf-8').split('\n').slice(0, 100);
const csvContent = lines.join('\n');

try {
  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    relax_quotes: true,
    relax_column_count: true
  });
  
  console.log('First 5 records:');
  records.slice(0, 5).forEach((record, i) => {
    console.log(`\nRecord ${i + 1}:`);
    console.log('earliest_id_datetime:', record.earliest_id_datetime);
    console.log('latest_id_datetime:', record.latest_id_datetime);
    console.log('article_year:', record.article_year);
  });
} catch (error) {
  console.error('Parse error:', error);
}