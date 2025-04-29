# Frontend Development Guidelines

## React Component Structure

1. **Component Organization**:
   - Break UI into small, reusable components
   - Keep components focused on a single responsibility
   - Use descriptive, consistent naming for components
   - Place shared components in `components/` directory
   - Always declare explicit prop types

2. **State Management**:
   - Use React hooks for state management (useState, useEffect, useMemo)
   - Memoize expensive calculations with useMemo
   - Avoid prop drilling by using context when appropriate
   - For data fetching operations use async/await with proper error handling

3. **Supabase Integration**:
   - Always use the supabase-adapter singleton:
     ```typescript
     import { supabase } from '@/utils/supabase-adapter';
     ```
   - Never create new Supabase client instances
   - Always handle errors from Supabase operations
   - Use proper nested selects for related data
   - Pay attention to field naming when joining tables

## Database Relationships for Frontend Development

1. **Critical Relationships**:
   - `sources_google.document_type_id` joins to `document_types.id`
   - When fetching document types, use `document_type:document_type_id(document_type, mime_type)`
   - The field is named `document_type` (not "name")
   - Document tables have explicit foreign keys rather than join tables
   - Presentation assets have a source_id field that references sources_google

2. **Typical Frontend Query Pattern**:
   ```typescript
   const { data, error } = await supabase
     .from('presentations')
     .select(`
       id,
       title,
       expert_document:expert_document_id(id, title, processed_content),
       video_source:video_source_id(
         id, 
         name, 
         web_view_link, 
         document_type:document_type_id(document_type, mime_type)
       )
     `)
     .eq('status', 'active');
   
   if (error) {
     console.error('Query error:', error);
     // Handle error appropriately
   }
   ```

## UI Design Standards

1. **Styling Approach**:
   - Use Tailwind CSS for styling
   - Follow the existing color scheme and design patterns
   - Use responsive design patterns for all components
   - Use consistent spacing and typography throughout
   - Follow accessibility best practices

2. **Component Types**:
   - Pages: Full route components
   - Layout components: Structure content on the page
   - UI components: Buttons, cards, inputs, etc.
   - Feature components: Specific business logic implementers
   - Widget components: Self-contained, reusable feature sets

## Loading and Error States

1. **Always handle these states explicitly**:
   - Initial loading state
   - Data loading state
   - Error state
   - Empty state (when data is empty)
   - Success state

2. **Implementation patterns**:
   ```tsx
   const [loading, setLoading] = useState(true);
   const [error, setError] = useState<string | null>(null);
   const [data, setData] = useState<DataType[] | null>(null);
   
   useEffect(() => {
     async function fetchData() {
       try {
         setLoading(true);
         setError(null);
         
         const { data, error } = await supabase.from('table').select('*');
         
         if (error) throw new Error(error.message);
         
         setData(data);
       } catch (err) {
         setError(err instanceof Error ? err.message : 'Unknown error');
         console.error(err);
       } finally {
         setLoading(false);
       }
     }
     
     fetchData();
   }, []);
   
   // In the render function:
   if (loading) return <LoadingComponent />;
   if (error) return <ErrorComponent message={error} />;
   if (!data || data.length === 0) return <EmptyStateComponent />;
   
   // Render normal state
   ```

## TypeScript Best Practices

1. **Type Definitions**:
   - Import types from supabase/types.ts
   - Extend database types with frontend-specific fields
   - Define explicit prop types for all components
   - Use interfaces for object shapes and types for unions
   - Use proper typing for all asynchronous operations

2. **Example Type Definitions**:
   ```typescript
   // Extending database types
   type Presentation = Database['public']['Tables']['presentations']['Row'] & {
     expert_document?: ExpertDocument | null;
     video_source?: SourceGoogle | null;
   };
   
   type PresentationAsset = Database['public']['Tables']['presentation_assets']['Row'] & {
     source_file?: SourceGoogle | null;
   };
   
   // Component prop types
   interface AssetCardProps {
     asset: PresentationAsset;
     isSelected: boolean;
     onSelect: (asset: PresentationAsset) => void;
     onDoubleClick: (asset: PresentationAsset) => void;
   }
   ```

## Dashboard Component Guidelines

1. **Layout Structure**:
   - Use responsive grid layouts
   - Implement sidebar navigation for filtering
   - Create card-based content displays
   - Provide proper loading and error states
   - Use consistent spacing and typography

2. **Typical Dashboard Pattern**:
   - Top section: Filters and search
   - Left sidebar: Navigation/selection
   - Main content: Selected item detail
   - Footer: Actions or pagination

3. **User Experience**:
   - Give feedback for all asynchronous operations
   - Provide clear error messages
   - Implement keyboard navigation where possible
   - Show loading states for all network operations
   - Provide empty states with actionable next steps