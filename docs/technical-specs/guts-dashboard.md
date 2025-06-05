# Guts Dashboard Documentation

## Overview

The Guts Dashboard is a feature that provides insights into the internal workings of your application pages. It displays information about:

- Supabase tables used by each page
- Functions utilized, including their storage locations
- Information on whether functions involve React, use AI prompts, and are candidates for refactoring
- External dependencies related to the page (e.g., Google Drive, AI functions)

## Database Structure

The Guts Dashboard relies on the following database tables:

1. `app_pages`: Tracks pages/dashboards in the application
2. `page_table_usage`: Tracks which Supabase tables are used by which pages
3. `page_function_usage`: Tracks which functions are used by which pages
4. `page_dependencies`: Tracks external dependencies of pages

Additionally, the existing `function_registry` table has been extended with new columns to track:
- Whether functions use React
- Whether functions use AI prompts
- Whether functions are candidates for refactoring
- Function specificity level

## Setup and Installation

### Applying Migrations

To set up the Guts Dashboard, you need to apply the database migrations:

```bash
# Navigate to the app directory
cd apps/dhg-improve-experts

# Run the migration script
./apply_guts_migrations.sh
```

Alternatively, you can apply the migrations manually:

```bash
# From the repository root
pnpm supabase migration up 20250301000004_add_guts_dashboard_tables.sql
```

## Using the GutsTab Component

The `GutsTab` component can be added to any page to display its "guts" information:

```tsx
import { GutsTab } from '@/components/GutsTab';

function YourPage() {
  return (
    <div>
      {/* Your page content */}
      
      {/* Add the GutsTab component */}
      <GutsTab 
        pagePath="/your-page-path" 
        appName="dhg-improve-experts" 
      />
    </div>
  );
}
```

### Props

- `pagePath` (string): The path of the current page
- `appName` (string): The name of the application

## Automatic Tracking with GutsTracker

The `GutsTracker` utility automatically tracks table usage, function usage, and dependencies:

### Initializing the Tracker

```tsx
import { GutsTracker } from '@/utils/gutsTracker';

// Initialize in a component
useEffect(() => {
  GutsTracker.init('/your-page-path', 'dhg-improve-experts');
  
  return () => {
    GutsTracker.cleanup();
  };
}, []);
```

### Tracking Table Usage

```tsx
// Automatically tracked when using the tracked Supabase client
import { useTrackedSupabase } from '@/utils/gutsTracker';

function YourComponent() {
  const supabase = useTrackedSupabase();
  
  async function fetchData() {
    const { data } = await supabase.from('your_table').select('*');
    // Table usage is automatically tracked
  }
}
```

### Tracking Function Usage

Use the `trackFunction` decorator:

```tsx
import { trackFunction } from '@/utils/gutsTracker';

class YourService {
  @trackFunction('YourService.processData')
  static async processData(input: string) {
    // Function implementation
    return result;
  }
}
```

### Tracking Dependencies

Use the `trackDependency` decorator:

```tsx
import { trackDependency } from '@/utils/gutsTracker';

class GoogleDriveService {
  @trackDependency('google-drive', 'File Upload')
  static async uploadFile(file: File) {
    // Implementation
    return uploadResult;
  }
}
```

## Implementation Approaches

The Guts Dashboard uses a hybrid approach:

1. **Database-side**: Core tables and basic functions for data storage and retrieval
2. **Application-side**: Complex data processing, batching, and UI rendering

This hybrid approach provides:
- Efficient data storage and retrieval
- Reduced network traffic through batching
- Flexible UI rendering
- Improved maintainability

## Troubleshooting

If you encounter issues with the Guts Dashboard:

1. Verify that migrations have been applied correctly
2. Check that the `GutsTracker` is properly initialized on your page
3. Ensure that the `pagePath` and `appName` props match your actual page path and application name
4. Check the browser console for any errors related to the Guts Dashboard components

## Extending the Guts Dashboard

To add new tracking capabilities:

1. Update the database schema if needed
2. Extend the `GutsTracker` utility with new tracking methods
3. Update the `GutsTab` component to display the new information

## Reverting Changes

If needed, you can revert the Guts Dashboard changes by applying the down migration:

```bash
# From the repository root
pnpm supabase migration down 20250301000004_add_guts_dashboard_tables_down.sql
``` 