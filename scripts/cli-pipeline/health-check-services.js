#!/usr/bin/env node

/**
 * CLI Pipeline Health Check for Singleton Services
 * 
 * This script analyzes the CLI pipeline code to verify proper usage of singleton services
 * and identifies potential opportunities for additional shared service extraction.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const PACKAGES_PATH = path.join(process.cwd(), 'packages', 'shared', 'services');
const CLI_PIPELINE_PATH = path.join(process.cwd(), 'scripts', 'cli-pipeline');

// Service patterns to check for
const SERVICE_PATTERNS = [
  {
    name: 'Supabase Client',
    correctPattern: "SupabaseClientService.getInstance().getClient()",
    incorrectPatterns: [
      "createClient(",
      "new SupabaseClient(",
      "const supabase = createClient("
    ],
    sharedServicePath: 'packages/shared/services/supabase-client'
  },
  {
    name: 'Claude Service',
    correctPattern: "claudeService",
    incorrectPatterns: [
      "new ClaudeService(",
      "Anthropic(",
      "anthropic.messages.create("
    ],
    sharedServicePath: 'packages/shared/services/claude-service'
  },
  {
    name: 'Google Drive',
    correctPattern: "getGoogleDriveService",
    incorrectPatterns: [
      "new google.auth.JWT(",
      "new GoogleDriveClient(",
      "new GoogleDriveService("
    ],
    sharedServicePath: 'packages/shared/services/google-drive'
  },
  {
    name: 'Command Tracking',
    correctPattern: "commandTrackingService",
    incorrectPatterns: [
      "trackCommand("
    ],
    sharedServicePath: 'packages/shared/services/tracking-service'
  },
  {
    name: 'Document Classification',
    correctPattern: "documentClassificationService",
    incorrectPatterns: [
      "createFallbackClassification(",
      "classifyDocument(",
      "document-classification-prompt"
    ],
    sharedServicePath: 'packages/shared/services/document-classification-service'
  },
  {
    name: 'PDF Processor',
    correctPattern: "pdfProcessorService",
    incorrectPatterns: [
      "extractTextFromPDF(",
      "processPDFFromDrive(",
      "processPDFFromFile("
    ],
    sharedServicePath: 'packages/shared/services/pdf-processor-service'
  },
  {
    name: 'Converter Service',
    correctPattern: "converterService",
    incorrectPatterns: [
      "convertPdfToText(",
      "extractVideoMetadata(",
      "convertFileFormat("
    ],
    sharedServicePath: 'packages/shared/services/converter-service'
  },
  {
    name: 'Filter Service',
    correctPattern: "filterService",
    incorrectPatterns: [
      "applyFilters(",
      "filterResults(",
      "queryWithFilters("
    ],
    sharedServicePath: 'packages/shared/services/filter-service'
  }
];

// Helper to check if a file should be analyzed (skip node_modules, etc.)
function shouldAnalyzeFile(filePath) {
  if (filePath.includes('node_modules')) return false;
  if (filePath.includes('.git')) return false;
  
  // Only analyze JavaScript and TypeScript files
  const ext = path.extname(filePath).toLowerCase();
  return ['.js', '.ts', '.jsx', '.tsx'].includes(ext);
}

// Get all existing singleton services
function getExistingServices() {
  const services = [];
  try {
    const serviceFiles = fs.readdirSync(PACKAGES_PATH);
    for (const file of serviceFiles) {
      const servicePath = path.join(PACKAGES_PATH, file);
      if (fs.statSync(servicePath).isDirectory()) {
        services.push({
          name: file,
          path: servicePath
        });
      } else if (file.endsWith('-service.ts') || file.endsWith('-service.js')) {
        services.push({
          name: file.replace(/\.ts|\.js$/, ''),
          path: servicePath
        });
      }
    }
  } catch (error) {
    console.error('Error getting existing services:', error.message);
  }
  return services;
}

// Find all files in a directory recursively
function findFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  
  for (const file of files) {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      findFiles(filePath, fileList);
    } else if (shouldAnalyzeFile(filePath)) {
      fileList.push(filePath);
    }
  }
  
  return fileList;
}

// Analyze a file for service usage
function analyzeFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const results = {
    filePath,
    serviceUsage: [],
    potentialIssues: [],
    potentialServiceOpportunities: []
  };
  
  // Check for each service pattern
  for (const service of SERVICE_PATTERNS) {
    // Check for correct pattern
    const correctUsage = content.includes(service.correctPattern);
    
    // Check for incorrect patterns
    const incorrectPatterns = service.incorrectPatterns.filter(pattern => 
      content.includes(pattern)
    );
    
    results.serviceUsage.push({
      service: service.name,
      correctUsage,
      incorrectPatterns
    });
    
    // Report potential issues
    if (!correctUsage && incorrectPatterns.length > 0) {
      results.potentialIssues.push({
        service: service.name,
        patterns: incorrectPatterns,
        recommendation: `Replace direct implementation with ${service.name} shared service from ${service.sharedServicePath}`
      });
    }
  }
  
  // Look for potential new service opportunities - repeated utility functions, etc.
  const utilityPatterns = [
    { pattern: "function parse", serviceType: "Parser Service" },
    { pattern: "function format", serviceType: "Formatter Service" },
    { pattern: "function validate", serviceType: "Validator Service" },
    { pattern: "function transform", serviceType: "Transformer Service" },
    { pattern: "function convert", serviceType: "Converter Service" },
    { pattern: "export class", serviceType: "Class that could be a Singleton Service" }
  ];
  
  for (const pattern of utilityPatterns) {
    if (content.includes(pattern.pattern)) {
      results.potentialServiceOpportunities.push({
        type: pattern.serviceType,
        file: filePath
      });
    }
  }
  
  return results;
}

// Generate a health check report
function generateReport(results) {
  console.log('\n===== CLI PIPELINE HEALTH CHECK REPORT =====\n');
  
  // Count totals
  const totalFiles = results.length;
  let correctImplementations = 0;
  let incorrectImplementations = 0;
  let filesToFix = [];
  let potentialOpportunities = [];
  
  for (const result of results) {
    let hasIssues = result.potentialIssues.length > 0;
    if (hasIssues) {
      incorrectImplementations++;
      filesToFix.push(result.filePath);
    } else {
      correctImplementations++;
    }
    
    if (result.potentialServiceOpportunities.length > 0) {
      potentialOpportunities.push(...result.potentialServiceOpportunities);
    }
  }
  
  // Print summary
  console.log(`Total files analyzed: ${totalFiles}`);
  console.log(`Files with correct service implementation: ${correctImplementations}`);
  console.log(`Files with incorrect service implementation: ${incorrectImplementations}`);
  
  // Print files to fix
  if (filesToFix.length > 0) {
    console.log('\n----- FILES THAT NEED FIXING -----');
    filesToFix.forEach(file => {
      console.log(`- ${file.replace(process.cwd(), '')}`);
    });
  }
  
  // Print detailed issues
  console.log('\n----- DETAILED ISSUES -----');
  let issueCount = 0;
  
  for (const result of results) {
    if (result.potentialIssues.length > 0) {
      console.log(`\nFile: ${result.filePath.replace(process.cwd(), '')}`);
      
      for (const issue of result.potentialIssues) {
        console.log(`  - Issue: Incorrect ${issue.service} implementation`);
        console.log(`    Patterns found: ${issue.patterns.join(', ')}`);
        console.log(`    Recommendation: ${issue.recommendation}`);
        issueCount++;
      }
    }
  }
  
  if (issueCount === 0) {
    console.log('No issues found! All files are using singleton services correctly.');
  }
  
  // Print potential service opportunities
  if (potentialOpportunities.length > 0) {
    console.log('\n----- POTENTIAL SERVICE OPPORTUNITIES -----');
    
    // Group by service type
    const opportunitiesByType = {};
    for (const opp of potentialOpportunities) {
      if (!opportunitiesByType[opp.type]) {
        opportunitiesByType[opp.type] = [];
      }
      opportunitiesByType[opp.type].push(opp.file.replace(process.cwd(), ''));
    }
    
    for (const [type, files] of Object.entries(opportunitiesByType)) {
      console.log(`\nPotential ${type}:`);
      files.slice(0, 5).forEach(file => {
        console.log(`  - ${file}`);
      });
      
      if (files.length > 5) {
        console.log(`  - ... and ${files.length - 5} more files`);
      }
    }
  }
  
  // Print existing services
  const existingServices = getExistingServices();
  console.log('\n----- EXISTING SHARED SERVICES -----');
  existingServices.forEach(service => {
    console.log(`- ${service.name}`);
  });
  
  console.log('\n===== END OF REPORT =====');
}

// Main function
async function main() {
  try {
    console.log('Starting CLI Pipeline Health Check...');
    
    // Find all CLI pipeline files
    console.log('Finding CLI pipeline files...');
    const cliFiles = findFiles(CLI_PIPELINE_PATH);
    console.log(`Found ${cliFiles.length} files to analyze`);
    
    // Analyze each file
    console.log('Analyzing files for service usage...');
    const results = [];
    
    for (const file of cliFiles) {
      const result = analyzeFile(file);
      results.push(result);
    }
    
    // Generate report
    generateReport(results);
    
  } catch (error) {
    console.error('Error during health check:', error);
    process.exit(1);
  }
}

main();