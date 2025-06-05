// Simple test for verifying table output works
import Table from 'cli-table3';

async function main() {
  console.log("=== STARTING SIMPLE TABLE TEST ===");
  
  // Create a simple table
  const table = new Table({
    head: ['Column 1', 'Column 2', 'Column 3'],
    colWidths: [20, 20, 20]
  });
  
  // Add some rows
  table.push(
    ['Value 1', 'Value 2', 'Value 3'],
    ['Row 2 Col 1', 'Row 2 Col 2', 'Row 2 Col 3'],
    ['Row 3 Col 1', 'Row 3 Col 2', 'Row 3 Col 3']
  );
  
  // Output using different methods
  console.log("METHOD 1: Console.log table object:");
  console.log(table);
  
  console.log("\nMETHOD 2: Console.log table.toString():");
  console.log(table.toString());
  
  console.log("\nMETHOD 3: process.stdout.write:");
  process.stdout.write(table.toString() + "\n");
  
  // Using setTimeout to ensure output is flushed
  setTimeout(() => {
    console.log("\n=== END OF SIMPLE TABLE TEST ===");
  }, 100);
}

main();