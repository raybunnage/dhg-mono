# Code Dashboard Documentation

## Overview
The Code Dashboard is a comprehensive tool for managing, organizing, and analyzing the application's codebase. It provides insights into functions, pages, refactoring opportunities, and overall code structure, helping developers maintain code quality and understand the system architecture.

## Key Features

### Code Organization
- View and manage registered functions
- Browse application pages and their components
- Explore refactoring candidates
- Understand application structure and architecture
- Analyze function usage across the application

### Function Registry
- Browse functions by category
- Search for specific functions
- View function metadata (description, location, dependencies)
- Track function usage across pages
- Identify refactoring opportunities

### Page Management
- Overview of all application pages
- View component information for each page
- Track functions used by each page
- View file locations and dependencies

### Code Analysis
- Function registry analyzer for code files
- Refactoring candidates identification
- Code structure visualization
- Function distribution by category

### Guts Dashboard
- Internal page tracking system
- Database table usage tracking
- Function usage tracking
- Dependency monitoring

## Technical Components

### Registry System
- `functionRegistry`: Core registry for tracking functions
- Function metadata storage (description, category, location)
- Dependency tracking between functions
- Usage tracking across pages

### Dashboard Interface
- Overview statistics and quick actions
- Category-based filtering
- Search functionality for functions and pages
- Tabbed interface for different aspects of code management

### GutsTracker
- Automated usage tracking system
- Table usage monitoring
- Function call tracking
- Integration with Supabase for persistent storage

### Code Analysis Utilities
- Category-based function classification
- Refactoring candidate identification
- Structure analysis and visualization
- Dependency mapping

## UI Components
The dashboard is built using several reusable components:

### Navigation
- `Tabs`: Main navigation for different dashboard sections
- `Card`: Container for each functional section
- `TabsList` and `TabsTrigger`: Tab navigation controls

### Data Display
- `Table`: Structured display of page and function information
- `Badge`: Visual indicators for categories and status
- Various chart components for statistics visualization
- Scroll areas for handling large data sets

### Interactive Elements
- Search inputs for filtering
- Category selectors for classification
- Action buttons for code management
- Status indicators for processes

## Data Models

### Function Information
- Function name and description
- Category classification
- Location in the codebase
- Dependencies and usage information
- Status (active, deprecated, etc.)

### Page Metadata
- Page name and route path
- Component information
- File location
- Functions used by the page
- Description and purpose

## Implementation Notes

### State Management
- Uses React state hooks for local data management
- Component-specific states for different dashboard sections
- Loading and error states for asynchronous operations

### Database Integration
- Supabase for persistent storage of registry data
- GutsTracker integration for usage statistics
- RPC calls for specialized database operations

### Performance Considerations
- Lazy loading for heavyweight components
- Caching of registry data
- Pagination for large data sets
- Selective rendering based on active tab

## Usage Workflows

### Function Registration
1. Browse to the Analyze tab
2. Upload or select a code file
3. Analyze the file to identify functions
4. Register functions with appropriate metadata

### Code Organization Analysis
1. View the Overview tab for high-level statistics
2. Navigate to Organization tab for structure visualization
3. Explore function distribution by category
4. Identify areas for improvement

### Refactoring Planning
1. Navigate to the Refactoring tab
2. View candidates based on usage patterns
3. Analyze function dependencies
4. Plan refactoring based on usage and dependencies

### Page Analysis
1. Browse to the Pages tab
2. Search for specific pages
3. View component and file information
4. Analyze function usage within pages