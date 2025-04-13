/**
 * Document Classification Script
 * 
 * This script classifies documents using Claude and updates the database
 */

const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');
const path = require('path');
const { 
  getDocumentTypes, 
  getRecentDocuments, 
  getUntypedDocuments,
  updateDocumentClassification 
} = require('../shared/document-service-adapter');

// Get environment variables
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const claudeApiKey = process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY;
const rootDir = process.env.ROOT_DIR;
const count = parseInt(process.env.COUNT || '10', 10);
const mode = process.env.MODE || 'recent'; // 'recent' or 'untyped'

// Validate environment
if (!claudeApiKey) {
  console.error('Missing Claude API key. Please set CLAUDE_API_KEY or ANTHROPIC_API_KEY.');
  process.exit(1);
}

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials. Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

if (!rootDir) {
  console.error('Missing ROOT_DIR. Please set the root directory path.');
  process.exit(1);
}

// Initialize Anthropic client
const anthropic = new Anthropic({ apiKey: claudeApiKey });

// Sleep function for rate limiting
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Read a file
 */
async function readFile(filePath) {
  try {
    console.log(`Reading file: ${filePath}`);
    console.log(`Full path: ${path.join(rootDir, filePath)}`);
    const fullPath = path.join(rootDir, filePath);
    return fs.readFileSync(fullPath, 'utf8');
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error);
    return null;
  }
}

/**
 * Get documents to classify
 */
async function getDocumentsToClassify() {
  try {
    console.log(`Getting documents to classify (${mode} mode, limit ${count})...`);
    
    let documents = [];
    
    if (mode === 'untyped') {
      documents = await getUntypedDocuments(supabaseUrl, supabaseKey, count);
    } else {
      documents = await getRecentDocuments(supabaseUrl, supabaseKey, count);
    }
    
    // Filter out files from excluded directories
    const excludedPaths = [
      'file_types', 
      'backup', 
      'archive', 
      '_archive', 
      'script-analysis-results', 
      'reports'
    ];
    
    const filteredData = documents.filter(file => {
      // Check if the file path contains any of the excluded directory names
      const isExcluded = excludedPaths.some(path => file.file_path.includes(path));
      return !isExcluded;
    });
    
    console.log(`Filtered ${documents.length - filteredData.length} files from excluded directories`);
    
    return filteredData;
  } catch (error) {
    console.error('Error getting documents to classify:', error);
    return [];
  }
}

/**
 * Classify a document using Claude
 */
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
      `- ${type.document_type}: ${type.description || 'No description available'}`
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

/**
 * Run document classification
 */
async function runDocumentClassification() {
  try {
    console.log(`Starting document classification in ${mode} mode, processing up to ${count} documents`);
    
    // Get document types
    const documentTypes = await getDocumentTypes(supabaseUrl, supabaseKey);
    
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
        supabaseUrl, 
        supabaseKey,
        document.id, 
        classification
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