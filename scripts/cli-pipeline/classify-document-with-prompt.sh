#!/bin/bash
# classify-document-with-prompt.sh - Classify documents using Claude

# Get script directory and root directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Set default count if not provided
COUNT=${1:-10}
# Determine if we should classify untyped documents only
UNTYPED_ONLY=${2:-"recent"}

echo "🧠 Classifying documents using Claude..."
echo "Number of documents to process: $COUNT"
echo "Mode: ${UNTYPED_ONLY}"

# Check for Claude API key
if [ -z "$CLAUDE_API_KEY" ] && [ -z "$ANTHROPIC_API_KEY" ]; then
  echo "❌ Error: No Claude API key found in environment variables."
  echo "Please set either CLAUDE_API_KEY or ANTHROPIC_API_KEY environment variable."
  exit 1
fi

# Create temporary script for classification
TEMP_DIR=$(mktemp -d)
CLASS_SCRIPT="${TEMP_DIR}/classify_document.js"

# Create package.json in temp directory to ensure local installation
cat > "$TEMP_DIR/package.json" << 'EOL'
{
  "name": "temp-document-classifier",
  "version": "1.0.0",
  "description": "Temporary script for document classification",
  "main": "classify_document.js",
  "dependencies": {
    "@supabase/supabase-js": "^2.48.1",
    "@anthropic-ai/sdk": "^0.16.1"
  }
}
EOL

# Install dependencies in the temp directory
echo "Installing dependencies in temporary directory..."
(cd "$TEMP_DIR" && npm install --silent &> /dev/null)

# Create the script for document classification
cat > "$CLASS_SCRIPT" << 'EOL'
// Document classification script using Claude
const { createClient } = require('@supabase/supabase-js');
const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');
const path = require('path');

// Get environment variables
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const claudeApiKey = process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY;
const rootDir = process.env.ROOT_DIR;
const count = parseInt(process.env.COUNT || '10', 10);
const mode = process.env.MODE || 'recent'; // 'recent' or 'untyped'

// Initialize Anthropic client
const anthropic = new Anthropic({ apiKey: claudeApiKey });

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseKey);

// Sleep function for rate limiting
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Function to read a file
async function readFile(filePath) {
  try {
    const fullPath = path.join(rootDir, filePath);
    return fs.readFileSync(fullPath, 'utf8');
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error);
    return null;
  }
}

// Function to get document types from database
async function getDocumentTypes() {
  const { data, error } = await supabase
    .from('document_types')
    .select('id, name, description')
    .order('name');
    
  if (error) {
    console.error('Error fetching document types:', error);
    return [];
  }
  
  return data;
}

// Function to get the documents to classify
async function getDocumentsToClassify() {
  let query = supabase
    .from('documentation_files')
    .select('id, file_path, title, language')
    .eq('is_deleted', false);
  
  if (mode === 'untyped') {
    // Get untyped documents
    query = query.is('document_type_id', null);
  }
  
  // Order by most recently updated
  query = query.order('updated_at', { ascending: false });
  
  // Limit the number of documents
  if (count > 0) {
    query = query.limit(count);
  }
  
  const { data, error } = await query;
  
  if (error) {
    console.error('Error fetching documents to classify:', error);
    return [];
  }
  
  return data;
}

// Function to classify a document using Claude
async function classifyDocument(document, documentTypes) {
  try {
    // Read the document content
    const content = await readFile(document.file_path);
    
    if (!content) {
      console.error(`Could not read content for ${document.file_path}`);
      return null;
    }
    
    // Prepare prompt for Claude
    const documentTypesText = documentTypes.map(type => 
      `- ${type.name}: ${type.description || 'No description available'}`
    ).join('\n');
    
    const prompt = `You are a document classification system. Analyze the document content below and identify the most appropriate document type from the provided list.

Document Types:
${documentTypesText}

Document Details:
- Title: ${document.title || path.basename(document.file_path)}
- Path: ${document.file_path}
- Language: ${document.language || 'Unknown'}

The document content is between the triple hyphens:
---
${content.substring(0, 10000)} ${content.length > 10000 ? '... (content truncated)' : ''}
---

Please provide your classification in the following JSON format:
{
  "document_type": "Name of the most appropriate document type",
  "confidence": "High/Medium/Low",
  "reasoning": "Brief explanation of why this document type was selected"
}

Your classification should be based on the document content, structure, and purpose. Choose the most specific document type that accurately reflects the document's purpose and content.`;

    console.log(`Classifying document: ${document.file_path}`);
    
    // Rate limit to avoid API throttling
    await sleep(1000);
    
    // Call Claude API
    const response = await anthropic.messages.create({
      model: "claude-3-sonnet-20240229",
      max_tokens: 1000,
      temperature: 0,
      messages: [{ role: "user", content: prompt }]
    });
    
    // Extract and parse JSON from Claude's response
    const responseText = response.content[0].text;
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    
    if (!jsonMatch) {
      console.error('Could not extract JSON from Claude response');
      return null;
    }
    
    try {
      const classification = JSON.parse(jsonMatch[0]);
      return classification;
    } catch (error) {
      console.error('Error parsing JSON from Claude response:', error);
      return null;
    }
  } catch (error) {
    console.error(`Error classifying document ${document.file_path}:`, error);
    return null;
  }
}

// Function to update the document with the classification
async function updateDocumentClassification(documentId, classification, documentTypes) {
  try {
    // Find the document type ID based on the name
    const documentType = documentTypes.find(type => 
      type.name.toLowerCase() === classification.document_type.toLowerCase()
    );
    
    if (!documentType) {
      console.error(`Document type not found: ${classification.document_type}`);
      return false;
    }
    
    // Update the document in the database
    const { error } = await supabase
      .from('documentation_files')
      .update({
        document_type_id: documentType.id,
        ai_classification_confidence: classification.confidence,
        ai_classification_reasoning: classification.reasoning,
        updated_at: new Date()
      })
      .eq('id', documentId);
    
    if (error) {
      console.error(`Error updating document classification:`, error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error(`Error updating document classification:`, error);
    return false;
  }
}

// Main function to run the document classification
async function runDocumentClassification() {
  try {
    console.log(`Starting document classification in ${mode} mode, processing up to ${count} documents`);
    
    // Get document types
    const documentTypes = await getDocumentTypes();
    
    if (documentTypes.length === 0) {
      console.error('No document types found in the database.');
      process.exit(1);
    }
    
    console.log(`Found ${documentTypes.length} document types.`);
    
    // Get documents to classify
    const documents = await getDocumentsToClassify();
    
    if (documents.length === 0) {
      console.log('No documents found to classify.');
      process.exit(0);
    }
    
    console.log(`Found ${documents.length} documents to classify.`);
    
    let successCount = 0;
    let errorCount = 0;
    
    // Process each document
    for (const [index, document] of documents.entries()) {
      console.log(`Processing document ${index + 1}/${documents.length}: ${document.file_path}`);
      
      // Classify the document
      const classification = await classifyDocument(document, documentTypes);
      
      if (!classification) {
        console.error(`Failed to classify ${document.file_path}`);
        errorCount++;
        continue;
      }
      
      // Update the document with the classification
      const updated = await updateDocumentClassification(
        document.id, classification, documentTypes
      );
      
      if (updated) {
        console.log(`Successfully classified ${document.file_path} as ${classification.document_type} (${classification.confidence} confidence)`);
        successCount++;
      } else {
        console.error(`Failed to update classification for ${document.file_path}`);
        errorCount++;
      }
      
      // Add a short delay between documents
      await sleep(500);
    }
    
    console.log(`\nClassification Results:`);
    console.log(`- ${successCount} documents successfully classified`);
    console.log(`- ${errorCount} errors occurred during processing`);
    
    process.exit(errorCount > 0 ? 1 : 0);
  } catch (error) {
    console.error('Error in document classification process:', error);
    process.exit(1);
  }
}

// Run the classification process
runDocumentClassification();
EOL

# Execute the classification script
echo "Running document classification..."
cd "${ROOT_DIR}"
SUPABASE_URL="${SUPABASE_URL}" \
SUPABASE_SERVICE_ROLE_KEY="${SUPABASE_SERVICE_ROLE_KEY}" \
CLAUDE_API_KEY="${CLAUDE_API_KEY}" \
ANTHROPIC_API_KEY="${ANTHROPIC_API_KEY}" \
ROOT_DIR="${ROOT_DIR}" \
COUNT="${COUNT}" \
MODE="${UNTYPED_ONLY}" \
node "${CLASS_SCRIPT}"

CLASSIFY_EXIT_CODE=$?

# Clean up temporary directory
rm -rf "${TEMP_DIR}"

if [ $CLASSIFY_EXIT_CODE -eq 0 ]; then
  echo "✅ Document classification completed successfully"
  exit 0
else
  echo "❌ Document classification failed (exit code: ${CLASSIFY_EXIT_CODE})"
  exit 1
fi