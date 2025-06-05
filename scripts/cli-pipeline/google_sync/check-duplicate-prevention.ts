#!/usr/bin/env ts-node
/**
 * Check Duplicate Prevention Implementation
 * 
 * This script analyzes the codebase to ensure all functions that insert
 * records into expert_documents first check if a record with the same
 * source_id already exists to prevent duplicates.
 * 
 * The scan reports:
 * 1. Files with insert operations that already have checks (good)
 * 2. Files with insert operations that lack checks (need fixing)
 * 3. Recommended code changes for files that need fixing
 * 
 * Usage:
 *   ts-node check-duplicate-prevention.ts [options]
 * 
 * Options:
 *   --fix           Generate fixed versions of files that need updating
 *   --apply         Apply fixes directly (use with caution)
 *   --verbose       Show detailed analysis
 */

import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
import { commandTrackingService } from '../../../packages/shared/services/tracking-service/command-tracking-service';
import * as child_process from 'child_process';
import { promisify } from 'util';
const exec = promisify(child_process.exec);

interface CheckOptions {
  fix?: boolean;
  apply?: boolean;
  verbose?: boolean;
}

interface AnalysisResult {
  hasInsertOperation: boolean;
  hasExistenceCheck: boolean;
  lineNumbers: {
    insert: number[];
    check: number[];
  };
  suggestedFix?: string;
  originalCode?: string;
  fixedCode?: string;
}

// List of common patterns for inserting into expert_documents
const INSERT_PATTERNS = [
  // PostgreSQL query pattern
  /INSERT\s+INTO\s+expert_documents/i,
  // Supabase client pattern
  /\.\s*from\s*\(\s*['"]expert_documents['"]\s*\)\s*\.\s*insert\s*\(/i,
  // Alternative Supabase pattern
  /\.\s*from\s*\(\s*`expert_documents`\s*\)\s*\.\s*insert\s*\(/i,
  // Function call pattern (general)
  /insert.*expert_documents/i,
  // Object property pattern
  /expert_documents.*insert/i
];

// List of common patterns for checking existence before inserting
const CHECK_PATTERNS = [
  // EXISTS check in SQL
  /SELECT.*EXISTS.*FROM\s+expert_documents.*WHERE.*source_id/i,
  // NOT EXISTS check in SQL
  /WHERE\s+NOT\s+EXISTS.*FROM\s+expert_documents.*WHERE.*source_id/i,
  // Existence check via select - general pattern
  /\.\s*from\s*\(\s*['"`]expert_documents['"`]\s*\)\s*\.\s*select.*source_id.*eq\s*\(/i,
  // Variable containing check result
  /\bconst\s+.*exists.*\b.*expert_documents.*source_id/i,
  // 'already exists' comment nearby
  /\/\/.*already\s+exists.*expert_documents/i,
  // 'check if exists' comment nearby
  /\/\/.*check\s+if\s+exists.*expert_documents/i,
  // 'source_id' check in an if statement
  /if\s*\(.*source_id.*expert_documents.*\)/i,
  // 'duplicate' check in an if statement
  /if\s*\(.*duplicate.*expert_documents.*\)/i,
  // 'exists' check in an if statement
  /if\s*\(.*exists.*expert_documents.*\)/i
];

/**
 * Analyze a file to check if it correctly prevents duplicate expert_documents
 */
async function analyzeFile(filePath: string, verbose: boolean = false): Promise<AnalysisResult | null> {
  try {
    // Read the file
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const lines = fileContent.split('\n');
    
    // Initialize result
    const result: AnalysisResult = {
      hasInsertOperation: false,
      hasExistenceCheck: false,
      lineNumbers: {
        insert: [],
        check: []
      }
    };
    
    // Check for insert operations
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      for (const pattern of INSERT_PATTERNS) {
        if (pattern.test(line)) {
          result.hasInsertOperation = true;
          result.lineNumbers.insert.push(i + 1); // Line numbers are 1-based
          break;
        }
      }
      
      for (const pattern of CHECK_PATTERNS) {
        if (pattern.test(line)) {
          result.hasExistenceCheck = true;
          result.lineNumbers.check.push(i + 1); // Line numbers are 1-based
          break;
        }
      }
    }
    
    // If we found an insert but no existence check, prepare a suggested fix
    if (result.hasInsertOperation && !result.hasExistenceCheck) {
      result.originalCode = fileContent;
      
      // Generate a suggested fix based on the file content
      // This is a simplistic approach and may need manual refinement
      const suggestedCode = generateSuggestedFix(fileContent, filePath);
      
      if (suggestedCode) {
        result.suggestedFix = suggestedCode;
        result.fixedCode = fileContent.replace(/\.from\('google_expert_documents'\)\.insert\(/g, 
          suggestedCode);
      }
    }
    
    return result.hasInsertOperation ? result : null;
  } catch (error) {
    console.error(`Error analyzing file ${filePath}:`, error);
    return null;
  }
}

/**
 * Generate a suggested code fix for the file
 */
function generateSuggestedFix(content: string, filePath: string): string {
  // Create a different fix depending on the file pattern we detect
  let fix = '';
  
  // For Supabase client pattern
  if (content.includes('.from(\'expert_documents\').insert(')) {
    fix = `
// Check if record already exists for this source ID
const { data: existingRecord, error: checkError } = await supabase
  .from('google_expert_documents')
  .select('id')
  .eq('source_id', sourceId)
  .maybeSingle();

if (checkError) {
  console.error('Error checking for existing expert_documents:', checkError);
  // Handle the error appropriately
}

// Only insert if no record exists for this source ID
if (!existingRecord) {
  const { data, error } = await supabase
    .from('google_expert_documents')
    .insert({
      // Your insert data here
    });
  
  // Handle the insert result
} else {
  console.log('Expert document already exists for source ID:', sourceId);
  // Optionally update the existing record if needed
}
`;
  } else {
    // Generic fix if we can't determine the exact pattern
    fix = `
/*
DUPLICATE PREVENTION: Before inserting a record into expert_documents,
always check if a record with the same source_id already exists:

// Check if record already exists for this source ID
const { data: existingRecord, error: checkError } = await supabase
  .from('google_expert_documents')
  .select('id')
  .eq('source_id', sourceId)
  .maybeSingle();

// Only insert if no record exists
if (!existingRecord) {
  // Proceed with insert
} else {
  // Skip insert or update existing record
}
*/

`;
  }
  
  return fix;
}

/**
 * Find all TypeScript files that might contain database operations
 */
async function findRelevantFiles(): Promise<string[]> {
  try {
    // Use git ls-files to find relevant TypeScript files
    const { stdout } = await exec('git ls-files "*.ts" "*.tsx" | grep -v "node_modules" | grep -v ".d.ts"');
    const allFiles = stdout.split('\n').filter(Boolean);
    
    // Further filter to files that might contain database operations
    const filteredFiles = [];
    
    for (const file of allFiles) {
      try {
        const content = fs.readFileSync(file, 'utf8');
        // Check if file potentially deals with expert_documents table
        if (content.includes('google_expert_documents') && 
            (content.includes('insert') || content.includes('upsert') || 
             content.includes('INSERT INTO'))) {
          filteredFiles.push(file);
        }
      } catch (error) {
        // Skip files that can't be read
      }
    }
    
    return filteredFiles;
  } catch (error) {
    console.error('Error finding relevant files:', error);
    return [];
  }
}

/**
 * Main function to check for proper duplicate prevention
 */
async function checkDuplicatePrevention(options: CheckOptions = {}): Promise<void> {
  console.log('=== Checking Expert Documents Duplicate Prevention ===');
  
  const verbose = options.verbose || false;
  const fix = options.fix || false;
  const apply = options.apply || false;
  
  console.log(`Mode: ${fix ? (apply ? 'Fix and Apply' : 'Generate Fixes') : 'Analysis Only'}`);
  console.log(`Verbose: ${verbose ? 'Yes' : 'No'}`);
  
  // Start tracking the command
  const trackingId = await commandTrackingService.startTracking('google_sync', 'check-duplicate-prevention');
  
  try {
    // Find relevant files
    console.log('\nSearching for relevant files...');
    const relevantFiles = await findRelevantFiles();
    console.log(`Found ${relevantFiles.length} files to check.`);
    
    if (verbose) {
      console.log('\nFiles to analyze:');
      relevantFiles.forEach(file => console.log(`- ${file}`));
    }
    
    // Analyze each file
    console.log('\nAnalyzing files for duplicate prevention...');
    
    const filesWithInserts: string[] = [];
    const filesWithProperChecks: string[] = [];
    const filesMissingChecks: string[] = [];
    const analysisResults = new Map<string, AnalysisResult>();
    
    for (const file of relevantFiles) {
      const result = await analyzeFile(file, verbose);
      
      if (result && result.hasInsertOperation) {
        filesWithInserts.push(file);
        analysisResults.set(file, result);
        
        if (result.hasExistenceCheck) {
          filesWithProperChecks.push(file);
        } else {
          filesMissingChecks.push(file);
        }
      }
    }
    
    // Display analysis results
    console.log('\n=== Analysis Results ===');
    console.log(`Files with expert_documents insert operations: ${filesWithInserts.length}`);
    console.log(`Files with proper existence checks: ${filesWithProperChecks.length}`);
    console.log(`Files missing existence checks: ${filesMissingChecks.length}`);
    
    if (verbose) {
      console.log('\nFiles with proper checks:');
      filesWithProperChecks.forEach(file => {
        const result = analysisResults.get(file);
        console.log(`- ${file}`);
        console.log(`  Insert operations on lines: ${result?.lineNumbers.insert.join(', ')}`);
        console.log(`  Existence checks on lines: ${result?.lineNumbers.check.join(', ')}`);
      });
    }
    
    console.log('\nFiles missing existence checks:');
    filesMissingChecks.forEach(file => {
      const result = analysisResults.get(file);
      console.log(`- ${file}`);
      console.log(`  Insert operations on lines: ${result?.lineNumbers.insert.join(', ')}`);
    });
    
    // Generate and apply fixes if requested
    if (fix) {
      console.log('\n=== Generating Fixes ===');
      const fixesDir = path.join(process.cwd(), 'fixes');
      
      if (!fs.existsSync(fixesDir)) {
        fs.mkdirSync(fixesDir, { recursive: true });
      }
      
      let fixesGenerated = 0;
      let fixesApplied = 0;
      
      for (const file of filesMissingChecks) {
        const result = analysisResults.get(file);
        
        if (result && result.suggestedFix) {
          const fixedContent = `
/* 
 * DUPLICATE PREVENTION FIX
 * 
 * This fix adds a check to prevent duplicate expert_documents records
 * by verifying if a record with the same source_id already exists.
 * 
 * Original file: ${file}
 * Insert operations found on lines: ${result.lineNumbers.insert.join(', ')}
 */

${result.suggestedFix}

// Original file content for reference:
/*
${result.originalCode}
*/
`;
          
          const fixPath = path.join(fixesDir, path.basename(file, '.ts') + '.fix.ts');
          fs.writeFileSync(fixPath, fixedContent);
          console.log(`✅ Generated fix for ${file} at ${fixPath}`);
          fixesGenerated++;
          
          if (apply) {
            // Create a backup of the original file
            const backupPath = file + '.bak';
            fs.copyFileSync(file, backupPath);
            
            // Apply the fix by modifying the original file
            if (result.fixedCode) {
              fs.writeFileSync(file, result.fixedCode);
              console.log(`✅ Applied fix to ${file} (backup created at ${backupPath})`);
              fixesApplied++;
            } else {
              console.log(`⚠️ Could not apply fix to ${file} - please check the generated fix and apply manually`);
            }
          }
        }
      }
      
      console.log(`\nTotal fixes generated: ${fixesGenerated}`);
      if (apply) {
        console.log(`Total fixes applied: ${fixesApplied}`);
      }
    }
    
    // Complete tracking
    await commandTrackingService.completeTracking(trackingId, {
      recordsAffected: filesWithInserts.length,
      summary: `Found ${filesMissingChecks.length} files needing duplicate prevention checks`
    });
    
    // Provide guidance
    console.log('\n=== Next Steps ===');
    if (filesMissingChecks.length > 0) {
      console.log('1. Review the files missing existence checks and add appropriate checks');
      console.log('2. For each file, add code to check if a record with the same source_id already exists');
      console.log('3. Only insert if no matching record is found');
      console.log('\nSample existence check:');
      console.log(`
// Before inserting, check if record already exists
const { data: existingDoc, error: checkError } = await supabase
  .from('google_expert_documents')
  .select('id')
  .eq('source_id', sourceId)
  .maybeSingle();

if (checkError) {
  console.error('Error checking for existing expert document:', checkError);
  return;
}

// Only insert if no record exists
if (!existingDoc) {
  const { data, error } = await supabase
    .from('google_expert_documents')
    .insert({
      source_id: sourceId,
      // other fields...
    });
  
  // Handle insert result
} else {
  console.log('Expert document already exists for source ID:', sourceId);
  // Optionally update the existing record
}
`);
    } else {
      console.log('✅ All files have proper existence checks for google_expert_documents!');
    }
    
    console.log('\nCheck complete!');
  } catch (error) {
    console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
    
    // Complete tracking with failure
    await commandTrackingService.failTracking(
      trackingId, 
      `Error: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

// Set up command line interface
const program = new Command();

program
  .name('check-duplicate-prevention')
  .description('Check if all expert_documents inserts prevent duplicates')
  .option('--fix', 'Generate fixed versions of files that need updating', false)
  .option('--apply', 'Apply fixes directly (use with caution)', false)
  .option('--verbose', 'Show detailed analysis', false)
  .action(async (options) => {
    await checkDuplicatePrevention(options);
  });

// Run the CLI if this module is executed directly
if (require.main === module) {
  program.parse(process.argv);
}

// Export for module usage
export { checkDuplicatePrevention };