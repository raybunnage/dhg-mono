# Drive Filter Components

Reusable React components for drive filtering functionality across DHG applications.

## Components

### DriveFilterCombobox

The main drive filter component with full functionality including error handling, success messages, and current filter display.

#### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `filterService` | `FilterService` | Required | The FilterService instance to use |
| `className` | `string` | `''` | Optional CSS classes for the container |
| `showSuccessMessages` | `boolean` | `true` | Whether to show success messages |
| `showErrorMessages` | `boolean` | `true` | Whether to show error messages |
| `onFilterChange` | `function` | `undefined` | Callback when filter changes |
| `label` | `string` | `'Active Drive Filter'` | Custom label for the dropdown |
| `showCurrentFilterInfo` | `boolean` | `true` | Whether to show current filter info section |

#### Usage

```typescript
import { DriveFilterCombobox } from '@shared/components/filter';
import { FilterService } from '@shared/services/filter-service';

const MyComponent = () => {
  const filterService = new FilterService(supabaseClient);
  
  const handleFilterChange = (profileId: string | null, profile: FilterProfile | null) => {
    console.log('Filter changed:', { profileId, profile });
    // Refresh your data or update UI
  };

  return (
    <DriveFilterCombobox
      filterService={filterService}
      onFilterChange={handleFilterChange}
      className="my-4"
    />
  );
};
```

### DriveFilterCompact

A compact version of the drive filter for use in headers, sidebars, or toolbars. Shows only the dropdown without labels, messages, or current filter info.

#### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `filterService` | `FilterService` | Required | The FilterService instance to use |
| `className` | `string` | `''` | Optional CSS classes |
| `onFilterChange` | `function` | `undefined` | Callback when filter changes |

#### Usage

```typescript
import { DriveFilterCompact } from '@shared/components/filter';
import { FilterService } from '@shared/services/filter-service';

const HeaderComponent = () => {
  const filterService = new FilterService(supabaseClient);
  
  return (
    <header className="flex items-center justify-between p-4">
      <h1>My App</h1>
      <DriveFilterCompact
        filterService={filterService}
        className="w-48"
        onFilterChange={(profileId) => {
          // Handle filter change
          window.location.reload(); // Simple refresh
        }}
      />
    </header>
  );
};
```

## Integration Examples

### Full Page Implementation (dhg-audio style)

```typescript
import { DriveFilterCombobox } from '@shared/components/filter';

export const FilterSettingsPage = () => {
  const filterService = new FilterService(supabaseClient);

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <h1 className="text-3xl font-bold mb-8">Filter Settings</h1>
      
      <div className="bg-white rounded-lg shadow-md p-6">
        <p className="text-gray-600 mb-6">
          Select a drive filter to limit displayed content.
        </p>

        <DriveFilterCombobox
          filterService={filterService}
          onFilterChange={(profileId, profile) => {
            // Handle filter change
          }}
        />
      </div>
    </div>
  );
};
```

### Header/Toolbar Implementation

```typescript
import { DriveFilterCompact } from '@shared/components/filter';

export const AppHeader = () => {
  const filterService = new FilterService(supabaseClient);

  return (
    <header className="bg-white shadow">
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center space-x-4">
          <h1 className="text-xl font-semibold">My App</h1>
        </div>
        
        <div className="flex items-center space-x-4">
          <span className="text-sm text-gray-600">Filter:</span>
          <DriveFilterCompact
            filterService={filterService}
            className="min-w-[200px]"
          />
        </div>
      </div>
    </header>
  );
};
```

## Requirements

- React 16.8+ (hooks)
- FilterService from `@shared/services/filter-service`
- Tailwind CSS for styling
- A configured Supabase client

## Features

- **Automatic loading**: Fetches filter profiles and active state on mount
- **Real-time updates**: Changes are applied immediately
- **Error handling**: Displays error messages for failed operations
- **Success feedback**: Shows confirmation when filters are changed
- **Loading states**: Shows spinner while loading profiles
- **Flexible styling**: Accepts custom CSS classes
- **TypeScript support**: Full type safety with proper interfaces
- **Callback support**: Notifies parent components of filter changes

## Notes

- The `FilterService` must be instantiated with a valid Supabase client
- Filter changes are persisted to the database immediately
- Components handle their own loading and error states
- The compact version is ideal for space-constrained areas
- Both components use the same underlying FilterService API