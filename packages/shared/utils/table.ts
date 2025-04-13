/**
 * Utility functions for creating formatted tables
 */

/**
 * Create a formatted table from an array of objects
 * @param data Array of objects to format as a table
 * @returns Formatted table string
 */
export function createTable(data: Record<string, any>[]): string {
  if (!data || data.length === 0) {
    return 'No data to display';
  }

  // Extract all unique keys from all objects
  const keys = Array.from(
    new Set(data.flatMap(item => Object.keys(item)))
  );

  // Find the maximum width needed for each column
  const columnWidths: Record<string, number> = {};
  keys.forEach(key => {
    // Start with the header width
    columnWidths[key] = key.length;
    
    // Check each row's value width
    data.forEach(row => {
      if (row[key] !== undefined && row[key] !== null) {
        const valueStr = String(row[key]);
        columnWidths[key] = Math.max(columnWidths[key], valueStr.length);
      }
    });
  });

  // Create header row
  let table = '| ';
  keys.forEach(key => {
    table += key.padEnd(columnWidths[key]) + ' | ';
  });
  table += '\n';

  // Create separator row
  table += '| ';
  keys.forEach(key => {
    table += '-'.repeat(columnWidths[key]) + ' | ';
  });
  table += '\n';

  // Create data rows
  data.forEach(row => {
    table += '| ';
    keys.forEach(key => {
      const value = row[key] !== undefined && row[key] !== null ? String(row[key]) : '';
      table += value.padEnd(columnWidths[key]) + ' | ';
    });
    table += '\n';
  });

  return table;
}