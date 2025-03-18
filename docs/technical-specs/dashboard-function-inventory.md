### Dashboard Function Inventory Steps

1. **Automated Function Discovery**
   - Create a script to scan your codebase for function definitions
   - Focus on recently added dashboard files first
   - Extract function signatures, comments, and usage patterns

2. **Function Categorization**
   - Group functions by dashboard (sync, classify, transcribe, experts, supabase)
   - Identify common patterns across dashboards
   - Tag functions with appropriate subcategories

3. **Registry Population**
   - Batch insert discovered functions into registry table
   - Include metadata about location, purpose, and dependencies
   - Mark dashboard-specific vs. potentially reusable functions

4. **Documentation Generation**
   - Create markdown documentation from registry data
   - Include usage examples and dependency graphs
   - Maintain in docs/architecture/function-registry.md

### Utility Function Refactoring Plan

1. **Identify Refactoring Candidates**
   - Functions used across multiple dashboards
   - Functions with similar purposes but different implementations
   - Core functionality that could be generalized

2. **Common Utility Categories**
   - **File Operations**: Reading, writing, format conversion
   - **Google Drive Integration**: Authentication, file access, metadata
   - **Database Operations**: Common queries, data transformations
   - **AI Processing**: Prompt management, response handling
   - **Batch Processing**: Queue management, status tracking
   - **UI Components**: Shared dashboard elements, status indicators

3. **Refactoring Implementation**
   - Create dedicated utility directories for each category
   - Implement standardized interfaces for each utility type
   - Add comprehensive tests for utility functions
   - Update registry with new utility functions

### Ongoing Maintenance

1. **Registry Dashboard**
   - Create a simple admin interface to view and manage registry
   - Include function dependency visualization
   - Track usage statistics

2. **CI/CD Integration**
   - Update registry as part of build process
   - Flag potential duplicates or conflicts
   - Generate documentation automatically

3. **Deprecation Process**
   - Mark functions as deprecated before removal
   - Track references to deprecated functions
   - Provide migration paths to new utilities

   ### Example Registry Population Script

```javascript
// function-discovery.js
const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;

// Configuration
const DASHBOARD_DIRS = [
  'src/pages/sync',
  'src/pages/classify',
  'src/pages/transcribe',
  'src/pages/experts',
  'src/pages/supabase'
];

// Function to extract JSDoc comments
function extractJSDocComment(node) {
  if (node.leadingComments) {
    const jsDocComment = node.leadingComments.find(
      comment => comment.type === 'CommentBlock' && comment.value.startsWith('*')
    );
    return jsDocComment ? jsDocComment.value : '';
  }
  return '';
}

// Main discovery function
async function discoverFunctions() {
  const functions = [];
  
  for (const dir of DASHBOARD_DIRS) {
    const files = await findJsFiles(dir);
    
    for (const file of files) {
      const code = fs.readFileSync(file, 'utf-8');
      const ast = parser.parse(code, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript']
      });
      
      traverse(ast, {
        FunctionDeclaration(path) {
          const name = path.node.id.name;
          const comment = extractJSDocComment(path.node);
          const category = getCategoryFromPath(file);
          
          functions.push({
            name,
            description: extractDescriptionFromComment(comment),
            category,
            subcategory: getSubcategoryFromComment(comment),
            location: file,
            is_utility: isUtilityFunction(name, comment),
            status: 'active'
          });
        },
        // Also handle arrow functions, function expressions, etc.
      });
    }
  }
  
  return functions;
}

// Helper functions for categorization
function getCategoryFromPath(filePath) {
  // Extract category from file path
}

function isUtilityFunction(name, comment) {
  // Determine if function is a utility based on name or comments
}

// Output functions to JSON for registry insertion
discoverFunctions().then(functions => {
  fs.writeFileSync('discovered-functions.json', JSON.stringify(functions, null, 2));
  console.log(`Discovered ${functions.length} functions`);
});
```
```

## Next Steps and Recommendations

1. **Start with a pilot area**: Begin with one dashboard (e.g., Sync) to test your registry approach before expanding.

2. **Create utility namespaces**: Organize utilities into logical namespaces (FileUtils, GoogleDriveUtils, etc.) to make imports cleaner.

3. **Implement progressive refactoring**: Don't refactor everything at once. Start with the most commonly used functions.

4. **Document refactoring patterns**: Create a guide for how to properly refactor dashboard-specific functions into utilities.

5. **Consider TypeScript**: If not already using it, TypeScript can help enforce consistent interfaces for your utility functions.

6. **Create testing strategy**: Develop comprehensive tests for utility functions to ensure reliability across all dashboards.

7. **Establish governance**: Create guidelines for when to create new functions vs. using existing utilities.

This approach will help you systematically organize your growing codebase, identify reusable components, and prepare for efficient refactoring while maintaining the functionality of your existing dashboards.