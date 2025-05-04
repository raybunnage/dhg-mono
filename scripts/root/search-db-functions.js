#!/usr/bin/env node
/**
 * Search Database Functions
 * 
 * This script searches for functions in the exported functions.json file.
 * 
 * Usage:
 *   node search-db-functions.js <search-term> [json-path]
 * 
 * Example:
 *   node search-db-functions.js documentation
 *   node search-db-functions.js "get_document" ../supabase/functions.json
 */

const fs = require('fs');
const path = require('path');

// Get search term from command line
const searchTerm = process.argv[2];
if (!searchTerm) {
  console.error('Error: Please provide a search term');
  console.error('Usage: node search-db-functions.js <search-term> [json-path]');
  process.exit(1);
}

// Get JSON file path from command line or use default
const jsonPath = process.argv[3] || path.join(__dirname, '..', 'supabase', 'functions.json');

// Check if the JSON file exists
if (!fs.existsSync(jsonPath)) {
  console.error(`Error: File not found: ${jsonPath}`);
  console.error('Run the export-db-functions.js script first to generate the functions.json file.');
  process.exit(1);
}

try {
  // Read and parse the JSON file
  const functionsJson = fs.readFileSync(jsonPath, 'utf8');
  const functions = JSON.parse(functionsJson);
  
  if (!Array.isArray(functions)) {
    console.error('Error: Invalid functions.json format. Expected an array.');
    process.exit(1);
  }
  
  // Search for functions matching the search term
  const results = functions.filter(func => {
    const searchFields = [
      func.name,
      func.description,
      func.body,
      func.arguments
    ];
    
    return searchFields.some(field => 
      field && field.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });
  
  // Display results
  if (results.length === 0) {
    console.log(`No functions found matching "${searchTerm}"`);
  } else {
    console.log(`Found ${results.length} function(s) matching "${searchTerm}":`);
    console.log(JSON.stringify(results, null, 2));
    
    // Print a summary of found functions
    console.log('\nSummary:');
    results.forEach((func, index) => {
      console.log(`${index + 1}. ${func.schema}.${func.name}(${func.arguments})`);
    });
  }
} catch (err) {
  console.error('Error processing functions.json:', err);
  process.exit(1);
} 