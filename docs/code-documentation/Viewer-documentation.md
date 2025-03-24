# Viewer Documentation

## Overview
The Viewer page provides a file browsing interface for Google Drive content, displaying files in a hierarchical tree structure while allowing users to select and view file details. It includes functionality to repair file path relationships in the database and debug file hierarchies.

## Basic Information
- **File Path:** src/pages/Viewer.tsx
- **Primary Components:** FileTree, FileViewer
- **Routes:** /viewer

## Code Quality Assessment
### Strengths
- Comprehensive file browsing functionality with detailed debugging features
- Good error handling for database operations
- Clear separation between UI rendering and data operations
- Effective use of states to manage UI interactions
- Detailed logging for troubleshooting hierarchy issues

### Areas for Improvement
- Excessive inline debugging code that should be moved to utilities
- The "repairChildrenPaths" function is too complex (over 150 lines) and should be refactored
- Multiple data fetching and processing functions could be extracted to custom hooks
- Some UI elements could be extracted into reusable components
- Limited comments explaining complex logic, especially around path repair

### Scores
- **Maintainability:** 3/5 - The code implements complex functionality but would benefit from significant refactoring to improve organization and reduce function sizes
- **Readability:** 3/5 - While variable naming is good, the large function sizes and nested complexity reduce overall readability

## Size and Complexity
- **Lines of Code:** 439
- **Component Breakdown:** 1 main component with embedded rendering logic
- **Complexity Assessment:** High complexity. The component handles multiple concerns including data fetching, relationship analysis, emergency repair functions, and UI rendering.

### Refactoring Recommendations
- Extract the `repairChildrenPaths` function to a dedicated utility or service
- Move the `analyzeFileRelationships` debugging function to a separate utility file
- Create custom hooks for data fetching operations (e.g., `useFileData`)
- Split the main component into smaller, focused components for different sections
- Extract the debug information panel to a reusable component
- Add comprehensive comments explaining the path repair algorithm

## Integration with Shared Services
### Existing Services That Could Be Leveraged
- `supabase/client` - Already in use but could be wrapped in a dedicated service
- The code could use the `googleDriveService` functions seen in Viewer2 instead of implementing similar functionality directly

### Recommended New Services
- **FilePathService**: A service to handle file path repair and validation operations
- **FileHierarchyService**: A dedicated service for handling parent-child relationships in the file system
- **FileTreeAnalysisService**: A utility service for analyzing and debugging file hierarchies
- **GoogleDriveMetadataService**: A service to standardize interactions with Google Drive metadata

## Function and Dependency Analysis
### Key Functions
- `Viewer()`: Main component function
- `fetchFiles()`: Fetches file data from Supabase
- `repairChildrenPaths()`: Fixes file path issues in the database
- `analyzeFileRelationships()`: Analyzes and logs file relationship statistics
- `handleFileSelect()`: Manages file selection in the UI
- `handleFileClick()`: Handles file click events

### Dependencies
- `react`: Core UI library
- `react-hot-toast`: Toast notifications
- `react-router-dom`: Routing and URL parameter handling
- `@/integrations/supabase/client`: Supabase database client
- `@/components/FileTree`: Custom component for displaying file hierarchy
- `@/components/FileViewer`: Component for viewing file content

### Integration Points
- Integrates with Supabase `sources_google` table for file metadata
- Connected to FileTree component for displaying hierarchical file data
- Uses FileViewer component to display file content
- Interacts with the URL via searchParams for maintaining selected file state

## Special UI Implementations
### Reusable Patterns
- **Hierarchical File Navigation**: Implements a tree-based navigation for browsing files
- **Diagnostic Information Display**: Shows detailed debugging information about file relationships
- **Repair Functionality**: UI for triggering and monitoring database repair operations
- **Statistics Badges**: Compact display of file system statistics

### Educational Code Examples
```tsx
// Relationship analysis debugging function
const analyzeFileRelationships = () => {
  // Count files with each parent_path
  const parentPathCounts = files.reduce((acc, file) => {
    if (file.parent_path) {
      acc[file.parent_path] = (acc[file.parent_path] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);
  
  // Count files with each parent_folder_id
  const parentFolderIdCounts = files.reduce((acc, file) => {
    if (file.parent_folder_id) {
      acc[file.parent_folder_id] = (acc[file.parent_folder_id] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);
  
  // Check for folders that have a path but no children
  const foldersWithoutChildren = files.filter(file => 
    file.mime_type === 'application/vnd.google-apps.folder' && 
    file.path &&
    !files.some(child => child.parent_path === file.path)
  );
  
  // Check for files that have parent_path but the parent path doesn't exist
  const orphanedFiles = files.filter(file => 
    file.parent_path && 
    !files.some(parent => parent.path === file.parent_path)
  );
  
  console.log('File relationship analysis:', {
    totalFiles: files.length,
    rootFolders: rootFolderCount,
    filesWithParentPath: files.filter(f => f.parent_path).length,
    filesWithParentFolderId: files.filter(f => f.parent_folder_id).length,
    topParentPaths: Object.entries(parentPathCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5),
    topParentFolderIds: Object.entries(parentFolderIdCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5),
    foldersWithoutChildren: foldersWithoutChildren.length,
    orphanedFiles: orphanedFiles.length
  });
};
```

## Additional Insights
### Performance Considerations
- The page loads all file metadata at once, which could cause performance issues with large file libraries
- Complex relationship analysis could be computationally expensive with large datasets
- Path repair operations are performed sequentially, potentially causing UI freezing

### Accessibility
- Limited keyboard navigation support in the file tree
- Error messages lack ARIA attributes for screen readers
- Debug buttons don't provide sufficient context for assistive technologies

### State Management
- Uses React's useState hooks for local state management
- URL parameters are used to persist selected file state
- No global state management for sharing file data across components

### Security Considerations
- Includes emergency repair functionality that modifies database records directly
- Detailed error messages might expose implementation details
- No user permission checks before performing database operations

### Browser Compatibility
- No browser-specific code; should work across modern browsers
- Complex DOM manipulations might perform differently across browsers