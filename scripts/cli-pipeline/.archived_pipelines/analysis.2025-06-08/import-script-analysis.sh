#!/bin/bash

# This script imports script analysis results into the scripts database table

# Set variables
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MONO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ANALYSIS_DIR="$MONO_ROOT/script-analysis-results"
IMPROVE_EXPERTS_DIR="$MONO_ROOT/apps/dhg-improve-experts"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}Starting Script Analysis Import${NC}"
echo "-----------------------------------"

# Check if analysis directory exists
if [ ! -d "$ANALYSIS_DIR" ]; then
  echo -e "${RED}Error: Analysis directory not found: $ANALYSIS_DIR${NC}"
  echo "Please run the analyze-scripts.sh script first to generate analysis results."
  exit 1
fi

# Load environment variables from .env.development if available
ENV_FILE="$IMPROVE_EXPERTS_DIR/.env.development"
if [ -f "$ENV_FILE" ]; then
  echo "Loading environment variables from $ENV_FILE"
  # Extract values using grep
  SUPABASE_KEY=$(grep VITE_SUPABASE_SERVICE_ROLE_KEY "$ENV_FILE" | cut -d '=' -f2- | tr -d ' ')
  SUPABASE_URL=$(grep VITE_SUPABASE_URL "$ENV_FILE" | cut -d '=' -f2- | tr -d ' ')
  echo "Environment variables loaded from .env.development"
else
  echo -e "${RED}Error: .env.development file not found${NC}"
  exit 1
fi

# Create a temporary directory for our node project
TEMP_DIR="$(mktemp -d)"
echo "Created temporary directory: $TEMP_DIR"

# Create package.json
echo -e "${YELLOW}Setting up Node.js project...${NC}"
cat > "$TEMP_DIR/package.json" << EOF
{
  "name": "script-analysis-import",
  "version": "1.0.0",
  "description": "Script to import analysis results to database",
  "main": "import.js",
  "dependencies": {
    "@supabase/supabase-js": "^2.38.5"
  }
}
EOF

# Install dependencies
cd "$TEMP_DIR" && npm install
if [ $? -ne 0 ]; then
  echo -e "${RED}Error installing dependencies${NC}"
  rm -rf "$TEMP_DIR"
  exit 1
fi

# Create the import.js script
cat > "$TEMP_DIR/import.js" << EOF
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Analysis directory from args
const analysisDir = process.argv[2];
// Supabase credentials from args
const supabaseUrl = process.argv[3];
const supabaseKey = process.argv[4];

if (!analysisDir || !supabaseUrl || !supabaseKey) {
  console.error('Missing required arguments: analysisDir, supabaseUrl, supabaseKey');
  process.exit(1);
}

console.log('Using Supabase URL:', supabaseUrl);
const supabase = createClient(supabaseUrl, supabaseKey);

// First check the schema to see what columns are available
async function getTableSchema() {
  try {
    console.log('Checking table schema...');
    
    // Get information about the scripts table
    const { data, error } = await supabase
      .rpc('get_table_definition', { table_name: 'scripts' });
      
    if (error) {
      console.error('Error fetching schema:', error.message);
      // Try another approach - just query for one row to see the structure
      try {
        console.log('Trying to fetch a sample row to determine structure...');
        const { data: sampleData, error: sampleError } = await supabase
          .from('scripts')
          .select('*')
          .limit(1);
          
        if (sampleError) {
          console.error('Error fetching sample:', sampleError.message);
          return [];
        }
        
        if (sampleData && sampleData.length > 0) {
          // Return the column names from the sample data
          return Object.keys(sampleData[0]);
        } else {
          // Just try with basic fields
          return ['file_path', 'title', 'summary', 'created_at', 'updated_at'];
        }
      } catch (err) {
        console.error('Error in schema fallback:', err.message);
        return ['file_path', 'title', 'summary', 'created_at', 'updated_at'];
      }
    }
    
    return data;
  } catch (err) {
    console.error('Error checking schema:', err.message);
    return ['file_path', 'title', 'summary', 'created_at', 'updated_at'];
  }
}

// Read all JSON files from the analysis directory
async function readAnalysisResults() {
  try {
    const files = fs.readdirSync(analysisDir);
    const jsonFiles = files.filter(file => file.endsWith('.json') && !file.includes('summary'));
    
    console.log(\`Found \${jsonFiles.length} analysis result files\`);
    
    const results = [];
    
    for (const file of jsonFiles) {
      const filePath = path.join(analysisDir, file);
      const fileContent = fs.readFileSync(filePath, 'utf8');
      try {
        const result = JSON.parse(fileContent);
        results.push(result);
      } catch (err) {
        console.error(\`Error parsing JSON from \${file}: \${err.message}\`);
      }
    }
    
    return results;
  } catch (err) {
    console.error(\`Error reading analysis results: \${err.message}\`);
    return [];
  }
}

// Format a script record for the database
function formatScriptRecord(analysis, columns) {
  const now = new Date().toISOString();
  
  // Determine the language based on file extension
  let language = 'shell';
  const filePath = analysis.file_path || '';
  const ext = path.extname(filePath).toLowerCase();
  
  if (ext === '.js') language = 'javascript';
  else if (ext === '.ts' || ext === '.tsx') language = 'typescript';
  else if (ext === '.py') language = 'python';
  else if (ext === '.sh' || ext === '.bash') language = 'shell';
  else if (ext === '.sql') language = 'sql';
  else if (ext === '.md') language = 'markdown';
  else if (ext === '.html') language = 'html';
  else if (ext === '.css') language = 'css';
  
  // Start with the full object
  const record = {
    file_path: analysis.file_path,
    title: analysis.title || \`Analysis of \${path.basename(analysis.file_path)}\`,
    language: language, // Always provide a language
    document_type: analysis.document_type || 'unknown',
    summary: analysis.summary || 'No summary available',
    tags: analysis.tags || [],
    code_quality: analysis.code_quality || 70,
    maintainability: analysis.maintainability || 70,
    utility: analysis.utility || 70,
    documentation: analysis.documentation || 60,
    relevance_score: analysis.relevance_score || 80,
    relevance_reasoning: analysis.relevance_reasoning || 'No reasoning available',
    referenced: analysis.referenced || false,
    status: analysis.status || 'analyzed',
    status_confidence: analysis.status_confidence || 90,
    status_reasoning: analysis.status_reasoning || 'No reasoning available',
    script_type: analysis.script_type || 'unknown',
    usage_status: analysis.usage_status || 'active',
    last_analyzed: analysis.analyzed_at || now,
    created_at: now,
    updated_at: now
  };
  
  // If columns is provided, filter to only include existing columns
  if (columns && Array.isArray(columns) && columns.length > 0) {
    // Just include the essential fields
    return {
      file_path: record.file_path,
      title: record.title,
      summary: record.summary,
      language: "shell", // Hard-code shell for all scripts
      created_at: record.created_at,
      updated_at: record.updated_at
    };
  }
  
  // Default fallback if no columns provided
  return {
    file_path: record.file_path,
    title: record.title,
    summary: record.summary,
    created_at: record.created_at,
    updated_at: record.updated_at
  };
}

// Import analysis results into the database
async function importAnalysisResults() {
  try {
    // First get the table columns
    console.log('Checking database schema...');
    const columns = await getTableSchema();
    console.log('Available columns:', columns);
    
    // Read analysis results
    const results = await readAnalysisResults();
    
    if (results.length === 0) {
      console.error('No analysis results found');
      return;
    }
    
    console.log(\`Importing \${results.length} script records to database...\`);
    
    // Process in batches
    const batchSize = 5;
    let successCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < results.length; i += batchSize) {
      const batch = results.slice(i, i + batchSize);
      // Format records using the available columns
      const formattedRecords = batch.map(analysis => formatScriptRecord(analysis, columns));
      
      console.log(\`Processing batch \${Math.floor(i / batchSize) + 1} of \${Math.ceil(results.length / batchSize)} (\${batch.length} scripts)\`);
      
      try {
        const { data, error } = await supabase
          .from('scripts')
          .upsert(formattedRecords, { 
            onConflict: 'file_path',
            ignoreDuplicates: false 
          });
        
        if (error) {
          console.error(\`Batch error: \${JSON.stringify(error)}\`);
          
          // Try one by one if batch fails
          console.log('Trying individual inserts...');
          for (const record of formattedRecords) {
            try {
              const { data: singleData, error: singleError } = await supabase
                .from('scripts')
                .upsert(record, { 
                  onConflict: 'file_path',
                  ignoreDuplicates: false 
                });
                
              if (singleError) {
                console.error(\`Error inserting \${record.file_path}: \${JSON.stringify(singleError)}\`);
                errorCount++;
              } else {
                successCount++;
                console.log(\`Successfully inserted \${record.file_path}\`);
              }
            } catch (singleErr) {
              console.error(\`Exception inserting \${record.file_path}: \${singleErr.message}\`);
              errorCount++;
            }
            
            // Add a small delay between individual inserts
            await new Promise(resolve => setTimeout(resolve, 200));
          }
        } else {
          successCount += batch.length;
          console.log(\`Successfully imported batch \${Math.floor(i / batchSize) + 1}\`);
        }
      } catch (err) {
        console.error(\`Error upserting batch: \${err.message}\`);
        errorCount += batch.length;
      }
      
      // Add a small delay between batches
      if (i + batchSize < results.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    console.log(\`Import completed: \${successCount} successful, \${errorCount} errors\`);
    
  } catch (err) {
    console.error(\`Error in importAnalysisResults: \${err.message}\`);
  }
}

// Run the import
importAnalysisResults();
EOF

# Run the script with the arguments
echo -e "${YELLOW}Importing script analysis results to database...${NC}"
cd "$TEMP_DIR" && node import.js "$ANALYSIS_DIR" "$SUPABASE_URL" "$SUPABASE_KEY"

if [ $? -ne 0 ]; then
  echo -e "${RED}Error importing script analysis results to database${NC}"
  rm -rf "$TEMP_DIR"
  exit 1
fi

# Clean up
rm -rf "$TEMP_DIR"

echo -e "${GREEN}Script analysis results imported to database successfully${NC}"
echo "-----------------------------------"
echo -e "${GREEN}Done!${NC}"
exit 0