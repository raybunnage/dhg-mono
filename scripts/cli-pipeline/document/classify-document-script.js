/**
 * Document Classification Script
 * 
 * This script classifies documents using Claude and updates the database
 * Uses the DocumentClassificationService singleton
 */

const fs = require('fs');
const path = require('path');
const { 
  getDocumentTypes, 
  getRecentDocuments, 
  getUntypedDocuments,
  updateDocumentClassification 
} = require('../shared/document-service-adapter');

// Import shared services
const { documentClassificationService } = require('../../../packages/shared/services/document-classification-service');
const { SupabaseClientService } = require('../../../packages/shared/services/supabase-client');

// Get environment variables
const rootDir = process.env.ROOT_DIR;
const count = parseInt(process.env.COUNT || '10', 10);
const mode = process.env.MODE || 'recent'; // 'recent' or 'untyped'

// Get Supabase client
const supabase = SupabaseClientService.getInstance();
const supabaseUrl = supabase.getUrl();
const supabaseKey = supabase.getApiKey();

// Validate environment
if (!rootDir) {
  console.error('Missing ROOT_DIR. Please set the root directory path.');
  process.exit(1);
}

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
 * Classify a document using DocumentClassificationService
 */
async function classifyDocument(document, documentTypes) {
  try {
    // Read the document content
    const content = await readFile(document.file_path);
    
    if (!content) {
      console.error(`Could not read content for ${document.file_path}`);
      return null;
    }
    
    console.log(`Classifying document: ${document.file_path}`);
    
    // Get the file name from the path
    const fileName = path.basename(document.file_path);
    
    // Rate limit to avoid API throttling
    await sleep(1000);
    
    // Use the document classification service to classify the document
    const classificationResult = await documentClassificationService.classifyDocument(
      content,
      fileName,
      'document-classification-prompt' // Use the default prompt
    );
    
    if (!classificationResult) {
      console.error('Classification failed - service returned null result');
      return null;
    }
    
    // Convert the DocumentClassificationResult to the format expected by updateDocumentClassification
    const classification = {
      document_type: classificationResult.document_type,
      confidence: classificationResult.classification_confidence > 0.8 ? "High" : 
                  classificationResult.classification_confidence > 0.6 ? "Medium" : "Low",
      reasoning: classificationResult.classification_reasoning || "No reasoning provided"
    };
    
    return classification;
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