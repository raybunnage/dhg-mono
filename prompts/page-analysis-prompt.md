


I've created three detailed documentation files for the
  Home, Viewer, and Viewer2 pages from the application. Each
  document follows the requested format and includes:

  1. Basic information about the file path, components, and
  routes
  2. Code quality assessment with strengths, areas for
  improvement, and maintainability/readability scores
  3. Size and complexity analysis with refactoring
  recommendations
  4. Integration with shared services and recommendations for
  new services
  5. Function and dependency analysis
  6. Special UI implementations with educational code examples
  7. Additional insights on performance, accessibility, state
  management, security, and browser compatibility

  The documentation provides a comprehensive overview of each
  page, highlighting both technical aspects and potential
  improvements. The maintainability scores range from 2-4 out
  of 5, with Viewer2 being the most complex and least
  maintainable component.

# Page Analysis Documentation Prompt

## Task Overview
Analyze each page in the apps/dhg-improve-experts application to create comprehensive markdown documentation. Start by examining the src/pages directory, but also look for page components that might be elsewhere in the codebase. Use the MainNavbar.tsx component (at apps/dhg-improve-experts/src/components/MainNavbar.tsx) as a guide to identify all routes that represent pages in the application.

## For Each Page, Create Documentation That Includes:

### 1. Basic Information
- Page name and purpose
- File path
- Primary components used
- Routes that lead to this page

### 2. Code Quality Assessment
- Strengths of the implementation (clear organization, reusable patterns, etc.)
- Areas for improvement (complexity issues, confusing patterns, etc.)
- Code maintainability score (1-5) with justification
- Code readability score (1-5) with justification

### 3. Size and Complexity Analysis
- Total lines of code
- Component breakdown (number of sub-components)
- Complexity assessment (identify particularly complex sections)
- Specific refactoring recommendations, including:
  - Components that could be broken down
  - Logic that could be extracted to hooks or utilities
  - Redundant code that could be consolidated

### 4. Integration with Shared Services
- Identify functionality that could leverage existing packages/cli services
- Recommend specific services from packages/cli that could be used
- Suggest new services that could be created to handle common patterns
- Outline how the page could be refactored to use these services instead of custom code

### 5. Function and Dependency Analysis
- List all named functions with brief descriptions of their purpose
- Document all external dependencies and libraries used
- Detail integration points with other parts of the application
- Identify any API calls or data fetching logic

### 6. Special UI Implementations
- Document unique or educational UI patterns
- Highlight reusable UI components or patterns that could be used elsewhere
- Explain any complex UI interactions or state management approaches
- Provide code snippets of particularly clever or useful implementations

### 7. Additional Insights
- Performance considerations
- Accessibility review
- State management approach
- Any potential bugs or edge cases
- Security considerations
- Browser compatibility notes

## Documentation Format

For each page, generate a markdown file named `[PageName]-documentation.md` with the following structure:

```markdown
# [Page Name] Documentation

## Overview
Brief description of the page's purpose and functionality.

## Basic Information
- **File Path:** src/path/to/file.tsx
- **Primary Components:** ComponentA, ComponentB, etc.
- **Routes:** /route1, /route2, etc.

## Code Quality Assessment
### Strengths
- Point 1
- Point 2

### Areas for Improvement
- Point 1
- Point 2

### Scores
- **Maintainability:** X/5 - Justification
- **Readability:** X/5 - Justification

## Size and Complexity
- **Lines of Code:** X
- **Component Breakdown:** X components
- **Complexity Assessment:** Description of complexity

### Refactoring Recommendations
Detailed recommendations for refactoring the page...

## Integration with Shared Services
### Existing Services That Could Be Leveraged
- Service 1: How it could be used
- Service 2: How it could be used

### Recommended New Services
- Proposed Service 1: Purpose and implementation details
- Proposed Service 2: Purpose and implementation details

## Function and Dependency Analysis
### Key Functions
- `functionName()`: Purpose and description
- `anotherFunction()`: Purpose and description

### Dependencies
- Library 1: Purpose
- Library 2: Purpose

### Integration Points
Description of how this page integrates with other parts of the app...

## Special UI Implementations
### Reusable Patterns
Description of UI patterns that could be reused elsewhere...

### Educational Code Examples
```tsx
// Code snippet with explanation
```

## Additional Insights
Any other important information about the page...
```

## Example Documentation (Partial)
To illustrate the expected output, here's a simplified example:

```markdown
# Dashboard Documentation

## Overview
The Dashboard page serves as the main landing page after login, displaying key metrics and navigation options for the application.

## Basic Information
- **File Path:** src/pages/Dashboard/index.tsx
- **Primary Components:** MetricsPanel, ActivityFeed, QuickActions
- **Routes:** /dashboard, /home

## Code Quality Assessment
### Strengths
- Clean separation of concerns between data fetching and presentation
- Consistent error handling throughout the component
- Good use of custom hooks for shared logic

### Areas for Improvement
- Excessive inline styles instead of using the styling system
- Some prop drilling through multiple component levels
- Large useEffect blocks with multiple responsibilities

## Integration with Shared Services
### Existing Services That Could Be Leveraged
- `dataFetchingService` from packages/cli could replace the custom fetch logic in lines 45-67
- `metricCalculation` utilities could be used instead of the calculations in the MetricsCalculator component

...
```

Analyze all pages systematically and create individual documentation files for each one.
