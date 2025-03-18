# Guts Dashboard Implementation

## Overview

The Guts Dashboard is a feature that provides insights into the internal workings of application pages. It displays information about:

- Supabase tables used by each page
- Functions utilized, including their storage locations
- Information on whether functions involve React, use AI prompts, and are candidates for refactoring
- External dependencies related to the page (e.g., Google Drive, AI functions)

## Implementation Details

### Database Structure

The implementation includes the following database tables:

1. `app_pages`: Tracks pages/dashboards in the application
2. `page_table_usage`: Tracks which Supabase tables are used by which pages
3. `page_function_usage`: Tracks which functions are used by which pages
4. `page_dependencies`: Tracks external dependencies of pages

Additionally, the existing `function_registry` table has been extended with new columns to track:
- Whether functions use React
- Whether functions use AI prompts
- Whether functions are candidates for refactoring
- Function specificity level

### Components and Utilities

The implementation includes:

1. **GutsTab Component** (`apps/dhg-improve-experts/src/components/GutsTab.tsx`):
   - Displays the "guts" information for a specific page
   - Fetches data from the database and renders it in a user-friendly format
   - Provides a refresh button to update the displayed information

2. **GutsTracker Utility** (`apps/dhg-improve-experts/src/utils/gutsTracker.ts`):
   - Automatically tracks table usage, function usage, and dependencies
   - Uses batching and debouncing to optimize database operations
   - Provides decorators for tracking function and dependency usage

3. **Example Page** (`apps/dhg-improve-experts/src/pages/GutsExample.tsx`):
   - Demonstrates how to use the Guts dashboard features
   - Shows how to initialize the tracker and use the decorators
   - Includes a live Guts dashboard display

### Documentation

Detailed documentation is available in:

- `apps/dhg-improve-experts/docs/guts-dashboard.md`: Comprehensive guide to using the Guts dashboard
- This README file: Overview of the implementation

## Hybrid Approach

The implementation uses a hybrid approach:

1. **Database-side**:
   - Core tables and basic functions for data storage and retrieval
   - Simple aggregation functions for basic data access

2. **Application-side**:
   - Complex data processing and transformation
   - Batching and debouncing for optimized performance
   - UI rendering and user interaction

This hybrid approach provides:
- Efficient data storage and retrieval
- Reduced network traffic through batching
- Flexible UI rendering
- Improved maintainability

## Files Created/Modified

### Database
- `supabase/migrations/20250301000004_add_guts_dashboard_tables.sql`: Up migration
- `supabase/migrations/20250301000004_add_guts_dashboard_tables_down.sql`: Down migration

### Components
- `apps/dhg-improve-experts/src/components/GutsTab.tsx`: Main component for displaying guts information

### Utilities
- `apps/dhg-improve-experts/src/utils/gutsTracker.ts`: Utility for tracking page usage

### Example and Documentation
- `apps/dhg-improve-experts/src/pages/GutsExample.tsx`: Example page demonstrating the Guts dashboard
- `apps/dhg-improve-experts/docs/guts-dashboard.md`: Comprehensive documentation
- `apps/dhg-improve-experts/README-guts-dashboard.md`: This overview file

### Scripts
- `apps/dhg-improve-experts/apply_guts_migrations.sh`: Script to apply the migrations

## Getting Started

1. Apply the database migrations:
   ```bash
   cd apps/dhg-improve-experts
   ./apply_guts_migrations.sh
   ```

2. Visit the example page to see the Guts dashboard in action:
   ```
   http://localhost:3000/guts-example
   ```

3. Integrate the Guts dashboard into your own pages:
   ```tsx
   import { GutsTab } from '@/components/GutsTab';
   import { GutsTracker } from '@/utils/gutsTracker';

   // Initialize tracker in your component
   useEffect(() => {
     GutsTracker.init('/your-page-path', 'dhg-improve-experts');
     return () => GutsTracker.cleanup();
   }, []);

   // Add the GutsTab component to your page
   <GutsTab pagePath="/your-page-path" appName="dhg-improve-experts" />
   ```

## Future Enhancements

Potential future enhancements include:

1. Visual representation of relationships between pages, functions, and tables
2. Performance metrics for functions and database operations
3. Automated suggestions for refactoring opportunities
4. Integration with code analysis tools for deeper insights
5. Historical tracking of changes over time 