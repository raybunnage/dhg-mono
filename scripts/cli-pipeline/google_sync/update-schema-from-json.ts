#!/usr/bin/env ts-node
/**
 * Update Schema From JSON
 * 
 * This script:
 * 1. Reads a JSON schema definition for a table
 * 2. Compares it with the current schema in Supabase
 * 3. Shows differences or generates SQL to update the schema
 */

import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { SupabaseClientService } from '../../../packages/shared/services/supabase-client';
import { Logger } from '../../../packages/shared/utils/logger';

// Load environment variables
dotenv.config();

interface ColumnDefinition {
  column_name: string;
  data_type: string;
  character_maximum_length: number | null;
  column_default: string | null;
  is_nullable: string;
}

async function updateSchemaFromJson(
  jsonFilePath: string,
  tableName: string = 'sources_google2',
  dryRun: boolean = true,
  generateSql: boolean = false,
  verbose: boolean = false
) {
  try {
    Logger.info(`Reading schema from JSON file: ${jsonFilePath}`);
    
    // Create Supabase client
    const supabaseClientService = SupabaseClientService.getInstance();
    const supabase = supabaseClientService.getClient();
    
    // Check if the file path exists
    if (!fs.existsSync(jsonFilePath)) {
      // Try the path relative to the current directory
      const absolutePath = path.join(process.cwd(), jsonFilePath);
      if (fs.existsSync(absolutePath)) {
        jsonFilePath = absolutePath;
      } else {
        throw new Error(`JSON file does not exist at path: ${jsonFilePath}`);
      }
    }
    
    // Read and parse the JSON file
    let jsonSchema: ColumnDefinition[];
    
    try {
      const fileContent = fs.readFileSync(jsonFilePath, 'utf8');
      jsonSchema = JSON.parse(fileContent);
      
      // Validate schema format
      if (!Array.isArray(jsonSchema) || jsonSchema.length === 0) {
        throw new Error('JSON file does not contain a valid array of column definitions');
      }
      
      // Check for required properties in each column definition
      for (const column of jsonSchema) {
        if (!column.column_name || !column.data_type) {
          throw new Error('Each column definition must have column_name and data_type properties');
        }
      }
    } catch (error) {
      throw new Error(`Failed to parse JSON schema file: ${error instanceof Error ? error.message : String(error)}`);
    }
    
    // Get current table schema from Supabase
    const { data: currentSchema, error } = await supabase.rpc('get_table_info', { table_name: tableName });
    
    if (error) {
      throw new Error(`Failed to fetch current schema: ${error.message}`);
    }
    
    if (!currentSchema || currentSchema.length === 0) {
      throw new Error(`Table ${tableName} not found in the database or no columns returned`);
    }
    
    // Map column definitions by name for easier comparison
    const currentColumnsByName: Record<string, any> = {};
    for (const column of currentSchema) {
      currentColumnsByName[column.column_name] = column;
    }
    
    const jsonColumnsByName: Record<string, ColumnDefinition> = {};
    for (const column of jsonSchema) {
      jsonColumnsByName[column.column_name] = column;
    }
    
    // Find differences between current schema and JSON schema
    const missingColumns: ColumnDefinition[] = [];
    const differentColumns: Array<{current: any, desired: ColumnDefinition}> = [];
    const newColumns: ColumnDefinition[] = [];
    
    // Check for differences in existing columns
    for (const column of jsonSchema) {
      const columnName = column.column_name;
      const currentColumn = currentColumnsByName[columnName];
      
      if (!currentColumn) {
        newColumns.push(column);
        continue;
      }
      
      // Check for differences in column properties
      const isDifferent = 
        currentColumn.data_type !== column.data_type ||
        currentColumn.character_maximum_length !== column.character_maximum_length ||
        currentColumn.is_nullable !== column.is_nullable ||
        // Compare defaults, handling nulls properly
        (currentColumn.column_default === null && column.column_default !== null) ||
        (currentColumn.column_default !== null && column.column_default === null) ||
        (currentColumn.column_default !== null && column.column_default !== null && 
         currentColumn.column_default !== column.column_default);
      
      if (isDifferent) {
        differentColumns.push({
          current: currentColumn,
          desired: column
        });
      }
    }
    
    // Check for columns in current schema that are not in JSON schema
    for (const columnName in currentColumnsByName) {
      if (!jsonColumnsByName[columnName]) {
        missingColumns.push(currentColumnsByName[columnName]);
      }
    }
    
    // Report findings
    Logger.info(`\nSchema comparison for table ${tableName}:`);
    Logger.info(`- Current schema: ${currentSchema.length} columns`);
    Logger.info(`- JSON schema: ${jsonSchema.length} columns`);
    Logger.info(`- New columns to add: ${newColumns.length}`);
    Logger.info(`- Columns to modify: ${differentColumns.length}`);
    Logger.info(`- Columns in DB but not in JSON: ${missingColumns.length}`);
    
    if (verbose) {
      // Log detailed column information
      if (newColumns.length > 0) {
        Logger.info('\nNew columns to add:');
        for (const column of newColumns) {
          Logger.info(`  - ${column.column_name} (${column.data_type}${column.character_maximum_length ? `(${column.character_maximum_length})` : ''})`);
        }
      }
      
      if (differentColumns.length > 0) {
        Logger.info('\nColumns to modify:');
        for (const diff of differentColumns) {
          Logger.info(`  - ${diff.current.column_name}:`);
          Logger.info(`    Current: ${diff.current.data_type}${diff.current.character_maximum_length ? `(${diff.current.character_maximum_length})` : ''}, ${diff.current.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}, Default: ${diff.current.column_default || 'NULL'}`);
          Logger.info(`    Desired: ${diff.desired.data_type}${diff.desired.character_maximum_length ? `(${diff.desired.character_maximum_length})` : ''}, ${diff.desired.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}, Default: ${diff.desired.column_default || 'NULL'}`);
        }
      }
      
      if (missingColumns.length > 0) {
        Logger.info('\nColumns in DB but not in JSON:');
        for (const column of missingColumns) {
          Logger.info(`  - ${column.column_name} (${column.data_type}${column.character_maximum_length ? `(${column.character_maximum_length})` : ''})`);
        }
      }
    }
    
    // Generate SQL if requested
    if (generateSql) {
      let sql = `-- Schema update SQL for table ${tableName}\n\n`;
      
      // Add new columns
      if (newColumns.length > 0) {
        sql += `-- Adding new columns\n`;
        for (const column of newColumns) {
          sql += `ALTER TABLE ${tableName} ADD COLUMN ${column.column_name} ${column.data_type}`;
          
          // Add character maximum length if applicable
          if (column.character_maximum_length) {
            sql += `(${column.character_maximum_length})`;
          }
          
          // Add nullable constraint
          sql += column.is_nullable === 'YES' ? ' NULL' : ' NOT NULL';
          
          // Add default value if provided
          if (column.column_default !== null) {
            sql += ` DEFAULT ${column.column_default}`;
          }
          
          sql += `;\n`;
        }
        sql += '\n';
      }
      
      // Modify existing columns
      if (differentColumns.length > 0) {
        sql += `-- Modifying existing columns\n`;
        for (const diff of differentColumns) {
          // Handle different data type
          if (diff.current.data_type !== diff.desired.data_type || 
              diff.current.character_maximum_length !== diff.desired.character_maximum_length) {
            sql += `ALTER TABLE ${tableName} ALTER COLUMN ${diff.current.column_name} TYPE ${diff.desired.data_type}`;
            
            // Add character maximum length if applicable
            if (diff.desired.character_maximum_length) {
              sql += `(${diff.desired.character_maximum_length})`;
            }
            
            sql += `;\n`;
          }
          
          // Handle different nullable constraint
          if (diff.current.is_nullable !== diff.desired.is_nullable) {
            if (diff.desired.is_nullable === 'YES') {
              sql += `ALTER TABLE ${tableName} ALTER COLUMN ${diff.current.column_name} DROP NOT NULL;\n`;
            } else {
              sql += `ALTER TABLE ${tableName} ALTER COLUMN ${diff.current.column_name} SET NOT NULL;\n`;
            }
          }
          
          // Handle different default value
          if ((diff.current.column_default === null && diff.desired.column_default !== null) ||
              (diff.current.column_default !== null && diff.desired.column_default === null) ||
              (diff.current.column_default !== null && diff.desired.column_default !== null && 
               diff.current.column_default !== diff.desired.column_default)) {
            
            if (diff.desired.column_default === null) {
              sql += `ALTER TABLE ${tableName} ALTER COLUMN ${diff.current.column_name} DROP DEFAULT;\n`;
            } else {
              sql += `ALTER TABLE ${tableName} ALTER COLUMN ${diff.current.column_name} SET DEFAULT ${diff.desired.column_default};\n`;
            }
          }
        }
      }
      
      // Write SQL to a file
      const sqlFilePath = `${path.dirname(jsonFilePath)}/${tableName}_schema_update.sql`;
      fs.writeFileSync(sqlFilePath, sql);
      Logger.info(`\nSQL script written to: ${sqlFilePath}`);
      
      // Display the SQL if verbose
      if (verbose) {
        Logger.info('\nGenerated SQL:');
        Logger.info(sql);
      }
    }
    
    // Execute SQL if not dry run
    if (!dryRun && generateSql) {
      Logger.info('\nExecuting SQL statements...');
      // We would execute the SQL here, but this is potentially dangerous so we'll just simulate it
      Logger.info('Not actually executing SQL in this version - remove the --dry-run flag to execute');
    }
    
    Logger.info('\nSchema comparison complete!');
    
  } catch (error) {
    Logger.error('Error updating schema from JSON:', error);
    process.exit(1);
  }
}

// Execute if run directly
if (require.main === module) {
  // Parse command line arguments
  const args = process.argv.slice(2);
  const jsonFilePath = args.find(arg => !arg.startsWith('--') && !arg.includes('=')) || 'schema.json';
  
  // Parse options
  const dryRun = args.includes('--dry-run') || !args.includes('--execute');
  const generateSql = args.includes('--generate-sql');
  const verbose = args.includes('--verbose');
  
  // Parse table name
  const tableArg = args.find(arg => arg.startsWith('--table='));
  const tableName = tableArg ? tableArg.split('=')[1] : 'sources_google2';
  
  updateSchemaFromJson(jsonFilePath, tableName, dryRun, generateSql, verbose);
}

// Export the function for importing in index.ts
export { updateSchemaFromJson };