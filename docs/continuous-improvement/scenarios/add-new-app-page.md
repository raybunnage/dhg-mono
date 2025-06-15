# Continuous Improvement Scenario: Add New App Page

## Scenario ID: `add-new-app-page`
**Category**: UI Development
**Complexity**: Medium
**Estimated Time**: 30-45 minutes
**Last Updated**: 2025-06-15

## Overview
This scenario covers adding a new page to an existing React app, including routing, components, services integration, and navigation updates.

## Prerequisites
- Understanding of React and TypeScript
- Familiarity with the app's routing system
- Knowledge of shared components and services

## When to Use
- Adding new features that require dedicated pages
- Creating admin interfaces for data management
- Building new user-facing functionality
- Implementing dashboard or reporting pages

## Step-by-Step Process

### 1. Analyze App Structure
**Check these files first**:
```bash
# Router configuration
apps/{app-name}/src/App.tsx
apps/{app-name}/src/router.tsx

# Navigation/menu
apps/{app-name}/src/components/Navigation.tsx
apps/{app-name}/src/components/Sidebar.tsx

# Existing pages for patterns
apps/{app-name}/src/pages/
```

### 2. Create Page Component
**File**: `apps/{app-name}/src/pages/{PageName}.tsx`

**Template**:
```typescript
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { {Service}Service } from '@shared/services/{service}';

interface {PageName}Props {
  // Props if needed
}

export default function {PageName}({ }: {PageName}Props) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch data using service or direct Supabase
      const service = new {Service}Service(supabase);
      const result = await service.getData();
      
      setData(result);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">
          Error: {error}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">{Page Title}</h1>
        <p className="text-gray-600">Page description</p>
      </div>

      {/* Page content */}
      <div className="bg-white rounded-lg shadow p-6">
        {/* Your content here */}
      </div>
    </div>
  );
}
```

### 3. Add Route
**File**: `apps/{app-name}/src/App.tsx` or `router.tsx`

```typescript
import {PageName} from './pages/{PageName}';

// In Routes/Router configuration
<Route path="/{page-path}" element={<{PageName} />} />
```

### 4. Update Navigation
**Find and update the navigation component**:

```typescript
// In navigation items array
{
  name: '{Page Name}',
  path: '/{page-path}',
  icon: IconComponent, // If using icons
}

// Or in JSX
<Link to="/{page-path}" className="nav-link">
  {Page Name}
</Link>
```

### 5. Create Sub-components (if needed)
**Location**: `apps/{app-name}/src/components/{PageName}/`

Common sub-components:
- `{PageName}List.tsx` - List/table view
- `{PageName}Form.tsx` - Create/edit form
- `{PageName}Details.tsx` - Detail view
- `{PageName}Filters.tsx` - Search/filter controls

### 6. Integrate Shared Services
**If using shared services**:
```typescript
// For infrastructure services (singleton)
import { serviceInstance } from '@shared/services/{service}';

// For business services (DI)
import { {Service}Service } from '@shared/services/{service}';
const service = new {Service}Service(supabase);
```

### 7. Add State Management (if complex)
**For complex state, consider**:
- React Context for page-specific state
- Zustand for app-wide state
- Custom hooks for reusable logic

**Custom Hook Example**:
```typescript
// hooks/use{PageName}.ts
export function use{PageName}() {
  const [state, setState] = useState();
  
  // Custom logic
  
  return {
    state,
    actions: {
      // Action methods
    }
  };
}
```

### 8. Style the Page
**Use existing patterns**:
- Check app's CSS framework (Tailwind, MUI, etc.)
- Follow existing component patterns
- Ensure responsive design
- Match app's theme/design system

### 9. Add Loading & Error States
**Essential states to handle**:
- Loading state during data fetch
- Error state with retry option
- Empty state when no data
- Success feedback for actions

### 10. Test the Page
**Testing checklist**:
1. Navigation works from menu/links
2. Direct URL access works
3. Data loads correctly
4. Error handling works
5. Responsive on mobile
6. Keyboard navigation
7. Back/forward browser buttons

## Validation Checklist
- [ ] Page component created with proper TypeScript types
- [ ] Route added to router configuration
- [ ] Navigation updated with new link
- [ ] Loading and error states implemented
- [ ] Responsive design tested
- [ ] Services integrated properly
- [ ] No hardcoded values
- [ ] Follows app's coding patterns
- [ ] Browser console has no errors
- [ ] Page title updates correctly

## Common Issues
- **Routing not working**: Check exact path match, route order
- **Import errors**: Ensure proper path aliases (@shared, etc.)
- **Style conflicts**: Use scoped CSS or follow naming conventions
- **State not updating**: Check React hooks dependencies
- **Services not working**: Verify Supabase client initialization

## Patterns by App Type

### Admin Apps
- Include breadcrumbs
- Add action buttons (Create, Edit, Delete)
- Implement filters and search
- Show data tables with pagination

### User-Facing Apps
- Focus on UX and loading states
- Implement proper error boundaries
- Add analytics tracking
- Consider SEO (if applicable)

### Dashboard Apps
- Use data visualization components
- Implement auto-refresh for real-time data
- Add export functionality
- Create summary cards

## Related Scenarios
- `add-new-shared-service` - If page needs new service
- `modify-database-tables` - If page needs new data
- `add-new-tests` - For page testing
- `add-new-proxy-server` - If page needs backend proxy

## Automation Notes
When automated, this scenario should:
- Generate page component from template
- Auto-add route based on page name
- Update navigation if structure is standard
- Create placeholder sub-components
- Add basic tests
- Run build to verify no errors